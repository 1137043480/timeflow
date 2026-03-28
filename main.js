const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

// ===== Simple JSON File Store =====
class JsonStore {
  constructor(filePath, defaults) {
    this.filePath = filePath;
    this.defaults = defaults;
    this.data = null;
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = { ...this.defaults, ...JSON.parse(raw) };
      } else {
        this.data = { ...this.defaults };
        this.save();
      }
    } catch (e) {
      console.error('Failed to load data:', e);
      this.data = { ...this.defaults };
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }
}

const defaults = {
  tasks: [],
  archivedTasks: [],
  categories: [
    { id: 'cat-work', name: '工作', color: '#6366f1', icon: '💼' },
    { id: 'cat-study', name: '学习', color: '#8b5cf6', icon: '📚' },
    { id: 'cat-personal', name: '个人', color: '#ec4899', icon: '🏠' },
    { id: 'cat-exercise', name: '运动', color: '#10b981', icon: '🏃' }
  ],
  tags: [
    { id: 'tag-urgent', name: '紧急', color: '#ef4444' },
    { id: 'tag-important', name: '重要', color: '#f59e0b' },
    { id: 'tag-routine', name: '日常', color: '#6b7280' }
  ],
  settings: {
    llmBaseUrl: '',
    llmApiKey: '',
    llmModel: 'gpt-4o',
    enableLLM: false,
    theme: 'dark',
    notifyAt80Percent: true,
    notifyAt100Percent: true
  }
};

let store;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  // 优先使用 iCloud Drive 存储，实现跨设备同步
  const homedir = require('os').homedir();
  const iCloudPath = path.join(homedir, 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'TimeFlow');
  const localPath = app.getPath('userData');

  let dataDir;
  if (process.platform === 'darwin' && fs.existsSync(path.join(homedir, 'Library', 'Mobile Documents', 'com~apple~CloudDocs'))) {
    // iCloud Drive 可用
    dataDir = iCloudPath;
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    console.log('☁️ 使用 iCloud Drive 存储');

    // 如果本地有旧数据但 iCloud 没有，自动迁移
    const localFile = path.join(localPath, 'timeflow-data.json');
    const iCloudFile = path.join(iCloudPath, 'timeflow-data.json');
    if (fs.existsSync(localFile) && !fs.existsSync(iCloudFile)) {
      fs.copyFileSync(localFile, iCloudFile);
      console.log('📦 已将本地数据迁移到 iCloud Drive');
    }
  } else {
    // 非 Mac 或 iCloud 不可用，使用本地存储
    dataDir = localPath;
    console.log('💾 使用本地存储');
  }

  const dataPath = path.join(dataDir, 'timeflow-data.json');
  store = new JsonStore(dataPath, defaults);
  store.load();
  console.log('TimeFlow data stored at:', dataPath);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== IPC Handlers =====

// Tasks
ipcMain.handle('store:getTasks', () => store.get('tasks'));
ipcMain.handle('store:setTasks', (_, tasks) => { store.set('tasks', tasks); return true; });

// Archived Tasks
ipcMain.handle('store:getArchivedTasks', () => store.get('archivedTasks'));
ipcMain.handle('store:setArchivedTasks', (_, tasks) => { store.set('archivedTasks', tasks); return true; });

// Categories
ipcMain.handle('store:getCategories', () => store.get('categories'));
ipcMain.handle('store:setCategories', (_, cats) => { store.set('categories', cats); return true; });

// Tags
ipcMain.handle('store:getTags', () => store.get('tags'));
ipcMain.handle('store:setTags', (_, tags) => { store.set('tags', tags); return true; });

// Settings
ipcMain.handle('store:getSettings', () => store.get('settings'));
ipcMain.handle('store:setSettings', (_, settings) => { store.set('settings', settings); return true; });

// Notification
ipcMain.handle('notify:show', (_, { title, body }) => {
  try {
    const notification = new Notification({ title, body, silent: false });
    notification.show();
  } catch (e) {
    console.warn('Notification error:', e.message);
  }
  return true;
});

// LLM API call
ipcMain.handle('llm:estimate', async (_, { prompt }) => {
  const settings = store.get('settings');
  if (!settings.enableLLM || !settings.llmApiKey) {
    return { error: 'LLM 未启用或未配置 API Key' };
  }
  try {
    const response = await fetch(`${settings.llmBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.llmApiKey}`
      },
      body: JSON.stringify({
        model: settings.llmModel,
        messages: [
          {
            role: 'system',
            content: `你是一个时间管理助手。当前时间是：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', weekday:'long' })}（北京时间）。

用户会给你一个任务描述和他们的历史数据，你需要：
1. 预估这个任务需要多少分钟（如果任务涉及时间点，请根据当前时间计算）
2. 给出置信度（低/中/高）
3. 简短解释你的判断依据
请用 JSON 格式回复：{"estimatedMinutes": number, "confidence": "低|中|高", "explanation": "string"}`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: '解析失败', raw: content };
      } catch {
        return { error: '解析失败', raw: content };
      }
    }
    return { error: '无响应' };
  } catch (err) {
    return { error: err.message };
  }
});

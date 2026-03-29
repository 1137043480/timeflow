const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

// ===== Remote API Store (syncs with VPS) =====
const API_BASE = 'https://time.kzwbelieve.top';
const AUTH_PASSWORD = 'tf2026';

class RemoteStore {
  constructor(localCachePath, defaults) {
    this.localCachePath = localCachePath;
    this.defaults = defaults;
    this.data = null;
    this.token = '';
  }

  async authenticate() {
    try {
      const res = await fetch(`${API_BASE}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: AUTH_PASSWORD })
      });
      const data = await res.json();
      if (data.success) {
        this.token = data.token;
        return true;
      }
    } catch (e) {
      console.warn('⚠️ VPS 认证失败:', e.message);
    }
    return false;
  }

  async _fetch(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      ...options.headers
    };
    const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async load() {
    // Try to authenticate and load from remote
    const authed = await this.authenticate();
    if (authed) {
      try {
        const [tasks, archived, categories, tags, settings] = await Promise.all([
          this._fetch('/api/tasks'),
          this._fetch('/api/archived'),
          this._fetch('/api/categories'),
          this._fetch('/api/tags'),
          this._fetch('/api/settings')
        ]);
        this.data = { tasks, archivedTasks: archived, categories, tags, settings };
        this.saveLocal(); // Cache locally
        console.log('☁️ 已从 VPS 加载数据');
        return;
      } catch (e) {
        console.warn('⚠️ VPS 数据加载失败:', e.message);
      }
    }

    // Fallback: load from local cache
    this.loadLocal();
  }

  loadLocal() {
    try {
      if (fs.existsSync(this.localCachePath)) {
        const raw = fs.readFileSync(this.localCachePath, 'utf-8');
        this.data = { ...this.defaults, ...JSON.parse(raw) };
        console.log('💾 已从本地缓存加载数据');
      } else {
        this.data = { ...this.defaults };
      }
    } catch (e) {
      this.data = { ...this.defaults };
    }
  }

  saveLocal() {
    try {
      const dir = path.dirname(this.localCachePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.localCachePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('本地缓存保存失败:', e);
    }
  }

  async saveRemote(key) {
    const apiMap = {
      tasks: '/api/tasks',
      archivedTasks: '/api/archived',
      categories: '/api/categories',
      tags: '/api/tags',
      settings: '/api/settings'
    };
    const url = apiMap[key];
    if (!url || !this.token) return;

    try {
      await this._fetch(url, {
        method: 'PUT',
        body: JSON.stringify(this.data[key])
      });
    } catch (e) {
      console.warn(`⚠️ VPS 同步失败 (${key}):`, e.message);
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.saveLocal();
    this.saveRemote(key); // async, don't block
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

app.whenReady().then(async () => {
  // Local cache path (still keeps a local copy for offline fallback)
  const localPath = app.getPath('userData');
  const dataPath = path.join(localPath, 'timeflow-data.json');

  store = new RemoteStore(dataPath, defaults);
  await store.load();
  console.log('TimeFlow data cache at:', dataPath);

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

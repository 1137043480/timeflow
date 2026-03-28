const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Tasks
  getTasks: () => ipcRenderer.invoke('store:getTasks'),
  setTasks: (tasks) => ipcRenderer.invoke('store:setTasks', tasks),

  // Categories
  getCategories: () => ipcRenderer.invoke('store:getCategories'),
  setCategories: (cats) => ipcRenderer.invoke('store:setCategories', cats),

  // Tags
  getTags: () => ipcRenderer.invoke('store:getTags'),
  setTags: (tags) => ipcRenderer.invoke('store:setTags', tags),

  // Settings
  getSettings: () => ipcRenderer.invoke('store:getSettings'),
  setSettings: (settings) => ipcRenderer.invoke('store:setSettings', settings),

  // Notifications
  showNotification: (title, body) => ipcRenderer.invoke('notify:show', { title, body }),

  // LLM
  llmEstimate: (prompt) => ipcRenderer.invoke('llm:estimate', { prompt })
});

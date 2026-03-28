// ===== Data Store Layer =====
// Wraps electron-store IPC calls with caching

class DataStore {
  constructor() {
    this.tasks = [];
    this.archivedTasks = []; // 归档任务：从看板删除但保留数据用于报表和AI
    this.categories = [];
    this.tags = [];
    this.settings = {};
    this._loaded = false;
  }

  async init() {
    if (this._loaded) return;
    this.tasks = await window.api.getTasks();
    this.archivedTasks = await window.api.getArchivedTasks();
    this.categories = await window.api.getCategories();
    this.tags = await window.api.getTags();
    this.settings = await window.api.getSettings();
    this._loaded = true;
  }

  // ===== Tasks =====
  async saveTasks() {
    await window.api.setTasks(this.tasks);
  }

  generateId() {
    return 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  async addTask(task) {
    task.id = this.generateId();
    task.createdAt = new Date().toISOString();
    task.status = 'todo';
    task.actualMinutes = 0;
    task.timerSessions = [];
    task.startedAt = null;
    task.completedAt = null;
    this.tasks.unshift(task);
    await this.saveTasks();
    return task;
  }

  async updateTask(id, updates) {
    const idx = this.tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.tasks[idx] = { ...this.tasks[idx], ...updates };
      await this.saveTasks();
      return this.tasks[idx];
    }
    return null;
  }

  async deleteTask(id) {
    const task = this.tasks.find(t => t.id === id);
    // 已完成的任务归档保留数据，未完成的直接删除
    if (task && task.status === 'completed') {
      this.archivedTasks.push(task);
      await this.saveArchivedTasks();
    }
    this.tasks = this.tasks.filter(t => t.id !== id);
    await this.saveTasks();
  }

  getTask(id) {
    return this.tasks.find(t => t.id === id);
  }

  getTasksByStatus(status) {
    return this.tasks.filter(t => t.status === status);
  }

  getTasksForDate(dateStr) {
    const all = [...this.tasks, ...this.archivedTasks];
    return all.filter(t => {
      if (!t.completedAt) return false;
      return t.completedAt.startsWith(dateStr);
    });
  }

  getTasksForWeek() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const all = [...this.tasks, ...this.archivedTasks];
    return all.filter(t => {
      if (!t.completedAt) return false;
      return new Date(t.completedAt) >= startOfWeek;
    });
  }

  getCompletedTasks() {
    // 包含归档任务，用于报表和AI预估
    const active = this.tasks.filter(t => t.status === 'completed');
    return [...active, ...this.archivedTasks];
  }

  // ===== Archived Tasks =====
  async saveArchivedTasks() {
    await window.api.setArchivedTasks(this.archivedTasks);
  }

  getTasksByCategory(categoryId) {
    return this.tasks.filter(t => t.categoryId === categoryId);
  }

  // ===== Categories =====
  async saveCategories() {
    await window.api.setCategories(this.categories);
  }

  async addCategory(cat) {
    cat.id = 'cat-' + Date.now();
    this.categories.push(cat);
    await this.saveCategories();
    return cat;
  }

  async updateCategory(id, updates) {
    const idx = this.categories.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.categories[idx] = { ...this.categories[idx], ...updates };
      await this.saveCategories();
    }
  }

  async deleteCategory(id) {
    this.categories = this.categories.filter(c => c.id !== id);
    await this.saveCategories();
  }

  getCategory(id) {
    return this.categories.find(c => c.id === id);
  }

  // ===== Tags =====
  async saveTags() {
    await window.api.setTags(this.tags);
  }

  async addTag(tag) {
    tag.id = 'tag-' + Date.now();
    this.tags.push(tag);
    await this.saveTags();
    return tag;
  }

  async updateTag(id, updates) {
    const idx = this.tags.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.tags[idx] = { ...this.tags[idx], ...updates };
      await this.saveTags();
    }
  }

  async deleteTag(id) {
    this.tags = this.tags.filter(t => t.id !== id);
    await this.saveTags();
  }

  // ===== Settings =====
  async saveSettings() {
    await window.api.setSettings(this.settings);
  }
}

// Global store instance
const store = new DataStore();

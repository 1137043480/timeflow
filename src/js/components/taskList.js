// ===== Task List Component =====

class TaskList {
  constructor() {
    this.searchInput = document.getElementById('task-search');
    this.filterCategory = document.getElementById('task-filter-category');
    this.filterStatus = document.getElementById('task-filter-status');

    this.searchInput.addEventListener('input', debounce(() => this.refresh(), 200));
    this.filterCategory.addEventListener('change', () => this.refresh());
    this.filterStatus.addEventListener('change', () => this.refresh());

    // Set today's date
    const d = new Date();
    document.getElementById('tasks-date').textContent =
      `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
  }

  refresh() {
    this.updateCategoryFilter();
    this.renderTasks();
    sidebar.updateStats();
  }

  updateCategoryFilter() {
    const select = this.filterCategory;
    const val = select.value;
    select.innerHTML = '<option value="">所有分类</option>';
    store.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `${cat.icon} ${cat.name}`;
      select.appendChild(opt);
    });
    select.value = val;
  }

  getFilteredTasks() {
    let tasks = [...store.tasks];

    const search = this.searchInput.value.trim().toLowerCase();
    if (search) {
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(search) ||
        (t.description && t.description.toLowerCase().includes(search))
      );
    }

    const catFilter = this.filterCategory.value;
    if (catFilter) {
      tasks = tasks.filter(t => t.categoryId === catFilter);
    }

    const statusFilter = this.filterStatus.value;
    if (statusFilter) {
      tasks = tasks.filter(t => t.status === statusFilter);
    }

    return tasks;
  }

  renderTasks() {
    const tasks = this.getFilteredTasks();

    const todoTasks = tasks.filter(t => t.status === 'todo');
    const progressTasks = tasks.filter(t => t.status === 'in-progress');
    const doneTasks = tasks.filter(t => t.status === 'completed');

    this.renderColumn('list-todo', todoTasks);
    this.renderColumn('list-progress', progressTasks);
    this.renderColumn('list-done', doneTasks);

    document.getElementById('count-todo').textContent = todoTasks.length;
    document.getElementById('count-progress').textContent = progressTasks.length;
    document.getElementById('count-done').textContent = doneTasks.length;
  }

  renderColumn(containerId, tasks) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = tasks.map(task => this.renderCard(task)).join('');

    // Bind events
    container.querySelectorAll('.task-card').forEach(card => {
      const taskId = card.dataset.taskId;

      card.querySelector('.task-card-menu')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleContextMenu(card);
      });
    });

    // Bind action buttons
    container.querySelectorAll('.btn-start-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        timer.startTask(btn.dataset.taskId);
      });
    });

    container.querySelectorAll('.btn-pause-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        timer.pauseTask();
      });
    });

    container.querySelectorAll('.btn-complete-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        timer.completeTask(btn.dataset.taskId);
      });
    });

    container.querySelectorAll('.btn-edit-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        taskForm.openEdit(btn.dataset.taskId);
      });
    });

    container.querySelectorAll('.btn-delete-task').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('确定要删除这个任务吗？')) {
          await store.deleteTask(btn.dataset.taskId);
          this.refresh();
        }
      });
    });
  }

  renderCard(task) {
    const category = store.getCategory(task.categoryId);
    const totalActualSeconds = (task.timerSessions || []).reduce((sum, s) => sum + (s.duration || 0), 0);
    const actualMinutes = task.actualMinutes || Math.round(totalActualSeconds / 60);

    let timeBarClass = 'under';
    let timeBarWidth = 0;
    if (task.estimatedMinutes > 0 && actualMinutes > 0) {
      const ratio = actualMinutes / task.estimatedMinutes;
      timeBarWidth = Math.min(ratio * 100, 100);
      if (ratio > 1) timeBarClass = 'over';
      else if (ratio > 0.8) timeBarClass = 'near';
    }

    const isActive = timer.activeTaskId === task.id;

    let actionsHtml = '';
    if (task.status === 'todo') {
      actionsHtml = `
        <div class="task-card-actions">
          <button class="btn btn-success btn-sm btn-start-task" data-task-id="${task.id}">▶ 开始</button>
          <button class="btn btn-secondary btn-sm btn-edit-task" data-task-id="${task.id}">✏️</button>
          <button class="btn btn-danger btn-sm btn-delete-task" data-task-id="${task.id}">🗑</button>
        </div>`;
    } else if (task.status === 'in-progress') {
      actionsHtml = `
        <div class="task-card-actions">
          ${isActive
            ? `<button class="btn btn-secondary btn-sm btn-pause-task" data-task-id="${task.id}">⏸ 暂停</button>`
            : `<button class="btn btn-success btn-sm btn-start-task" data-task-id="${task.id}">▶ 继续</button>`
          }
          <button class="btn btn-primary btn-sm btn-complete-task" data-task-id="${task.id}">✅ 完成</button>
        </div>`;
    } else {
      actionsHtml = `
        <div class="task-card-actions">
          <button class="btn btn-danger btn-sm btn-delete-task" data-task-id="${task.id}">🗑 删除</button>
        </div>`;
    }

    const tagsHtml = (task.tags || []).map(tagId => {
      const tag = store.tags.find(t => t.id === tagId);
      if (!tag) return '';
      return `<span class="task-card-tag" style="color:${tag.color};border-color:${tag.color}30;background:${tag.color}15">${escapeHtml(tag.name)}</span>`;
    }).join('');

    // Build time range display for completed/in-progress tasks
    let timeRangeHtml = '';
    if (task.status === 'completed' && task.startedAt) {
      timeRangeHtml = `
        <div class="task-card-timerange">
          <span class="task-timerange-label">🕐</span>
          <span class="task-timerange-value">${formatTimeBJ(task.startedAt)} → ${formatTimeBJ(task.completedAt)}</span>
        </div>`;
    } else if (task.status === 'in-progress' && task.startedAt) {
      timeRangeHtml = `
        <div class="task-card-timerange">
          <span class="task-timerange-label">🕐</span>
          <span class="task-timerange-value">${formatTimeBJ(task.startedAt)} 开始</span>
        </div>`;
    }

    return `
      <div class="task-card ${isActive ? 'active-timer' : ''}" data-task-id="${task.id}">
        <div class="task-card-header">
          <div class="task-card-title">${escapeHtml(task.title)}</div>
        </div>
        ${task.description ? `<div class="task-card-desc">${escapeHtml(task.description)}</div>` : ''}
        <div class="task-card-meta">
          ${category ? `<span class="task-card-category" style="color:${category.color};background:${category.color}20">${category.icon} ${escapeHtml(category.name)}</span>` : ''}
          ${tagsHtml}
        </div>
        <div class="task-card-time">
          <span class="task-time-estimate">预估 ${formatMinutes(task.estimatedMinutes)}</span>
          <div class="task-time-bar">
            <div class="task-time-bar-fill ${timeBarClass}" style="width:${timeBarWidth}%"></div>
          </div>
          <span class="task-time-actual">${isActive ? formatTimer(timer.elapsedSeconds) : formatMinutes(actualMinutes)}</span>
        </div>
        ${timeRangeHtml}
        ${actionsHtml}
      </div>
    `;
  }

  toggleContextMenu(card) {
    const existing = card.querySelector('.context-menu');
    if (existing) {
      existing.remove();
      return;
    }
    // Close any other context menus
    document.querySelectorAll('.context-menu').forEach(m => m.remove());
  }
}

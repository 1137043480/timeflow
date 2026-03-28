// ===== Sidebar Component =====

class Sidebar {
  constructor() {
    this.navItems = document.querySelectorAll('.nav-item');
    this.views = document.querySelectorAll('.view');
    this.init();
  }

  init() {
    this.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        this.switchView(view);
      });
    });
  }

  switchView(viewName) {
    this.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });
    this.views.forEach(view => {
      view.classList.toggle('active', view.id === `view-${viewName}`);
    });

    // Trigger view-specific refresh
    if (viewName === 'reports') {
      if (typeof reportsComponent !== 'undefined') reportsComponent.refresh();
    } else if (viewName === 'categories') {
      if (typeof categoriesComponent !== 'undefined') categoriesComponent.refresh();
    } else if (viewName === 'tasks') {
      if (typeof taskList !== 'undefined') taskList.refresh();
    } else if (viewName === 'settings') {
      if (typeof settingsComponent !== 'undefined') settingsComponent.refresh();
    }
  }

  updateStats() {
    const today = todayString();
    const todayTasks = store.tasks.filter(t =>
      t.completedAt && t.completedAt.startsWith(today)
    );

    document.getElementById('stat-today-tasks').textContent = todayTasks.length;

    const totalMinutes = todayTasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);
    document.getElementById('stat-today-time').textContent = formatMinutes(totalMinutes);
  }

  showTimer(taskName, timeStr) {
    const el = document.getElementById('sidebar-timer');
    el.style.display = 'block';
    document.getElementById('sidebar-timer-task').textContent = taskName;
    document.getElementById('sidebar-timer-time').textContent = timeStr;
  }

  hideTimer() {
    document.getElementById('sidebar-timer').style.display = 'none';
  }
}

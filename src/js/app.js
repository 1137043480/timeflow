// ===== App Entry Point =====

let sidebar, taskList, taskForm, timer, reportsComponent, categoriesComponent, settingsComponent;

async function initApp() {
  // Initialize data store
  await store.init();

  // Initialize components
  sidebar = new Sidebar();
  timer = new Timer();
  taskList = new TaskList();
  taskForm = new TaskForm();
  reportsComponent = new ReportsComponent();
  categoriesComponent = new CategoriesComponent();
  settingsComponent = new SettingsComponent();

  // Apply theme
  settingsComponent.applyTheme();

  // Initial render
  taskList.refresh();
  sidebar.updateStats();

  console.log('✅ TimeFlow initialized');
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);

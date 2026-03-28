// ===== Settings Component =====

class SettingsComponent {
  constructor() {
    document.getElementById('btn-save-settings').addEventListener('click', () => this.save());
  }

  refresh() {
    const s = store.settings;
    document.getElementById('setting-enable-llm').checked = s.enableLLM !== false;
    document.getElementById('setting-llm-url').value = s.llmBaseUrl || '';
    document.getElementById('setting-llm-key').value = s.llmApiKey || '';
    document.getElementById('setting-llm-model').value = s.llmModel || 'gpt-5.3-codex';
    document.getElementById('setting-notify-80').checked = s.notifyAt80Percent !== false;
    document.getElementById('setting-notify-100').checked = s.notifyAt100Percent !== false;
    document.getElementById('setting-theme').value = s.theme || 'dark';
  }

  async save() {
    store.settings = {
      ...store.settings,
      enableLLM: document.getElementById('setting-enable-llm').checked,
      llmBaseUrl: document.getElementById('setting-llm-url').value.trim(),
      llmApiKey: document.getElementById('setting-llm-key').value.trim(),
      llmModel: document.getElementById('setting-llm-model').value.trim(),
      notifyAt80Percent: document.getElementById('setting-notify-80').checked,
      notifyAt100Percent: document.getElementById('setting-notify-100').checked,
      theme: document.getElementById('setting-theme').value
    };

    await store.saveSettings();
    this.applyTheme();

    // Show success feedback
    const btn = document.getElementById('btn-save-settings');
    const originalText = btn.textContent;
    btn.textContent = '✅ 已保存';
    setTimeout(() => { btn.textContent = originalText; }, 1500);
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', store.settings.theme || 'dark');
  }
}

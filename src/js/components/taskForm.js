// ===== Task Form Component (Modal) =====

class TaskForm {
  constructor() {
    this.overlay = document.getElementById('modal-overlay');
    this.modal = document.getElementById('task-modal');
    this.editingId = null;
    this.aiEstimateResult = null;

    document.getElementById('btn-add-task').addEventListener('click', () => this.openNew());
    document.getElementById('modal-close').addEventListener('click', () => this.close());
    document.getElementById('modal-cancel').addEventListener('click', () => this.close());
    document.getElementById('modal-save').addEventListener('click', () => this.save());
    document.getElementById('btn-ai-estimate').addEventListener('click', () => this.requestAIEstimate());
    document.getElementById('btn-use-estimate').addEventListener('click', () => this.useAIEstimate());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  openNew() {
    this.editingId = null;
    document.getElementById('modal-title').textContent = '新建任务';
    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    document.getElementById('task-estimate').value = '';
    document.getElementById('ai-result').style.display = 'none';
    this.populateCategories();
    this.populateTags([]);
    this.overlay.classList.add('show');
  }

  openEdit(taskId) {
    const task = store.getTask(taskId);
    if (!task) return;

    this.editingId = taskId;
    document.getElementById('modal-title').textContent = '编辑任务';
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-desc').value = task.description || '';
    document.getElementById('task-estimate').value = task.estimatedMinutes || '';
    document.getElementById('ai-result').style.display = 'none';
    this.populateCategories(task.categoryId);
    this.populateTags(task.tags || []);
    this.overlay.classList.add('show');
  }

  close() {
    this.overlay.classList.remove('show');
    this.editingId = null;
  }

  populateCategories(selectedId) {
    const select = document.getElementById('task-category');
    select.innerHTML = '<option value="">选择分类</option>';
    store.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `${cat.icon} ${cat.name}`;
      if (cat.id === selectedId) opt.selected = true;
      select.appendChild(opt);
    });
  }

  populateTags(selectedIds) {
    const container = document.getElementById('tag-selector');
    container.innerHTML = '';
    store.tags.forEach(tag => {
      const el = document.createElement('span');
      el.className = `tag-option ${selectedIds.includes(tag.id) ? 'selected' : ''}`;
      el.style.color = tag.color;
      el.dataset.tagId = tag.id;
      el.innerHTML = `<span>${escapeHtml(tag.name)}</span>`;
      el.addEventListener('click', () => {
        el.classList.toggle('selected');
      });
      container.appendChild(el);
    });
  }

  getSelectedTags() {
    return Array.from(document.querySelectorAll('.tag-option.selected'))
      .map(el => el.dataset.tagId);
  }

  async save() {
    const title = document.getElementById('task-title').value.trim();
    if (!title) {
      document.getElementById('task-title').focus();
      return;
    }

    const taskData = {
      title,
      description: document.getElementById('task-desc').value.trim(),
      categoryId: document.getElementById('task-category').value,
      estimatedMinutes: parseInt(document.getElementById('task-estimate').value) || 0,
      tags: this.getSelectedTags()
    };

    if (this.editingId) {
      await store.updateTask(this.editingId, taskData);
    } else {
      await store.addTask(taskData);
    }

    this.close();
    taskList.refresh();
  }

  async requestAIEstimate() {
    const title = document.getElementById('task-title').value.trim();
    if (!title) {
      document.getElementById('task-title').focus();
      return;
    }

    const btn = document.getElementById('btn-ai-estimate');
    const resultArea = document.getElementById('ai-result');
    const resultBody = document.getElementById('ai-result-body');

    btn.disabled = true;
    btn.textContent = '🤖 预估中...';
    resultArea.style.display = 'block';
    resultBody.innerHTML = '<span class="loading-dots">正在分析</span>';

    const desc = document.getElementById('task-desc').value.trim();
    const categoryId = document.getElementById('task-category').value;
    const tagIds = this.getSelectedTags();
    const userEstimate = parseInt(document.getElementById('task-estimate').value) || 30;

    try {
      // 同时运行两个引擎
      const localResult = timeEstimator.localEstimate(title, categoryId, tagIds);
      const llmResult = await timeEstimator.llmEstimate(title, desc, categoryId, tagIds);

      let html = '';

      // 本地统计引擎
      if (localResult) {
        const suggestedMinutes = Math.round(userEstimate * localResult.adjustmentFactor);
        html += `
          <div style="padding:10px;border-radius:8px;background:rgba(99,102,241,0.1);margin-bottom:10px;">
            <div style="margin-bottom:6px;">
              <strong>📊 本地统计预估：${suggestedMinutes} 分钟</strong>
              （置信度：${localResult.confidence}）
            </div>
            <div style="font-size:0.85rem;opacity:0.8;">
              ${localResult.biasText}（基于 ${localResult.sampleSize} 个历史任务）
            </div>
          </div>
        `;
      } else {
        html += `
          <div style="padding:10px;border-radius:8px;background:rgba(99,102,241,0.05);margin-bottom:10px;font-size:0.85rem;opacity:0.6;">
            📊 本地统计：数据不足（需要至少 3 个已完成任务）
          </div>
        `;
      }

      // LLM 引擎
      if (llmResult && !llmResult.error) {
        this.aiEstimateResult = llmResult.estimatedMinutes;
        html += `
          <div style="padding:10px;border-radius:8px;background:rgba(16,185,129,0.1);">
            <div style="margin-bottom:6px;">
              <strong>🤖 AI 预估：${llmResult.estimatedMinutes} 分钟</strong>
              （置信度：${llmResult.confidence || '-'}）
            </div>
            <div style="font-size:0.85rem;opacity:0.8;">${escapeHtml(llmResult.explanation || '')}</div>
          </div>
        `;
      } else {
        // LLM 失败，用本地结果作为推荐
        if (localResult) {
          this.aiEstimateResult = Math.round(userEstimate * localResult.adjustmentFactor);
        }
        html += `
          <div style="padding:10px;border-radius:8px;background:rgba(245,158,11,0.1);font-size:0.85rem;">
            🤖 AI 预估不可用${llmResult?.error ? `：${escapeHtml(llmResult.error)}` : ''}
          </div>
        `;
      }

      resultBody.innerHTML = html;
    } catch (e) {
      resultBody.innerHTML = `<div style="color:var(--color-danger);">预估失败：${escapeHtml(e.message)}</div>`;
    }

    btn.disabled = false;
    btn.textContent = '🤖 AI 预估';
  }

  useAIEstimate() {
    if (this.aiEstimateResult) {
      document.getElementById('task-estimate').value = this.aiEstimateResult;
    }
  }
}

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
    resultBody.innerHTML = '<span class="loading-dots">AI 正在分析</span>';

    const desc = document.getElementById('task-desc').value.trim();
    const categoryId = document.getElementById('task-category').value;
    const tagIds = this.getSelectedTags();

    try {
      // Try LLM first
      const llmResult = await timeEstimator.llmEstimate(title, desc, categoryId, tagIds);
      const localResult = timeEstimator.localEstimate(title, categoryId, tagIds);

      if (llmResult && !llmResult.error) {
        this.aiEstimateResult = llmResult.estimatedMinutes;
        resultBody.innerHTML = `
          <div style="margin-bottom:8px;">
            <strong>🤖 AI 预估：${llmResult.estimatedMinutes} 分钟</strong>
            （置信度：${llmResult.confidence || '-'}）
          </div>
          <div style="margin-bottom:8px;">${escapeHtml(llmResult.explanation || '')}</div>
          ${localResult ? `
            <div style="border-top:1px solid var(--border-color);padding-top:8px;margin-top:8px;font-size:0.8rem;">
              📊 本地统计：${localResult.biasText}（基于 ${localResult.sampleSize} 个历史任务）
            </div>
          ` : ''}
        `;
      } else {
        // Fallback to local estimation
        if (localResult) {
          const suggestedMinutes = Math.round(
            (parseInt(document.getElementById('task-estimate').value) || 30) * localResult.adjustmentFactor
          );
          this.aiEstimateResult = suggestedMinutes;
          resultBody.innerHTML = `
            <div style="margin-bottom:8px;">
              <strong>📊 统计预估：${suggestedMinutes} 分钟</strong>
              （置信度：${localResult.confidence}）
            </div>
            <div>${localResult.biasText}（基于 ${localResult.sampleSize} 个历史任务）</div>
            ${llmResult?.error ? `<div style="margin-top:8px;color:var(--color-warning);font-size:0.8rem;">LLM 不可用：${escapeHtml(llmResult.error)}</div>` : ''}
          `;
        } else {
          resultBody.innerHTML = `
            <div style="color:var(--color-warning);">
              历史数据不足（需要至少 3 个已完成的同类任务），暂时无法给出预估建议。
              ${llmResult?.error ? `<br>LLM 错误：${escapeHtml(llmResult.error)}` : ''}
            </div>
          `;
        }
      }
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

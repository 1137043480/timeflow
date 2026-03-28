// ===== Categories & Tags Component =====

class CategoriesComponent {
  constructor() {
    this.editingType = null; // 'category' or 'tag'
    this.editingId = null;

    this.overlay = document.getElementById('cat-modal-overlay');
    this.modal = document.getElementById('cat-modal');

    document.getElementById('btn-add-category').addEventListener('click', () => this.openModal('category'));
    document.getElementById('btn-add-tag').addEventListener('click', () => this.openModal('tag'));
    document.getElementById('cat-modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('cat-modal-cancel').addEventListener('click', () => this.closeModal());
    document.getElementById('cat-modal-save').addEventListener('click', () => this.save());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.closeModal();
    });
  }

  refresh() {
    this.renderCategories();
    this.renderTags();
  }

  renderCategories() {
    const grid = document.getElementById('category-grid');
    grid.innerHTML = store.categories.map(cat => {
      const taskCount = store.getTasksByCategory(cat.id).length;
      return `
        <div class="category-card" data-id="${cat.id}">
          <span class="category-icon">${cat.icon}</span>
          <div class="category-info">
            <div class="category-name">${escapeHtml(cat.name)}</div>
            <div class="category-count">${taskCount} 个任务</div>
          </div>
          <div class="category-actions">
            <button class="btn btn-sm btn-secondary btn-edit-cat" data-id="${cat.id}">✏️</button>
            <button class="btn btn-sm btn-danger btn-del-cat" data-id="${cat.id}">🗑</button>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.btn-edit-cat').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openModal('category', btn.dataset.id);
      });
    });

    grid.querySelectorAll('.btn-del-cat').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('确定要删除这个分类吗？')) {
          await store.deleteCategory(btn.dataset.id);
          this.refresh();
        }
      });
    });
  }

  renderTags() {
    const grid = document.getElementById('tag-grid');
    grid.innerHTML = store.tags.map(tag => `
      <div class="tag-card-item" data-id="${tag.id}">
        <span class="tag-color-dot" style="background:${tag.color}"></span>
        <span class="tag-name">${escapeHtml(tag.name)}</span>
        <div class="tag-actions">
          <button class="btn btn-sm btn-secondary btn-edit-tag" data-id="${tag.id}">✏️</button>
          <button class="btn btn-sm btn-danger btn-del-tag" data-id="${tag.id}">🗑</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.btn-edit-tag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openModal('tag', btn.dataset.id);
      });
    });

    grid.querySelectorAll('.btn-del-tag').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('确定要删除这个标签吗？')) {
          await store.deleteTag(btn.dataset.id);
          this.refresh();
        }
      });
    });
  }

  openModal(type, editId) {
    this.editingType = type;
    this.editingId = editId || null;

    const iconGroup = document.getElementById('cat-icon-group');

    if (type === 'category') {
      document.getElementById('cat-modal-title').textContent = editId ? '编辑分类' : '新建分类';
      iconGroup.style.display = 'block';
      if (editId) {
        const cat = store.getCategory(editId);
        if (cat) {
          document.getElementById('cat-name').value = cat.name;
          document.getElementById('cat-color').value = cat.color;
          document.getElementById('cat-icon').value = cat.icon;
        }
      } else {
        document.getElementById('cat-name').value = '';
        document.getElementById('cat-color').value = '#6366f1';
        document.getElementById('cat-icon').value = '';
      }
    } else {
      document.getElementById('cat-modal-title').textContent = editId ? '编辑标签' : '新建标签';
      iconGroup.style.display = 'none';
      if (editId) {
        const tag = store.tags.find(t => t.id === editId);
        if (tag) {
          document.getElementById('cat-name').value = tag.name;
          document.getElementById('cat-color').value = tag.color;
        }
      } else {
        document.getElementById('cat-name').value = '';
        document.getElementById('cat-color').value = '#6366f1';
      }
    }

    this.overlay.classList.add('show');
  }

  closeModal() {
    this.overlay.classList.remove('show');
    this.editingType = null;
    this.editingId = null;
  }

  async save() {
    const name = document.getElementById('cat-name').value.trim();
    if (!name) return;

    const color = document.getElementById('cat-color').value;

    if (this.editingType === 'category') {
      const icon = document.getElementById('cat-icon').value || '📁';
      if (this.editingId) {
        await store.updateCategory(this.editingId, { name, color, icon });
      } else {
        await store.addCategory({ name, color, icon });
      }
    } else {
      if (this.editingId) {
        await store.updateTag(this.editingId, { name, color });
      } else {
        await store.addTag({ name, color });
      }
    }

    this.closeModal();
    this.refresh();
  }
}

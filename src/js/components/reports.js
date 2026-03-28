// ===== Reports Component =====

class ReportsComponent {
  constructor() {
    this.charts = {};

    // Tab switching
    document.querySelectorAll('[data-report]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-report]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.report-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`report-${tab.dataset.report}`).classList.add('active');
        this.refresh();
      });
    });
  }

  refresh() {
    const activeTab = document.querySelector('[data-report].active')?.dataset.report;
    if (activeTab === 'daily') this.renderDaily();
    else if (activeTab === 'weekly') this.renderWeekly();
    else if (activeTab === 'accuracy') this.renderAccuracy();
  }

  renderDaily() {
    const today = todayString();
    const todayTasks = store.tasks.filter(t =>
      t.completedAt && t.completedAt.startsWith(today)
    );

    const totalMinutes = todayTasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);
    const tasksWithEstimate = todayTasks.filter(t => t.estimatedMinutes > 0 && t.actualMinutes > 0);

    document.getElementById('daily-completed').textContent = todayTasks.length;
    document.getElementById('daily-total-time').textContent = formatMinutes(totalMinutes);

    if (tasksWithEstimate.length > 0) {
      const avgAccuracy = tasksWithEstimate.reduce((sum, t) => {
        const ratio = Math.min(t.estimatedMinutes, t.actualMinutes) / Math.max(t.estimatedMinutes, t.actualMinutes);
        return sum + ratio;
      }, 0) / tasksWithEstimate.length;

      const avgDeviation = tasksWithEstimate.reduce((sum, t) => {
        return sum + Math.abs(t.actualMinutes - t.estimatedMinutes);
      }, 0) / tasksWithEstimate.length;

      document.getElementById('daily-accuracy').textContent = Math.round(avgAccuracy * 100) + '%';
      document.getElementById('daily-deviation').textContent = `±${formatMinutes(avgDeviation)}`;
    } else {
      document.getElementById('daily-accuracy').textContent = '-';
      document.getElementById('daily-deviation').textContent = '-';
    }

    // Bar chart - today's tasks
    this.renderDailyChart(todayTasks);

    // Task list
    const listEl = document.getElementById('daily-tasks-list');
    listEl.innerHTML = todayTasks.map(t => `
      <div class="daily-task-item">
        <span class="daily-task-name">${escapeHtml(t.title)}</span>
        <div class="daily-task-times">
          <span class="daily-task-estimated">预估 ${formatMinutes(t.estimatedMinutes)}</span>
          <span class="daily-task-actual">实际 ${formatMinutes(t.actualMinutes)}</span>
        </div>
      </div>
    `).join('') || '<p style="color:var(--text-muted);text-align:center;padding:40px;">今日暂无已完成任务</p>';
  }

  renderDailyChart(tasks) {
    if (this.charts.daily) this.charts.daily.destroy();
    const canvas = document.getElementById('chart-daily');
    if (!canvas || tasks.length === 0) return;

    const labels = tasks.map(t => t.title.length > 12 ? t.title.slice(0, 12) + '...' : t.title);

    this.charts.daily = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '预估 (分钟)',
            data: tasks.map(t => t.estimatedMinutes || 0),
            backgroundColor: 'rgba(99, 102, 241, 0.6)',
            borderColor: 'rgba(99, 102, 241, 1)',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: '实际 (分钟)',
            data: tasks.map(t => t.actualMinutes || 0),
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#9898b0', font: { family: 'Inter' } }
          }
        },
        scales: {
          x: {
            ticks: { color: '#9898b0', font: { family: 'Inter' } },
            grid: { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
            ticks: { color: '#9898b0', font: { family: 'Inter' } },
            grid: { color: 'rgba(255,255,255,0.04)' }
          }
        }
      }
    });
  }

  renderWeekly() {
    const weekTasks = store.getTasksForWeek();
    const totalMinutes = weekTasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);

    document.getElementById('weekly-completed').textContent = weekTasks.length;
    document.getElementById('weekly-total-time').textContent = formatMinutes(totalMinutes);

    this.renderWeeklyTrend(weekTasks);
    this.renderCategoryPie(weekTasks);
  }

  renderWeeklyTrend(weekTasks) {
    if (this.charts.weeklyTrend) this.charts.weeklyTrend.destroy();
    const canvas = document.getElementById('chart-weekly-trend');
    if (!canvas) return;

    const days = getWeekDays();
    const dailyMinutes = days.map(day => {
      const dayTasks = weekTasks.filter(t => t.completedAt && t.completedAt.startsWith(day.date));
      return dayTasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);
    });

    this.charts.weeklyTrend = new Chart(canvas, {
      type: 'line',
      data: {
        labels: days.map(d => d.label),
        datasets: [{
          label: '用时 (分钟)',
          data: dailyMinutes,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#6366f1',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { ticks: { color: '#9898b0' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#9898b0' }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true }
        }
      }
    });
  }

  renderCategoryPie(weekTasks) {
    if (this.charts.categoryPie) this.charts.categoryPie.destroy();
    const canvas = document.getElementById('chart-category-pie');
    if (!canvas) return;

    const catMinutes = {};
    weekTasks.forEach(t => {
      const cat = store.getCategory(t.categoryId);
      const name = cat ? cat.name : '未分类';
      catMinutes[name] = (catMinutes[name] || 0) + (t.actualMinutes || 0);
    });

    const labels = Object.keys(catMinutes);
    const data = Object.values(catMinutes);
    const colors = labels.map(name => {
      const cat = store.categories.find(c => c.name === name);
      return cat ? cat.color : '#6b7280';
    });

    if (labels.length === 0) return;

    this.charts.categoryPie = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.map(c => c + '90'),
          borderColor: colors,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#9898b0', font: { family: 'Inter' }, padding: 16 }
          }
        }
      }
    });
  }

  renderAccuracy() {
    const completed = store.getCompletedTasks()
      .filter(t => t.estimatedMinutes > 0 && t.actualMinutes > 0);

    this.renderScatterChart(completed);
    this.renderAccuracyTrend(completed);
  }

  renderScatterChart(tasks) {
    if (this.charts.scatter) this.charts.scatter.destroy();
    const canvas = document.getElementById('chart-scatter');
    if (!canvas || tasks.length === 0) return;

    const scatterData = tasks.map(t => ({
      x: t.estimatedMinutes,
      y: t.actualMinutes
    }));

    const maxVal = Math.max(
      ...tasks.map(t => Math.max(t.estimatedMinutes, t.actualMinutes))
    ) * 1.2;

    this.charts.scatter = new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: '任务',
            data: scatterData,
            backgroundColor: 'rgba(99, 102, 241, 0.6)',
            borderColor: 'rgba(99, 102, 241, 1)',
            pointRadius: 6,
            pointHoverRadius: 8
          },
          {
            label: '理想线 (预估=实际)',
            data: [{ x: 0, y: 0 }, { x: maxVal, y: maxVal }],
            type: 'line',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderDash: [5, 5],
            borderWidth: 1,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#9898b0', font: { family: 'Inter' } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `预估: ${ctx.parsed.x}m, 实际: ${ctx.parsed.y}m`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: '预估时间 (分钟)', color: '#9898b0' },
            ticks: { color: '#9898b0' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            min: 0
          },
          y: {
            title: { display: true, text: '实际时间 (分钟)', color: '#9898b0' },
            ticks: { color: '#9898b0' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            min: 0
          }
        }
      }
    });
  }

  renderAccuracyTrend(tasks) {
    if (this.charts.accuracyTrend) this.charts.accuracyTrend.destroy();
    const canvas = document.getElementById('chart-accuracy-trend');
    if (!canvas || tasks.length === 0) return;

    // Sort by completion date
    const sorted = [...tasks].sort((a, b) =>
      new Date(a.completedAt) - new Date(b.completedAt)
    );

    // Calculate rolling accuracy (window of 5)
    const windowSize = Math.min(5, sorted.length);
    const accuracyData = sorted.map((task, idx) => {
      const start = Math.max(0, idx - windowSize + 1);
      const window = sorted.slice(start, idx + 1);
      const avgAccuracy = window.reduce((sum, t) => {
        return sum + Math.min(t.estimatedMinutes, t.actualMinutes) / Math.max(t.estimatedMinutes, t.actualMinutes);
      }, 0) / window.length;
      return Math.round(avgAccuracy * 100);
    });

    this.charts.accuracyTrend = new Chart(canvas, {
      type: 'line',
      data: {
        labels: sorted.map((t, i) => `#${i + 1}`),
        datasets: [{
          label: '准确度 (%)',
          data: accuracyData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            title: { display: true, text: '任务序号', color: '#9898b0' },
            ticks: { color: '#9898b0' },
            grid: { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
            title: { display: true, text: '准确度 (%)', color: '#9898b0' },
            ticks: { color: '#9898b0' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            min: 0,
            max: 100
          }
        }
      }
    });
  }
}

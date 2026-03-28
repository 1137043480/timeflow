// ===== Timer Component =====

class Timer {
  constructor() {
    this.activeTaskId = null;
    this.startTime = null;
    this.elapsedSeconds = 0;
    this.intervalId = null;
    this.accumulatedSeconds = 0; // from previous sessions
  }

  startTask(taskId) {
    const task = store.getTask(taskId);
    if (!task) return;

    // If another task is running, pause it
    if (this.activeTaskId && this.activeTaskId !== taskId) {
      this.pauseTask();
    }

    // Calculate accumulated time from previous sessions
    this.accumulatedSeconds = (task.timerSessions || [])
      .reduce((sum, s) => sum + (s.duration || 0), 0);

    this.activeTaskId = taskId;
    this.startTime = Date.now();

    // Update task status
    if (task.status === 'todo') {
      store.updateTask(taskId, {
        status: 'in-progress',
        startedAt: task.startedAt || new Date().toISOString()
      });
    }

    this.startInterval();
    taskList.refresh();
  }

  startInterval() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  tick() {
    if (!this.startTime) return;
    const currentSessionSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    this.elapsedSeconds = this.accumulatedSeconds + currentSessionSeconds;

    const task = store.getTask(this.activeTaskId);
    if (!task) return;

    // Update sidebar timer
    sidebar.showTimer(task.title, formatTimer(this.elapsedSeconds));

    // Check notifications
    notificationManager.checkTimerNotification(task, this.elapsedSeconds);

    // Update the card if visible
    const card = document.querySelector(`[data-task-id="${this.activeTaskId}"] .task-time-actual`);
    if (card) {
      card.textContent = formatTimer(this.elapsedSeconds);
    }

    // Update time bar
    if (task.estimatedMinutes > 0) {
      const ratio = (this.elapsedSeconds / 60) / task.estimatedMinutes;
      const barFill = document.querySelector(`[data-task-id="${this.activeTaskId}"] .task-time-bar-fill`);
      if (barFill) {
        barFill.style.width = Math.min(ratio * 100, 100) + '%';
        barFill.className = 'task-time-bar-fill ' + (ratio > 1 ? 'over' : ratio > 0.8 ? 'near' : 'under');
      }
    }
  }

  pauseTask() {
    if (!this.activeTaskId || !this.startTime) return;

    const currentSessionSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const task = store.getTask(this.activeTaskId);

    if (task) {
      const sessions = [...(task.timerSessions || []), {
        start: new Date(this.startTime).toISOString(),
        end: new Date().toISOString(),
        duration: currentSessionSeconds
      }];

      const totalSeconds = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

      store.updateTask(this.activeTaskId, {
        timerSessions: sessions,
        actualMinutes: Math.round(totalSeconds / 60)
      });
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
    this.activeTaskId = null;
    this.startTime = null;
    this.elapsedSeconds = 0;
    this.accumulatedSeconds = 0;

    sidebar.hideTimer();
    taskList.refresh();
  }

  async completeTask(taskId) {
    // If this is the active task, save session first
    if (this.activeTaskId === taskId && this.startTime) {
      const currentSessionSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      const task = store.getTask(taskId);

      if (task) {
        const sessions = [...(task.timerSessions || []), {
          start: new Date(this.startTime).toISOString(),
          end: new Date().toISOString(),
          duration: currentSessionSeconds
        }];

        const totalSeconds = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

        await store.updateTask(taskId, {
          timerSessions: sessions,
          actualMinutes: Math.round(totalSeconds / 60),
          status: 'completed',
          completedAt: new Date().toISOString()
        });
      }

      clearInterval(this.intervalId);
      this.intervalId = null;
      this.activeTaskId = null;
      this.startTime = null;
      this.elapsedSeconds = 0;
      this.accumulatedSeconds = 0;
      sidebar.hideTimer();
    } else {
      // Complete without active timing
      const task = store.getTask(taskId);
      if (task) {
        const totalSeconds = (task.timerSessions || []).reduce((sum, s) => sum + (s.duration || 0), 0);
        await store.updateTask(taskId, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          actualMinutes: Math.round(totalSeconds / 60) || task.actualMinutes || 0
        });
      }
    }

    notificationManager.clearTask(taskId);

    const completedTask = store.getTask(taskId);
    if (completedTask && completedTask.estimatedMinutes > 0 && completedTask.actualMinutes > 0) {
      const ratio = completedTask.actualMinutes / completedTask.estimatedMinutes;
      let msg = '';
      if (ratio > 1.2) {
        msg = `实际用时比预估多了 ${Math.round((ratio - 1) * 100)}%`;
      } else if (ratio < 0.8) {
        msg = `实际用时比预估少了 ${Math.round((1 - ratio) * 100)}%`;
      } else {
        msg = '预估非常准确！';
      }
      window.api.showNotification('✅ 任务完成', `「${completedTask.title}」${msg}`);
    }

    taskList.refresh();
  }
}

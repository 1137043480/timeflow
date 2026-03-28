// ===== Notification Manager =====

class NotificationManager {
  constructor() {
    this._notifiedTasks = new Set();
  }

  async notify(title, body) {
    try {
      await window.api.showNotification(title, body);
    } catch (e) {
      console.warn('Notification failed:', e);
    }
  }

  // Check if running timer task needs notification
  checkTimerNotification(task, elapsedSeconds) {
    if (!task || !task.estimatedMinutes) return;

    const estimatedSeconds = task.estimatedMinutes * 60;
    const percent = (elapsedSeconds / estimatedSeconds) * 100;

    const key80 = `${task.id}-80`;
    const key100 = `${task.id}-100`;

    if (percent >= 80 && percent < 100 && !this._notifiedTasks.has(key80)) {
      if (store.settings.notifyAt80Percent) {
        this.notify(
          '⏰ 时间提醒',
          `「${task.title}」已用时 ${Math.round(percent)}%，预估时间 ${formatMinutes(task.estimatedMinutes)}`
        );
        this._notifiedTasks.add(key80);
      }
    }

    if (percent >= 100 && !this._notifiedTasks.has(key100)) {
      if (store.settings.notifyAt100Percent) {
        this.notify(
          '⚠️ 超时提醒',
          `「${task.title}」已超过预估时间 ${formatMinutes(task.estimatedMinutes)}！`
        );
        this._notifiedTasks.add(key100);
      }
    }
  }

  clearTask(taskId) {
    this._notifiedTasks.delete(`${taskId}-80`);
    this._notifiedTasks.delete(`${taskId}-100`);
  }
}

const notificationManager = new NotificationManager();

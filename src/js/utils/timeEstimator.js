// ===== AI Time Estimator =====
// Combines local statistical analysis with LLM-powered estimation

class TimeEstimator {
  /**
   * Local algorithm: weighted moving average of historical estimation accuracy
   * for similar tasks (same category/tags)
   */
  localEstimate(taskTitle, categoryId, tagIds = []) {
    const completed = store.getCompletedTasks();
    if (completed.length < 3) return null;

    // Find similar tasks
    let similar = completed.filter(t => t.estimatedMinutes > 0 && t.actualMinutes > 0);

    // Score similarity
    const scored = similar.map(t => {
      let score = 0;
      if (t.categoryId === categoryId) score += 3;
      if (t.tags) {
        const commonTags = t.tags.filter(tag => tagIds.includes(tag));
        score += commonTags.length;
      }
      // Title keyword matching
      const titleWords = taskTitle.toLowerCase().split(/\s+/);
      const matchWords = titleWords.filter(w =>
        w.length > 1 && t.title.toLowerCase().includes(w)
      );
      score += matchWords.length * 0.5;
      return { ...t, similarityScore: score };
    });

    // Filter to at least somewhat similar tasks
    let relevantTasks = scored.filter(t => t.similarityScore >= 1);
    if (relevantTasks.length < 3) relevantTasks = scored;
    if (relevantTasks.length < 3) return null;

    // Sort by recency and similarity
    relevantTasks.sort((a, b) => {
      const scoreCompare = b.similarityScore - a.similarityScore;
      if (scoreCompare !== 0) return scoreCompare;
      return new Date(b.completedAt) - new Date(a.completedAt);
    });

    // Take top 10 most relevant
    relevantTasks = relevantTasks.slice(0, 10);

    // Calculate weighted average of actual/estimated ratio
    let totalWeight = 0;
    let weightedRatioSum = 0;
    const now = new Date();

    relevantTasks.forEach((task, idx) => {
      const ratio = task.actualMinutes / task.estimatedMinutes;
      const daysAgo = (now - new Date(task.completedAt)) / (1000 * 60 * 60 * 24);
      const recencyWeight = 1 / (1 + daysAgo * 0.05);
      const similarityWeight = task.similarityScore;
      const weight = recencyWeight * similarityWeight;

      totalWeight += weight;
      weightedRatioSum += ratio * weight;
    });

    const avgRatio = weightedRatioSum / totalWeight;

    // Calculate standard deviation for confidence
    let varianceSum = 0;
    relevantTasks.forEach(task => {
      const ratio = task.actualMinutes / task.estimatedMinutes;
      varianceSum += Math.pow(ratio - avgRatio, 2);
    });
    const stdDev = Math.sqrt(varianceSum / relevantTasks.length);

    const confidence = stdDev < 0.2 ? '高' : stdDev < 0.5 ? '中' : '低';

    // Determine bias direction
    let biasText = '';
    const biasPercent = Math.round((avgRatio - 1) * 100);
    if (biasPercent > 10) {
      biasText = `你通常低估约 ${biasPercent}% 的时间`;
    } else if (biasPercent < -10) {
      biasText = `你通常高估约 ${Math.abs(biasPercent)}% 的时间`;
    } else {
      biasText = '你的时间预估比较准确';
    }

    return {
      avgRatio,
      confidence,
      biasText,
      sampleSize: relevantTasks.length,
      adjustmentFactor: avgRatio
    };
  }

  /**
   * LLM-enhanced estimation using the configured API
   */
  async llmEstimate(taskTitle, taskDesc, categoryId, tagIds = []) {
    const completed = store.getCompletedTasks();
    const category = store.getCategory(categoryId);
    const tags = tagIds.map(id => store.tags.find(t => t.id === id)?.name).filter(Boolean);

    // Build context with historical data summary
    const historyByCategory = {};
    completed.forEach(t => {
      if (t.estimatedMinutes > 0 && t.actualMinutes > 0) {
        const cat = store.getCategory(t.categoryId)?.name || '未分类';
        if (!historyByCategory[cat]) historyByCategory[cat] = [];
        historyByCategory[cat].push({
          title: t.title,
          estimated: t.estimatedMinutes,
          actual: t.actualMinutes,
          ratio: (t.actualMinutes / t.estimatedMinutes).toFixed(2)
        });
      }
    });

    // Keep only recent history to fit context
    Object.keys(historyByCategory).forEach(cat => {
      historyByCategory[cat] = historyByCategory[cat].slice(-10);
    });

    const localResult = this.localEstimate(taskTitle, categoryId, tagIds);

    const prompt = `请预估以下任务需要的时间。

任务标题：${taskTitle}
任务描述：${taskDesc || '无'}
分类：${category?.name || '未分类'}
标签：${tags.length > 0 ? tags.join(', ') : '无'}

=== 用户历史数据 ===
${Object.entries(historyByCategory).map(([cat, tasks]) =>
  `【${cat}】\n${tasks.map(t =>
    `  - "${t.title}": 预估${t.estimated}分钟, 实际${t.actual}分钟 (比率=${t.ratio})`
  ).join('\n')}`
).join('\n\n')}

${localResult ? `\n=== 统计分析 ===\n- 平均预估偏差率: ${localResult.avgRatio.toFixed(2)}\n- ${localResult.biasText}\n- 样本数: ${localResult.sampleSize}` : '历史数据不足，无统计分析'}

请综合考虑任务复杂度和用户的历史预估偏差，给出你的预估。`;

    const result = await window.api.llmEstimate(prompt);
    return result;
  }
}

const timeEstimator = new TimeEstimator();

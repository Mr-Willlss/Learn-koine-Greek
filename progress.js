// progress.js — shared localStorage progress utilities (no modules)
(function(){
  const KEY = 'koine_progress';
  const XP_KEY = 'koine_xp';
  const QUEST_KEY = 'koine_quests';

  function safeJsonParse(text, fallback){
    try{ return JSON.parse(text); }catch(_){ return fallback; }
  }

  function getProgress(){
    const raw = localStorage.getItem(KEY);
    const obj = raw ? safeJsonParse(raw, {}) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  }

  function saveProgress(progress){
    localStorage.setItem(KEY, JSON.stringify(progress || {}));
  }

  function isLessonComplete(lessonId){
    const p = getProgress();
    const row = p[String(lessonId)];
    return !!(row && row.completed === true);
  }

  function markLessonComplete(lessonId, score, xpEarned){
    const id = String(Number(lessonId));
    const pct = Number.isFinite(score) ? Math.round(score) : 0;
    const xp = Number.isFinite(xpEarned) ? Math.round(xpEarned) : 0;
    const progress = getProgress();
    progress[id] = {
      completed: pct >= 60,
      completedAt: Date.now(),
      score: pct,
      xpEarned: xp
    };
    saveProgress(progress);
    if (xp) localStorage.setItem(XP_KEY, String(getTotalXP()));
    return progress[id];
  }

  function getUnlockedLessons(){
    const unlocked = [1];
    const p = getProgress();
    for (let i = 2; i <= 24; i++) {
      const prev = p[String(i-1)];
      const ok = !!(prev && prev.completed === true && Number(prev.score || 0) >= 60);
      if (ok) unlocked.push(i);
      else break;
    }
    return unlocked;
  }

  function getTotalXP(){
    const p = getProgress();
    let sum = 0;
    Object.keys(p).forEach(k => {
      const row = p[k] || {};
      if (row.completed) sum += Number(row.xpEarned || 0) || 0;
    });
    const quests = safeJsonParse(localStorage.getItem(QUEST_KEY) || '{}', {});
    if (quests && typeof quests === 'object') {
      Object.keys(quests).forEach(id => {
        const q = quests[id] || {};
        if (q.completed) sum += Number(q.xpEarned || 0) || 0;
      });
    }
    return sum;
  }

  // Expose API
  window.getProgress = getProgress;
  window.markLessonComplete = markLessonComplete;
  window.isLessonComplete = isLessonComplete;
  window.getUnlockedLessons = getUnlockedLessons;
  window.getTotalXP = getTotalXP;
  window.Progress = { getProgress, markLessonComplete, isLessonComplete, getUnlockedLessons, getTotalXP };
})();


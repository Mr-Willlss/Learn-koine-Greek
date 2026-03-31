// Map rendering redesigned as layered world cards with animated lesson lanes.
function renderMap(progress) {
  const map = document.getElementById("world-map");
  if (!map || !window.lessonData || !Array.isArray(lessonData.worlds)) return;
  map.innerHTML = "";

  const worldsWrap = document.createElement("div");
  worldsWrap.className = "worlds";
  const worldAccents = [
    { primary: "#ffbf5f", secondary: "#ff7a59" },
    { primary: "#74d5ff", secondary: "#4d8dff" },
    { primary: "#87e78e", secondary: "#2fb56f" },
    { primary: "#d0a2ff", secondary: "#8b5cf6" },
    { primary: "#ff9ab7", secondary: "#ff5f6d" }
  ];

  const flatLessons = [];
  lessonData.worlds.forEach((world) => {
    world.lessons.forEach((lesson) => flatLessons.push({ lesson, world }));
  });

  lessonData.worlds.forEach((world, worldIndex) => {
    const accent = worldAccents[worldIndex % worldAccents.length];
    const completedLessons = world.lessons.filter((lesson) => progress.completedLessons.includes(lesson.id));
    const completedCount = completedLessons.length;
    const totalXp = world.lessons.reduce((sum, lesson) => sum + (lesson.xp || 0), 0);
    const earnedXp = completedLessons.reduce((sum, lesson) => sum + (lesson.xp || 0), 0);
    const pct = world.lessons.length ? Math.round((completedCount / world.lessons.length) * 100) : 0;
    const nextLesson = world.lessons.find((lesson) => !progress.completedLessons.includes(lesson.id)) || null;

    const card = document.createElement("section");
    card.className = "world-card";
    card.style.setProperty("--world-accent", accent.primary);
    card.style.setProperty("--world-accent-2", accent.secondary);
    card.innerHTML = `
      <div class="world-card__ambient" aria-hidden="true">
        <span class="world-card__orb world-card__orb--a"></span>
        <span class="world-card__orb world-card__orb--b"></span>
        <span class="world-card__orb world-card__orb--c"></span>
      </div>
      <div class="world-card__header">
        <div class="world-card__intro">
          <p class="eyebrow">World ${worldIndex + 1}</p>
          <h3>${world.title}</h3>
          <p class="world-card__subtitle">${world.lessons.length} lesson steps on this path.</p>
          <div class="world-card__chips">
            <span class="world-card__chip">${completedCount}/${world.lessons.length} cleared</span>
            <span class="world-card__chip">${earnedXp}/${totalXp} XP banked</span>
            <span class="world-card__chip">${nextLesson ? `Up next: ${nextLesson.title}` : "World mastered"}</span>
          </div>
        </div>
        <div class="world-card__progress">
          <span class="world-card__pct">${pct}% complete</span>
          <div class="world-card__bar"><span style="width:${pct}%"></span></div>
        </div>
      </div>
    `;

    const trail = document.createElement("div");
    trail.className = "world-trail";
    const trailLine = document.createElement("div");
    trailLine.className = "world-trail__line";
    trail.appendChild(trailLine);

    world.lessons.forEach((lesson, lessonIndex) => {
      const chip = document.createElement("button");
      chip.className = "level-node";
      const flatIndex = flatLessons.findIndex((entry) => entry.lesson.id === lesson.id);
      const previous = flatLessons[flatIndex - 1];
      const unlocked = flatIndex === 0 || progress.completedLessons.includes(previous?.lesson?.id);
      const completed = progress.completedLessons.includes(lesson.id);
      const isCurrent = unlocked && !completed;
      const laneOffsets = [0, 84, -84, 84, 0];
      const status = completed ? "Cleared" : isCurrent ? "Play now" : unlocked ? "Ready" : "Locked";
      chip.style.setProperty("--lane-offset", `${laneOffsets[lessonIndex % laneOffsets.length]}px`);

      chip.classList.add(unlocked ? "unlocked" : "locked");
      if (completed) chip.classList.add("completed");
      if (isCurrent) chip.classList.add("current");
      chip.setAttribute("type", "button");
      chip.setAttribute("aria-label", `${lesson.title}, ${lesson.xp} XP, ${status}`);
      chip.innerHTML = `
        <span class="level-node__rail" aria-hidden="true"></span>
        <span class="level-node__core">${lessonIndex + 1}</span>
        <span class="level-node__body">
          <span class="level-node__label">${lesson.title}</span>
          <span class="level-node__meta">
            <span class="level-node__status">${status}</span>
            <span class="level-node__xp">${lesson.xp} XP</span>
          </span>
        </span>
      `;

      chip.addEventListener("click", () => {
        if (!unlocked) return;
        startLesson(lesson, world);
      });
      trail.appendChild(chip);
    });

    card.appendChild(trail);
    worldsWrap.appendChild(card);
  });

  map.appendChild(worldsWrap);
}

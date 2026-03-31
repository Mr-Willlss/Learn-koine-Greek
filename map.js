// Map rendering redesigned as world cards with level chips.
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

  // Build a flattened lessons array without flatMap for wider compatibility.
  const flatLessons = [];
  lessonData.worlds.forEach((w) => {
    w.lessons.forEach((l) => flatLessons.push(l));
  });

  lessonData.worlds.forEach((world, worldIndex) => {
    const card = document.createElement("div");
    card.className = "world-card";
    const accent = worldAccents[worldIndex % worldAccents.length];
    card.style.setProperty("--world-accent", accent.primary);
    card.style.setProperty("--world-accent-2", accent.secondary);

    const header = document.createElement("div");
    header.className = "world-card__header";
    header.innerHTML = `
      <div class="world-card__intro">
        <p class="eyebrow">World ${worldIndex + 1}</p>
        <h3>${world.title}</h3>
        <p class="world-card__subtitle">${world.lessons.length} lesson steps on this path.</p>
      </div>
    `;

    const worldLessons = world.lessons;
    const completedCount = worldLessons.filter((l) => progress.completedLessons.includes(l.id)).length;
    const pct = Math.round((completedCount / worldLessons.length) * 100);
    const bar = document.createElement("div");
    bar.className = "world-card__progress";
    bar.innerHTML = `
      <span class="world-card__pct">${pct}% complete</span>
      <div class="world-card__bar"><span style="width:${pct}%"></span></div>
    `;

    header.appendChild(bar);
    card.appendChild(header);

    const trail = document.createElement("div");
    trail.className = "world-trail";
    const trailLine = document.createElement("div");
    trailLine.className = "world-trail__line";
    trail.appendChild(trailLine);

    worldLessons.forEach((lesson, lessonIndex) => {
      const chip = document.createElement("button");
      chip.className = "level-node";
      const flatIndex = flatLessons.findIndex((l) => l.id === lesson.id);
      const prev = flatLessons[flatIndex - 1];
      const unlocked = flatIndex === 0 || progress.completedLessons.includes(prev?.id);
      const completed = progress.completedLessons.includes(lesson.id);
      const isCurrent = unlocked && !completed;
      const laneOffsets = [0, 60, -60, 60, 0];
      chip.style.setProperty("--lane-offset", `${laneOffsets[lessonIndex % laneOffsets.length]}px`);

      chip.classList.add(unlocked ? "unlocked" : "locked");
      if (completed) chip.classList.add("completed");
      if (isCurrent) chip.classList.add("current");
      chip.setAttribute("type", "button");
      chip.setAttribute("aria-label", `${lesson.title}, ${lesson.xp} XP`);
      chip.innerHTML = `
        <span class="level-node__core">${lessonIndex + 1}</span>
        <span class="level-node__label">${lesson.title}</span>
        <span class="level-node__xp">${lesson.xp} XP</span>
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

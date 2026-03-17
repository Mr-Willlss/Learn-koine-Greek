// Map rendering redesigned as world cards with level chips.
function renderMap(progress) {
  const map = document.getElementById("world-map");
  if (!map || !window.lessonData || !Array.isArray(lessonData.worlds)) return;
  map.innerHTML = "";

  const worldsWrap = document.createElement("div");
  worldsWrap.className = "worlds";

  // Build a flattened lessons array without flatMap for wider compatibility.
  const flatLessons = [];
  lessonData.worlds.forEach((w) => {
    w.lessons.forEach((l) => flatLessons.push(l));
  });

  lessonData.worlds.forEach((world, worldIndex) => {
    const card = document.createElement("div");
    card.className = "world-card";

    const header = document.createElement("div");
    header.className = "world-card__header";
    header.innerHTML = `<div><p class="eyebrow">World ${worldIndex + 1}</p><h3>${world.title}</h3></div>`;

    const worldLessons = world.lessons;
    const completedCount = worldLessons.filter((l) => progress.completedLessons.includes(l.id)).length;
    const pct = Math.round((completedCount / worldLessons.length) * 100);
    const bar = document.createElement("div");
    bar.className = "world-card__progress";
    bar.innerHTML = `<div class="world-card__bar"><span style="width:${pct}%"></span></div><span class="world-card__pct">${pct}%</span>`;

    header.appendChild(bar);
    card.appendChild(header);

    const levelGrid = document.createElement("div");
    levelGrid.className = "level-grid";

    worldLessons.forEach((lesson, lessonIndex) => {
      const chip = document.createElement("button");
      chip.className = "level-chip";
      const flatIndex = flatLessons.findIndex((l) => l.id === lesson.id);
      const prev = flatLessons[flatIndex - 1];
      const unlocked = flatIndex === 0 || progress.completedLessons.includes(prev?.id);
      const completed = progress.completedLessons.includes(lesson.id);

      chip.classList.add(unlocked ? "unlocked" : "locked");
      if (completed) chip.classList.add("completed");
      chip.textContent = lesson.title;
      chip.addEventListener("click", () => {
        if (!unlocked) return;
        startLesson(lesson, world);
      });
      levelGrid.appendChild(chip);
    });

    card.appendChild(levelGrid);
    worldsWrap.appendChild(card);
  });

  map.appendChild(worldsWrap);
}

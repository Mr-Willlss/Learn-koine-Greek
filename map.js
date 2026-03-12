// Map rendering with lesson bubbles and connectors.
function renderMap(progress) {
  const map = document.getElementById("world-map");
  map.innerHTML = "";
  const bubbles = [];

  lessonData.worlds.forEach((world, worldIndex) => {
    world.lessons.forEach((lesson, lessonIndex) => {
      const bubble = document.createElement("div");
      bubble.className = "lesson-bubble";
      const unlocked = progress.completedLessons.length >= bubbles.length;
      bubble.classList.add(unlocked ? "unlocked" : "locked");
      if (progress.completedLessons.includes(lesson.id)) {
        bubble.classList.add("completed");
      }
      bubble.textContent = lesson.title;
      bubble.style.top = `${40 + (worldIndex * 90) + (lessonIndex * 20)}px`;
      bubble.style.left = `${60 + (lessonIndex * 120)}px`;
      bubble.addEventListener("click", () => {
        if (!unlocked) {
          return;
        }
        startLesson(lesson, world);
      });
      map.appendChild(bubble);
      bubbles.push(bubble);
    });
  });

  // Simple connector paths.
  bubbles.forEach((bubble, index) => {
    if (index === 0) {
      return;
    }
    const prev = bubbles[index - 1];
    const path = document.createElement("div");
    path.className = "map-path";
    const x1 = prev.offsetLeft + 32;
    const y1 = prev.offsetTop + 32;
    const x2 = bubble.offsetLeft + 32;
    const y2 = bubble.offsetTop + 32;
    const height = Math.abs(y2 - y1);
    path.style.height = `${Math.max(height, 60)}px`;
    path.style.left = `${Math.min(x1, x2)}px`;
    path.style.top = `${Math.min(y1, y2)}px`;
    map.appendChild(path);
  });
}

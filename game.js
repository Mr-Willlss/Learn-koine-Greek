// Main game state and UI handlers.
let vocabDatabase = [];
let currentLesson = null;
let currentExerciseIndex = 0;
let currentSelection = null;`nlet lessonXpEarned = 0;

const progressState = {
  xp: 0,
  level: 1,
  hearts: 5,
  completedLessons: [],
  vocabProgress: {}
};

function toast(message) {
  const toastEl = document.getElementById("toast");
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2400);
}

function updateStats() {
  document.getElementById("stat-xp").textContent = `XP ${progressState.xp}`;
  document.getElementById("stat-level").textContent = `Level ${progressState.level}`;
  document.getElementById("stat-hearts").textContent = `Hearts ${progressState.hearts}`;
}

function updateProgressBar() {
  const total = lessonData.worlds.reduce((sum, w) => sum + w.lessons.length, 0);
  const completed = progressState.completedLessons.length;
  const pct = total ? Math.floor((completed / total) * 100) : 0;
  document.getElementById("progress-bar").style.width = `${pct}%`;
  document.getElementById("progress-text").textContent = `${pct}% complete`;
}

function getProgressPayload() {
  return {
    xp: progressState.xp,
    level: progressState.level,
    hearts: progressState.hearts,
    completedLessons: progressState.completedLessons,
    vocabProgress: progressState.vocabProgress,
    spacedRepetition: spacedRepetition.items
  };
}

function applyProgress(payload) {
  if (!payload) {
    return;
  }
  progressState.xp = payload.xp || 0;
  progressState.level = payload.level || 1;
  progressState.hearts = payload.hearts || 5;
  progressState.completedLessons = payload.completedLessons || [];
  progressState.vocabProgress = payload.vocabProgress || {};
  spacedRepetition.items = payload.spacedRepetition || spacedRepetition.items;
  updateStats();
  updateProgressBar();
  renderMap(progressState);
}

function saveLocalProgress() {
  localStorage.setItem("greekQuestProgress", JSON.stringify(getProgressPayload()));
  syncProgress();
}

function loadLocalProgress() {
  const raw = localStorage.getItem("greekQuestProgress");
  if (raw) {
    applyProgress(JSON.parse(raw));
  }
}

function normalizeVocabEntry(item) {
  // Support both schemas:
  // - { greek, english }
  // - { greek, meaning }
  const english = item.english || item.meaning || "";
  const transliteration = item.transliteration || item.translit || "";
  return { ...item, english, transliteration };
}

function loadVocabDatabase() {
  // Online-only: fetch from JSON.
  return fetch("vocabDatabase.json", { cache: "force-cache" })
    .then((res) => {
      if (!res.ok) {
        throw new Error("Failed to load vocabDatabase.json");
      }
      return res.json();
    })
    .then((data) => (data || []).map(normalizeVocabEntry));
}

function startLesson(lesson, world) {
  currentLesson = { ...lesson, worldId: world.id };
  currentExerciseIndex = 0;
  lessonXpEarned = 0;

  const vocabSample = vocabDatabase.slice(0, 4);
  currentLesson.exercises = shuffleArray(buildLessonExercises(lesson, vocabDatabase));

  document.getElementById("lesson-title").textContent = `${world.title} · ${lesson.title}`;
  document.getElementById("lesson-type").textContent = "Lesson";
  document.getElementById("lesson-xp").textContent = `+${lesson.xp} XP`;
  document.getElementById("check-btn").disabled = false;
  document.getElementById("hint-btn").disabled = false;
  setTeacherMood("idle");
  renderExercise();
}

function renderExercise() {
  const exercise = currentLesson.exercises[currentExerciseIndex];
  const body = document.getElementById("lesson-body");
  body.innerHTML = "";
  currentSelection = null;

  const wrapper = document.createElement("div");
  wrapper.className = "exercise";

  const prompt = document.createElement("h3");
  prompt.textContent = exercise.prompt;
  wrapper.appendChild(prompt);

  if (exercise.type === "vocab-recognition" || exercise.type === "listening") {
    const vocab = exercise.vocab || vocabDatabase[0];
    if (!vocab) {
      const fallback = document.createElement("p");
      fallback.textContent = "No vocabulary available yet.";
      wrapper.appendChild(fallback);
      body.appendChild(wrapper);
      return;
    }
    exercise.vocab = vocab;

    const playBtn = document.createElement("button");
    playBtn.className = "btn ghost";
    playBtn.textContent = "Play";
    playBtn.addEventListener("click", () => speakGreek(vocab.greek));
    wrapper.appendChild(playBtn);

    const distractors = shuffleArray(
      (vocabDatabase || [])
        .map((v) => v.english)
        .filter((word) => word && word !== vocab.english)
    ).slice(0, 3);
    const choices = shuffleArray([vocab.english, ...distractors]);

    const grid = document.createElement("div");
    grid.className = "choice-grid";
    choices.forEach((choice) => {
      const item = document.createElement("button");
      item.className = "choice";
      item.textContent = choice;
      item.addEventListener("click", () => {
        grid.querySelectorAll(".choice").forEach((c) => c.classList.remove("selected"));
        item.classList.add("selected");
        currentSelection = choice;
      });
      grid.appendChild(item);
    });
    wrapper.appendChild(grid);
  }

  if (exercise.type === "pronunciation") {
    const vocab = exercise.vocab || vocabDatabase[0];
    if (!vocab) {
      const fallback = document.createElement("p");
      fallback.textContent = "No vocabulary available yet.";
      wrapper.appendChild(fallback);
      body.appendChild(wrapper);
      return;
    }
    exercise.vocab = vocab;

    const speakBtn = document.createElement("button");
    speakBtn.className = "btn";
    speakBtn.textContent = "Speak";
    speakBtn.addEventListener("click", () => {
      listenForGreek(vocab.greek, (result) => {
        currentSelection = result;
        toast(`You said: ${result.transcript} (${result.score}%)`);
      });
    });
    wrapper.appendChild(speakBtn);
  }

  if (exercise.type === "sentence-builder") {
    const bank = document.createElement("div");
    bank.className = "drag-bank";

    const target = document.createElement("div");
    target.className = "drag-target";

    exercise.tokens.forEach((token) => {
      const chip = document.createElement("div");
      chip.className = "drag-token";
      chip.textContent = token;
      chip.addEventListener("click", () => {
        target.appendChild(chip);
      });
      bank.appendChild(chip);
    });

    wrapper.appendChild(bank);
    wrapper.appendChild(target);

    currentSelection = () => Array.from(target.children).map((c) => c.textContent).join(" ");
  }

  if (exercise.type === "translation") {
    const vocab = exercise.vocab || vocabDatabase[0];
    if (!vocab) {
      const fallback = document.createElement("p");
      fallback.textContent = "No vocabulary available yet.";
      wrapper.appendChild(fallback);
      body.appendChild(wrapper);
      return;
    }
    exercise.vocab = vocab;

    const text = document.createElement("p");
    text.textContent = `Greek: ${vocab.greek}`;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Type the translation";
    input.addEventListener("input", () => {
      currentSelection = input.value.trim();
    });

    wrapper.appendChild(text);
    wrapper.appendChild(input);
  }

  body.appendChild(wrapper);
}

function checkAnswer() {
  const exercise = currentLesson.exercises[currentExerciseIndex];
  let correct = false;

  if (exercise.type === "vocab-recognition" || exercise.type === "listening") {
    correct = currentSelection === exercise.vocab.english;
  }

  if (exercise.type === "pronunciation") {
    correct = currentSelection && currentSelection.score >= 60;
  }

  if (exercise.type === "sentence-builder") {
    correct = typeof currentSelection === "function" && currentSelection().trim() === exercise.sentence;
  }

  if (exercise.type === "translation") {
    correct = currentSelection && currentSelection.toLowerCase() === exercise.vocab.english.toLowerCase();
  }

  if (correct) {
    progressState.xp += 5;
    lessonXpEarned += 5;
    if (progressState.xp % 50 === 0) {
      progressState.level += 1;
    }
    setTeacherMood("happy");
    teacherSpeak("Great job!");
    updateSpacedRepetition(exercise.vocab?.id, true);
  } else {
    progressState.hearts = Math.max(progressState.hearts - 1, 0);
    setTeacherMood("sad");
    teacherSpeak("Try again!");
    updateSpacedRepetition(exercise.vocab?.id, false);
  }

  updateStats();
  saveLocalProgress();

  currentExerciseIndex += 1;
  if (currentExerciseIndex >= currentLesson.exercises.length) {
    finishLesson();
  } else {
    renderExercise();
  }
}

function finishLesson() {
  if (!progressState.completedLessons.includes(currentLesson.id)) {
    progressState.completedLessons.push(currentLesson.id);
    progressState.xp += currentLesson.xp;
    lessonXpEarned += currentLesson.xp;
  }

  updateStats();
  updateProgressBar();
  renderMap(progressState);
  saveLocalProgress();
  showLessonCompleteModal(lessonXpEarned);
}

function showLessonCompleteModal(xpEarned) {
  let modal = document.getElementById("lesson-complete-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "lesson-complete-modal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-card">
        <h3>Lesson Complete!</h3>
        <p class="modal-xp"></p>
        <button class="btn">Continue</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector("button").addEventListener("click", () => {
      modal.classList.remove("show");
    });
  }
  const xpText = modal.querySelector(".modal-xp");
  xpText.textContent = `You earned ${xpEarned} XP in this lesson.`;
  modal.classList.add("show");
}

function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

function registerEvents() {
  document.getElementById("check-btn").addEventListener("click", checkAnswer);
  document.getElementById("hint-btn").addEventListener("click", () => {
    toast("Hint: listen carefully to the Greek sound.");
  });
  document.getElementById("sign-in-btn").addEventListener("click", signInWithGoogle);

  document.querySelector(".logo").addEventListener("click", () => {
    document.getElementById("lesson-title").textContent = "Welcome";
    document.getElementById("lesson-type").textContent = "Choose a lesson to begin";
    document.getElementById("lesson-xp").textContent = "+0 XP";
  });
}

function initApp() {
  registerEvents();

  loadVocabDatabase()
    .then((data) => {
      vocabDatabase = data;
      initSpacedRepetition(vocabDatabase);
      loadLocalProgress();
      renderMap(progressState);
      updateStats();
      updateProgressBar();
    })
    .catch((err) => {
      console.error(err);
      toast("Failed to load vocab. Host this folder online (https://) and refresh.");
      renderMap(progressState);
      updateStats();
      updateProgressBar();
    });
}

initApp();








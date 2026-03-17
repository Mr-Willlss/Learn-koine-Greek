// Main game state and UI handlers.
let vocabDatabase = [];
let currentLesson = null;
let currentExerciseIndex = 0;
let currentSelection = null;
let lessonXpEarned = 0;
let userOptions = { sound: true, autoSave: true, brightness: "normal" };

const progressState = {
  xp: 0,
  level: 1,
  hearts: 5,
  completedLessons: [],
  vocabProgress: {}
};

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2400);
}

function ensureModalShell() {
  let modal = document.getElementById("app-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "app-modal";
    modal.className = "modal-overlay";
    modal.innerHTML = `<div class="modal-card"><h3 class="modal-title"></h3><div class="modal-body"></div><button class="btn" id="modal-close">Close</button></div>`;
    document.body.appendChild(modal);
    modal.querySelector("#modal-close").addEventListener("click", () => modal.classList.remove("show"));
  }
  return modal;
}

function showModal(title, bodyNode) {
  const modal = ensureModalShell();
  modal.querySelector(".modal-title").textContent = title;
  const body = modal.querySelector(".modal-body");
  body.innerHTML = "";
  if (bodyNode) body.appendChild(bodyNode);
  modal.classList.add("show");
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
  if (!payload) return;
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
  if (userOptions.autoSave) {
    localStorage.setItem("greekQuestProgress", JSON.stringify(getProgressPayload()));
  }
  syncProgress();
}

function loadLocalProgress() {
  const raw = localStorage.getItem("greekQuestProgress");
  if (raw) {
    applyProgress(JSON.parse(raw));
  }
}

function normalizeVocabEntry(item) {
  const english = item.english || item.meaning || "";
  const transliteration = item.transliteration || item.translit || "";
  return { ...item, english, transliteration };
}

function loadVocabDatabase() {
  return fetch("vocabDatabase.json", { cache: "force-cache" })
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load vocabDatabase.json");
      return res.json();
    })
    .then((data) => (data || []).map(normalizeVocabEntry));
}

function startLesson(lesson, world) {
  if (!requireSignIn()) return;
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
    if (!vocab) { body.textContent = "No vocab loaded."; return; }
    const playBtn = document.createElement("button");
    playBtn.className = "btn ghost";
    playBtn.textContent = "Play";
    playBtn.addEventListener("click", () => speakGreek(vocab.greek));
    wrapper.appendChild(playBtn);

    const distractors = shuffleArray((vocabDatabase || []).map((v) => v.english).filter((w) => w && w !== vocab.english)).slice(0, 3);
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
    if (!vocab) { body.textContent = "No vocab loaded."; return; }
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
    if (!vocab) { body.textContent = "No vocab loaded."; return; }
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
    if (progressState.xp % 50 === 0) progressState.level += 1;
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
  const next = getNextLesson(currentLesson.id);
  showLessonCompleteModal(lessonXpEarned, () => {
    if (next) startLesson(next.lesson, next.world);
  });
}

function showLessonCompleteModal(xpEarned, onContinue) {
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
  }
  const xpText = modal.querySelector(".modal-xp");
  xpText.textContent = `You earned ${xpEarned} XP in this lesson.`;
  const btn = modal.querySelector("button");
  btn.onclick = () => {
    modal.classList.remove("show");
    if (typeof onContinue === "function") onContinue();
  };
  modal.classList.add("show");
}

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function registerEvents() {
  const checkBtn = document.getElementById("check-btn");
  if (checkBtn) checkBtn.addEventListener("click", checkAnswer);
  const hintBtn = document.getElementById("hint-btn");
  if (hintBtn) hintBtn.addEventListener("click", showHint);
  const signInBtn = document.getElementById("sign-in-btn");
  if (signInBtn) signInBtn.addEventListener("click", openAuthModal);
  const logInBtn = document.getElementById("log-in-btn");
  if (logInBtn) logInBtn.addEventListener("click", openAuthModal);

  const mapBtn = document.getElementById("map-btn");
  if (mapBtn) mapBtn.addEventListener("click", openMapModal);
  const profileBtn = document.getElementById("profile-btn");
  if (profileBtn) profileBtn.addEventListener("click", openProfileModal);
  const optionsBtn = document.getElementById("options-btn");
  if (optionsBtn) optionsBtn.addEventListener("click", openOptionsModal);
  const contactBtn = document.getElementById("contact-btn");
  if (contactBtn) contactBtn.addEventListener("click", openContactModal);
  const aboutBtn = document.getElementById("about-btn");
  if (aboutBtn) aboutBtn.addEventListener("click", () => toast("Learn Koine Greek · prototype"));

  const resumeBtn = document.getElementById("resume-btn");
  if (resumeBtn) resumeBtn.addEventListener("click", () => { if (requireSignIn()) startNextUnlockedLesson(); });
  const startNewBtn = document.getElementById("start-new-btn");
  if (startNewBtn) startNewBtn.addEventListener("click", () => { if (requireSignIn()) startLesson(lessonData.worlds[0].lessons[0], lessonData.worlds[0]); });

  const logo = document.querySelector(".logo, .side-logo");
  if (logo) logo.addEventListener("click", () => {
    document.getElementById("lesson-title").textContent = "Welcome";
    document.getElementById("lesson-type").textContent = "Choose a lesson to begin";
    document.getElementById("lesson-xp").textContent = "+0 XP";
  });

  window.addEventListener("gq-auth-changed", handleAuthChange);
}

function showHint() {
  const ex = currentLesson?.exercises?.[currentExerciseIndex];
  if (!ex) {
    toast("Hint: pick a lesson to begin.");
    return;
  }
  if (ex.vocab) {
    const translit = ex.vocab.transliteration || "(listen for the sound)";
    toast(`Hint: ${ex.vocab.greek || "Listen"} (${translit})`);
    return;
  }
  if (ex.type === "sentence-builder" && ex.sentence) {
    toast(`Hint: Order should be "${ex.sentence}".`);
    return;
  }
  toast("Hint: listen carefully to the Greek sound.");
}

function initApp() {
  loadOptions();
  registerEvents();
  playStartupChime();
  lockUI(!isSignedIn());

  loadVocabDatabase()
    .then((data) => {
      vocabDatabase = data;
      initSpacedRepetition(vocabDatabase);
      loadLocalProgress();
      renderMap(progressState);
      updateStats();
      updateProgressBar();
      setTimeout(hideIntro, 800);
      if (!isSignedIn()) {
        openAuthModal();
        lockUI(true);
      }
    })
    .catch((err) => {
      console.error(err);
      toast("Failed to load vocab. Host this folder online (https://) and refresh.");
      renderMap(progressState);
      updateStats();
      updateProgressBar();
      setTimeout(hideIntro, 800);
      if (!isSignedIn()) {
        openAuthModal();
        lockUI(true);
      }
    });
}

document.addEventListener("DOMContentLoaded", initApp);

function startNextUnlockedLesson() {
  const flat = [];
  lessonData.worlds.forEach((w) => w.lessons.forEach((l) => flat.push({ ...l, world: w })));
  const completed = new Set(progressState.completedLessons);
  let target = flat.find((l, idx) => {
    const prev = flat[idx - 1];
    const unlocked = idx === 0 || completed.has(prev.id);
    return unlocked && !completed.has(l.id);
  });
  if (!target) target = flat[0];
  startLesson(target, target.world);
}

function getNextLesson(currentId) {
  const flat = [];
  lessonData.worlds.forEach((w) => w.lessons.forEach((l) => flat.push({ lesson: l, world: w })));
  const idx = flat.findIndex((i) => i.lesson.id === currentId);
  if (idx >= 0 && idx < flat.length - 1) {
    return flat[idx + 1];
  }
  return null;
}

function isSignedIn() {
  return typeof authState !== "undefined" && !!authState.user;
}

function requireSignIn() {
  if (isSignedIn()) return true;
  openAuthModal();
  toast("Please sign in with Google to play.");
  return false;
}

function lockUI(locked) {
  const ids = ["check-btn","hint-btn","resume-btn","start-new-btn","map-btn","profile-btn","options-btn","contact-btn","about-btn"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = locked;
  });
}

function handleAuthChange() {
  const signedIn = isSignedIn();
  lockUI(!signedIn);
  if (signedIn) {
    loadLocalProgress();
    renderMap(progressState);
    updateStats();
    updateProgressBar();
  }
}

// Modal helpers for nav buttons
function openMapModal() {
  const container = document.createElement("div");
  const flat = [];
  lessonData.worlds.forEach((w) => w.lessons.forEach((l) => flat.push({ lesson: l, world: w })));
  flat.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.className = "level-chip " + (progressState.completedLessons.includes(item.lesson.id) ? "completed" : "unlocked");
    btn.style.margin = "4px";
    btn.textContent = `${idx + 1}. ${item.lesson.title}`;
    btn.addEventListener("click", () => {
      startLesson(item.lesson, item.world);
      document.getElementById("app-modal").classList.remove("show");
    });
    container.appendChild(btn);
  });
  showModal("All Lessons", container);
}

function openProfileModal() {
  const body = document.createElement("div");
  const user = (window.firebase && window.firebase.auth && firebase.auth().currentUser) || null;
  if (user) {
    body.innerHTML = `<p><strong>Name:</strong> ${user.displayName || "Anonymous"}</p><p><strong>Email:</strong> ${user.email || "N/A"}</p>`;
  } else {
    const p = document.createElement("p");
    p.textContent = "Please sign in with Google to view your profile.";
    body.appendChild(p);
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Sign in with Google";
    btn.addEventListener("click", () => signInWithGoogle());
    body.appendChild(btn);
  }
  showModal("Profile", body);
}

function openOptionsModal() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <label><input type="checkbox" id="opt-sound"> Sound on</label><br>
    <label><input type="checkbox" id="opt-autosave"> Auto-save progress</label><br>
    <label>Brightness:
      <select id="opt-brightness">
        <option value="normal">Normal</option>
        <option value="dim">Dim</option>
      </select>
    </label>
  `;
  wrap.querySelector("#opt-sound").checked = userOptions.sound;
  wrap.querySelector("#opt-autosave").checked = userOptions.autoSave;
  wrap.querySelector("#opt-brightness").value = userOptions.brightness;
  wrap.querySelectorAll("input,select").forEach((el) => el.addEventListener("change", saveOptions));
  showModal("Settings", wrap);
}

function saveOptions() {
  const modal = document.getElementById("app-modal");
  if (!modal) return;
  userOptions.sound = modal.querySelector("#opt-sound").checked;
  userOptions.autoSave = modal.querySelector("#opt-autosave").checked;
  userOptions.brightness = modal.querySelector("#opt-brightness").value;
  localStorage.setItem("gqOptions", JSON.stringify(userOptions));
  document.body.style.filter = userOptions.brightness === "dim" ? "brightness(0.9)" : "none";
}

function loadOptions() {
  const stored = localStorage.getItem("gqOptions");
  if (stored) {
    try { userOptions = JSON.parse(stored); } catch (e) {}
  }
  document.body.style.filter = userOptions.brightness === "dim" ? "brightness(0.9)" : "none";
}

function openContactModal() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <p style="font-size:2rem">📞</p>
    <p><strong>WhatsApp:</strong> 09073638440</p>
    <p class="muted">Feel free to reach out to us incase of any bug or observed problem (note: this website is still in it's testing phase)</p>
  `;
  showModal("Contact us", wrap);
}

function openAuthModal() {
  const wrap = document.createElement("div");
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Sign in with Google";
  btn.addEventListener("click", () => {
    signInWithGoogle();
    const modal = document.getElementById("app-modal");
    if (modal) modal.classList.remove("show");
  });
  wrap.appendChild(btn);
  showModal("Login", wrap);
}

// Startup chime + intro overlay
function playStartupChime() {
  if (!userOptions.sound) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 660;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.65);
}

function hideIntro() {
  const intro = document.getElementById("intro-overlay");
  if (intro) {
    intro.classList.add("hide");
    setTimeout(() => intro.remove(), 700);
  }
}

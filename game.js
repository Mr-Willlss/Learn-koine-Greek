// Main game state and UI handlers.
let vocabDatabase = [];
let currentLesson = null;
let currentExerciseIndex = 0;
let currentSelection = null;
let lessonXpEarned = 0;
let userOptions = { sound: true, autoSave: true, brightness: 1, volume: 0.5, theme: "dark", autoHideSidebar: true };
let audioCtx = null;
let masterGain = null;
let startupPlayed = false;
let heartRefillTicker = null;

const progressState = {
  xp: 0,
  level: 1,
  hearts: 5,
  heartsUpdatedAt: Date.now(),
  exhaustedHeartTimes: [],
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

function initAudio() {
  if (audioCtx) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  audioCtx = new AudioCtx();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = userOptions.volume;
  masterGain.connect(audioCtx.destination);
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

function playTone(freq, duration = 0.2) {
  if (!userOptions.sound) return;
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = 0.0001;
  osc.connect(gain).connect(masterGain);
  const now = audioCtx.currentTime;
  gain.gain.exponentialRampToValueAtTime(userOptions.volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.start(now);
  osc.stop(now + duration + 0.05);
}

function playSequence(freqs, totalDur = 0.5) {
  if (!userOptions.sound) return;
  initAudio();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const step = totalDur / freqs.length;
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    osc.connect(gain).connect(masterGain);
    const t0 = now + i * step;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(userOptions.volume * 0.8, t0 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + step);
    osc.start(t0);
    osc.stop(t0 + step + 0.05);
  });
}

function playCorrectSound() { playSequence([523, 659, 784, 1046], 0.6); } // upbeat arpeggio
function playIncorrectSound() { playSequence([392, 330, 247], 0.45); } // descending wobble

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

function renderHeartDiagram(containerId, hearts = progressState.hearts, maxHearts = HEART_MAX) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  container.setAttribute("aria-label", `${hearts} of ${maxHearts} hearts remaining`);

  for (let i = 0; i < hearts; i += 1) {
    const heart = document.createElement("span");
    heart.className = "heart-diagram__heart is-filled";
    heart.setAttribute("aria-hidden", "true");
    heart.textContent = "♥";
    container.appendChild(heart);
  }
}

function updateStats() {
  document.getElementById("stat-xp").textContent = `XP ${progressState.xp}`;
  document.getElementById("stat-level").textContent = `Level ${progressState.level}`;
  document.getElementById("stat-hearts").textContent = `Hearts ${progressState.hearts}`;
  const heartEl = document.getElementById("lesson-hearts");
  if (heartEl) heartEl.textContent = `Hearts: ${progressState.hearts}`;
  renderHeartDiagram("lesson-hearts-diagram");
}

function setLessonActionState(disabled) {
  const checkBtn = document.getElementById("check-btn");
  const hintBtn = document.getElementById("hint-btn");
  const skipBtn = document.getElementById("skip-btn");
  if (checkBtn) checkBtn.disabled = disabled;
  if (hintBtn) hintBtn.disabled = disabled;
  if (skipBtn) skipBtn.disabled = disabled;
}

function showOutOfHeartsState() {
  const body = document.getElementById("lesson-body");
  const hintBox = document.getElementById("hero-status");
  if (hintBox) hintBox.textContent = "Out of hearts. One heart refills every 5 minutes.";
  if (!body) return;

  body.innerHTML = `
    <div class="welcome">
      <h4>Out of hearts</h4>
      <p>You need at least 1 heart to keep playing.</p>
      <p>Each exhausted heart refills after 5 minutes.</p>
    </div>
  `;
  setLessonActionState(true);
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
    heartsUpdatedAt: progressState.heartsUpdatedAt,
    exhaustedHeartTimes: progressState.exhaustedHeartTimes,
    completedLessons: progressState.completedLessons,
    vocabProgress: progressState.vocabProgress,
    spacedRepetition: spacedRepetition.items
  };
}

function applyProgress(payload) {
  if (!payload) return;
  progressState.xp = Number.isFinite(payload.xp) ? payload.xp : 0;
  progressState.level = Number.isFinite(payload.level) ? payload.level : 1;
  progressState.hearts = Number.isFinite(payload.hearts) ? payload.hearts : HEART_MAX;
  progressState.heartsUpdatedAt = Number.isFinite(payload.heartsUpdatedAt) ? payload.heartsUpdatedAt : Date.now();
  progressState.exhaustedHeartTimes = Array.isArray(payload.exhaustedHeartTimes)
    ? payload.exhaustedHeartTimes.filter((t) => Number.isFinite(t))
    : [];
  progressState.completedLessons = payload.completedLessons || [];
  progressState.vocabProgress = payload.vocabProgress || {};
  spacedRepetition.items = payload.spacedRepetition || spacedRepetition.items;
  hydrateHeartRefillState();
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
  if (!consumeHeartIfNeeded()) return;
  currentLesson = { ...lesson, worldId: world.id };
  currentExerciseIndex = 0;
  lessonXpEarned = 0;

  const vocabSample = vocabDatabase.slice(0, 4);
  currentLesson.exercises = shuffleArray(buildLessonExercises(lesson, vocabDatabase));

  document.getElementById("lesson-title").textContent = `${world.title} · ${lesson.title}`;
  document.getElementById("lesson-type").textContent = "Lesson";
  document.getElementById("lesson-xp").textContent = `+${lesson.xp} XP`;
  setLessonActionState(false);
  updateLessonProgress();
  setTeacherMood("idle");
  renderExercise();
}

function skipCurrentExercise() {
  if (!currentLesson || progressState.hearts <= 0) {
    if (progressState.hearts <= 0) showOutOfHeartsState();
    return;
  }

  const exercises = currentLesson.exercises || [];
  if (currentExerciseIndex >= exercises.length) return;
  if (exercises.length - currentExerciseIndex <= 1) {
    toast("This is already the last activity.");
    return;
  }

  const [skipped] = exercises.splice(currentExerciseIndex, 1);
  exercises.push(skipped);
  currentSelection = null;
  renderExercise();
  toast("Activity moved to the end.");
}

function renderExercise() {
  if (progressState.hearts <= 0) {
    showOutOfHeartsState();
    return;
  }

  const exercise = currentLesson.exercises[currentExerciseIndex];
  const body = document.getElementById("lesson-body");
  body.innerHTML = "";
  currentSelection = null;
  const hintBox = document.getElementById("hero-status");
  if (hintBox) hintBox.textContent = "";
  setLessonActionState(false);

  const wrapper = document.createElement("div");
  wrapper.className = "exercise";

  const prompt = document.createElement("h3");
  prompt.textContent = exercise.prompt;
  wrapper.appendChild(prompt);

  if (exercise.type === "vocab-recognition" || exercise.type === "listening") {
    const vocab = exercise.vocab || vocabDatabase[0];
    if (!vocab) { body.textContent = "No vocab loaded."; return; }
    const word = document.createElement("p");
    word.className = "prompt-word";
    word.textContent = `Greek: ${vocab.greek || "—"}`;
    wrapper.appendChild(word);
    const playBtn = document.createElement("button");
    playBtn.className = "btn ghost";
    playBtn.textContent = "Play";
    playBtn.addEventListener("click", () => playLessonAudio(vocab));
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
    const expected = [
      vocab.transliteration,
      buildGreekSpeechText(vocab.greek || "", vocab.transliteration || ""),
      vocab.greek
    ].filter(Boolean);
    const word = document.createElement("p");
    word.className = "prompt-word";
    word.textContent = `Greek: ${vocab.greek || "—"}`;
    wrapper.appendChild(word);
    const help = document.createElement("p");
    help.className = "muted";
    help.textContent = supportsSpeechRecognition()
      ? "Say the pronunciation clearly, or type it below if the microphone mishears you."
      : "This browser does not support speech recognition. Type the pronunciation below or use Chrome.";
    wrapper.appendChild(help);
    const refBtn = document.createElement("button");
    refBtn.className = "btn ghost";
    refBtn.textContent = "Play reference";
    refBtn.addEventListener("click", () => playLessonAudio(vocab));
    wrapper.appendChild(refBtn);
    const speakBtn = document.createElement("button");
    speakBtn.className = "btn";
    speakBtn.textContent = "Speak";
    speakBtn.disabled = !supportsSpeechRecognition();
    speakBtn.addEventListener("click", () => {
      listenForGreek(expected, (result) => {
        currentSelection = result;
        if (result.unsupported) {
          toast("Type the pronunciation below, or use Chrome for microphone input.");
          return;
        }
        if (result.error === "no-match" || result.error === "no-speech") {
          toast("I could not hear that clearly. Try again or type the pronunciation below.");
          return;
        }
        if (result.error) {
          toast("Speech recognition failed. Type the pronunciation below.");
          return;
        }
        toast(`You said: ${result.transcript} (${result.score}%)`);
      });
    });
    wrapper.appendChild(speakBtn);
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Type the pronunciation, for example logos";
    input.addEventListener("input", () => {
      const typed = input.value.trim();
      if (!typed) {
        currentSelection = null;
        return;
      }
      currentSelection = {
        transcript: typed,
        score: scorePronunciation(expected, typed),
        manual: true
      };
    });
    wrapper.appendChild(input);
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
  updateLessonProgress();
}

function playLessonAudio(vocab) {
  const greek = (vocab.greek || "").trim();
  const latin = (vocab.meaning || vocab.english || vocab.transliteration || "").trim();
  const isSingleLetter = greek.length === 1;
  if (isSingleLetter) {
    const letterNames = {
      "α": "alpha",
      "β": "beta",
      "γ": "gamma",
      "δ": "delta",
      "ε": "epsilon",
      "ζ": "zeta",
      "η": "eta",
      "θ": "theta",
      "ι": "iota",
      "κ": "kappa",
      "λ": "lambda",
      "μ": "mu",
      "ν": "nu",
      "ξ": "xi",
      "ο": "omicron",
      "π": "pi",
      "ρ": "rho",
      "σ": "sigma",
      "ς": "sigma",
      "τ": "tau",
      "υ": "upsilon",
      "φ": "phi",
      "χ": "chi",
      "ψ": "psi",
      "ω": "omega"
    };
    const name = letterNames[greek] || latin;
    if (name) {
      speakLatin(name);
      return;
    }
  }
  if (isSingleLetter && latin) {
    speakLatin(latin);
    return;
  }
  if (greek) {
    speakGreek(greek, vocab.transliteration || "");
    return;
  }
  if (latin) {
    speakLatin(latin);
    return;
  }
}

function getAudioKey(vocab) {
  if (!vocab) return null;
  const meaning = (vocab.meaning || vocab.english || "").toLowerCase().trim();
  if (meaning && alphabetKeys.has(meaning)) return meaning;
  const key = (vocab.transliteration || vocab.english || vocab.greek || "").toLowerCase().trim();
  return key || meaning || null;
}

function checkAnswer() {
  if (progressState.hearts <= 0) {
    showOutOfHeartsState();
    return;
  }

  const exercise = currentLesson.exercises[currentExerciseIndex];
  let correct = false;

  if (exercise.type === "vocab-recognition" || exercise.type === "listening") {
    correct = currentSelection === exercise.vocab.english;
  }
  if (exercise.type === "pronunciation") {
    correct = currentSelection && currentSelection.score >= 30;
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
    playCorrectSound();
  } else {
    loseHeart();
    setTeacherMood("sad");
    teacherSpeak("Try again!");
    updateSpacedRepetition(exercise.vocab?.id, false);
    playIncorrectSound();
  }

  updateStats();
  saveLocalProgress();

  if (correct) {
    currentExerciseIndex += 1;
    if (currentExerciseIndex >= currentLesson.exercises.length) {
      finishLesson();
    } else {
      renderExercise();
    }
  } else {
    if (progressState.hearts <= 0) {
      showOutOfHeartsState();
      toast("Out of hearts. Wait for a refill.");
    } else {
      toast("Re-attempt required to continue.");
    }
  }
}

const HEART_MAX = 5;
const HEART_REFILL_MS = 5 * 60 * 1000;

function hydrateHeartRefillState() {
  if (progressState.exhaustedHeartTimes.length) {
    progressState.exhaustedHeartTimes = progressState.exhaustedHeartTimes
      .sort((a, b) => a - b)
      .slice(-HEART_MAX);
    progressState.hearts = Math.max(0, HEART_MAX - progressState.exhaustedHeartTimes.length);
    return;
  }

  const savedHearts = Number.isFinite(progressState.hearts) ? progressState.hearts : HEART_MAX;
  const missingHearts = Math.max(0, HEART_MAX - savedHearts);
  if (!missingHearts) {
    progressState.hearts = HEART_MAX;
    progressState.exhaustedHeartTimes = [];
    return;
  }

  const fallbackTime = progressState.heartsUpdatedAt || Date.now();
  progressState.exhaustedHeartTimes = Array.from({ length: missingHearts }, () => fallbackTime);
  progressState.hearts = HEART_MAX - missingHearts;
}

function refillHeartsIfNeeded() {
  const now = Date.now();
  const before = progressState.hearts;

  progressState.exhaustedHeartTimes = (progressState.exhaustedHeartTimes || [])
    .filter((lostAt) => now - lostAt < HEART_REFILL_MS)
    .sort((a, b) => a - b);

  progressState.hearts = Math.max(0, HEART_MAX - progressState.exhaustedHeartTimes.length);
  progressState.heartsUpdatedAt = progressState.exhaustedHeartTimes[0] || now;

  if (progressState.hearts !== before) {
    updateStats();
    saveLocalProgress();
    if (before <= 0 && progressState.hearts > 0 && currentLesson) {
      renderExercise();
    }
  }
}

function loseHeart() {
  refillHeartsIfNeeded();
  if (progressState.hearts <= 0) {
    updateStats();
    saveLocalProgress();
    toast("Out of hearts. Please wait for a refill.");
    return;
  }

  progressState.hearts = Math.max(progressState.hearts - 1, 0);
  if (!Array.isArray(progressState.exhaustedHeartTimes)) {
    progressState.exhaustedHeartTimes = [];
  }
  progressState.exhaustedHeartTimes.push(Date.now());
  progressState.exhaustedHeartTimes = progressState.exhaustedHeartTimes
    .sort((a, b) => a - b)
    .slice(-HEART_MAX);
  progressState.heartsUpdatedAt = Date.now();
  updateStats();
  saveLocalProgress();
  if (progressState.hearts <= 0) {
    toast("Out of hearts. Please wait for a refill.");
  }
}

function consumeHeartIfNeeded() {
  refillHeartsIfNeeded();
  if (progressState.hearts <= 0) {
    showOutOfHeartsState();
    toast("Out of hearts. Please wait for a refill.");
    return false;
  }
  return true;
}

function finishLesson() {
  if (!progressState.completedLessons.includes(currentLesson.id)) {
    progressState.completedLessons.push(currentLesson.id);
    progressState.xp += currentLesson.xp;
    lessonXpEarned += currentLesson.xp;
  }
  // Restore hearts on lesson completion
  progressState.hearts = HEART_MAX;
  progressState.heartsUpdatedAt = Date.now();
  progressState.exhaustedHeartTimes = [];
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
  const skipBtn = document.getElementById("skip-btn");
  if (skipBtn) skipBtn.addEventListener("click", skipCurrentExercise);
  const signInBtn = document.getElementById("sign-in-btn");
  if (signInBtn) signInBtn.addEventListener("click", signInWithGoogle);
  const logInBtn = document.getElementById("log-in-btn");
  if (logInBtn) logInBtn.addEventListener("click", signInWithGoogle);
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", signOutUser);

  const mapBtn = document.getElementById("map-btn");
  if (mapBtn) mapBtn.addEventListener("click", openMapModal);
  const profileBtn = document.getElementById("profile-btn");
  if (profileBtn) profileBtn.addEventListener("click", openProfileModal);
  const optionsBtn = document.getElementById("options-btn");
  if (optionsBtn) optionsBtn.addEventListener("click", openOptionsModal);
  const tourBtn = document.getElementById("tour-btn");
  if (tourBtn) tourBtn.addEventListener("click", startTour);
  const contactBtn = document.getElementById("contact-btn");
  if (contactBtn) contactBtn.addEventListener("click", openContactModal);
  const aboutBtn = document.getElementById("about-btn");
  if (aboutBtn) aboutBtn.addEventListener("click", () => toast("Learn Koine Greek · prototype"));
  const sidebarToggle = document.getElementById("sidebar-toggle");
  if (sidebarToggle) sidebarToggle.addEventListener("click", toggleSidebar);
  const sidebarToggleFloating = document.getElementById("sidebar-toggle-floating");
  if (sidebarToggleFloating) sidebarToggleFloating.addEventListener("click", toggleSidebar);

  const introStart = document.getElementById("intro-start");
  if (introStart) introStart.addEventListener("click", startOrResumeFromIntro);
  const logo = document.querySelector(".logo, .side-logo");
  if (logo) logo.addEventListener("click", () => {
    document.getElementById("lesson-title").textContent = "Welcome";
    document.getElementById("lesson-type").textContent = "Choose a lesson to begin";
    document.getElementById("lesson-xp").textContent = "+0 XP";
  });

  window.addEventListener("gq-auth-changed", handleAuthChange);

  // Startup audio removed per request
}

function showHint() {
  const ex = currentLesson?.exercises?.[currentExerciseIndex];
  const hintBox = document.getElementById("hero-status");
  if (!ex) {
    if (hintBox) hintBox.textContent = "";
    toast("Hint: pick a lesson to begin.");
    return;
  }
  if (ex.vocab) {
    const translit = ex.vocab.transliteration || "(listen for the sound)";
    if (hintBox) hintBox.textContent = `${ex.vocab.greek || "Listen"} (${translit})`;
    toast(`Hint: ${ex.vocab.greek || "Listen"} (${translit})`);
    return;
  }
  if (ex.type === "sentence-builder" && ex.sentence) {
    if (hintBox) hintBox.textContent = `Order should be "${ex.sentence}".`;
    toast(`Hint: Order should be "${ex.sentence}".`);
    return;
  }
  if (hintBox) hintBox.textContent = "Listen carefully to the Greek sound.";
  toast("Hint: listen carefully to the Greek sound.");
}

function initApp() {
  loadOptions();
  registerEvents();
  const hintBox = document.getElementById("hero-status");
  if (hintBox) hintBox.textContent = "";
  lockUI(!isSignedIn());
  handleAuthChange();

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

  if (heartRefillTicker) {
    clearInterval(heartRefillTicker);
  }
  heartRefillTicker = setInterval(refillHeartsIfNeeded, 1000);

  // Safety: never keep intro longer than 10 seconds
  setTimeout(startOrResumeFromIntro, 9000);
}

// Startup audio intentionally removed.

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

function confirmStartNew() {
  if (!requireSignIn()) return;
  const body = document.createElement("div");
  body.innerHTML = `<p>Are you sure you want to proceed? This will reset your progress.</p>`;
  const agree = document.createElement("button");
  agree.className = "btn";
  agree.textContent = "Agree and continue";
  const cancel = document.createElement("button");
  cancel.className = "btn ghost";
  cancel.style.marginLeft = "8px";
  cancel.textContent = "Cancel";
  const wrap = document.createElement("div");
  wrap.appendChild(body);
  wrap.appendChild(agree);
  wrap.appendChild(cancel);
  agree.addEventListener("click", () => {
    progressState.completedLessons = [];
    progressState.xp = 0;
    progressState.level = 1;
    updateStats();
    updateProgressBar();
    renderMap(progressState);
    toast("Progress reset. Pick any unlocked lesson.");
    const modal = document.getElementById("app-modal");
    if (modal) modal.classList.remove("show");
    startLesson(lessonData.worlds[0].lessons[0], lessonData.worlds[0]);
  });
  cancel.addEventListener("click", () => {
    const modal = document.getElementById("app-modal");
    if (modal) modal.classList.remove("show");
  });
  showModal("Reset progress?", wrap);
}

function isSignedIn() {
  return typeof authState !== "undefined" && !!authState.user;
}

function requireSignIn() {
  if (isSignedIn()) return true;
  toast("Please sign in with Google to play.");
  return false;
}

function lockUI(locked) {
  const ids = ["check-btn","hint-btn","skip-btn","map-btn","profile-btn","options-btn","contact-btn","about-btn"];
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

// Guided tour with mascot
const tourSteps = [
  { target: ".side-logo", title: "Welcome!", text: "I am Aletheia, your guide. I'll show you around." },
  { target: "#map-btn", title: "Map", text: "Open the map to pick any unlocked level." },
  { target: "#profile-btn", title: "Profile", text: "See your Google profile after sign-in." },
  { target: "#options-btn", title: "Options", text: "Adjust sound, brightness, autosave, and theme." },
  { target: "#world-map", title: "Worlds & Levels", text: "Each world contains levels that build on earlier words." },
  { target: "#lesson-panel", title: "Lesson area", text: "Activities appear here. You must answer correctly to move on." },
  { target: "#check-btn", title: "Check", text: "Submit your answer for each activity." }
];

let tourIndex = 0;

function startTour() {
  const overlay = document.getElementById("tour-overlay");
  if (!overlay) return;
  tourIndex = 0;
  overlay.classList.add("show");
  showTourStep();
  document.getElementById("tour-next").onclick = () => {
    tourIndex += 1;
    if (tourIndex >= tourSteps.length) {
      endTour();
    } else {
      showTourStep();
    }
  };
  document.getElementById("tour-skip").onclick = endTour;
}

function showTourStep() {
  const overlay = document.getElementById("tour-overlay");
  if (!overlay) return;
  const step = tourSteps[tourIndex];
  const title = document.getElementById("tour-title");
  const text = document.getElementById("tour-text");
  const spotlight = overlay.querySelector(".tour-spotlight");
  const targetEl = document.querySelector(step.target);
  title.textContent = step.title;
  text.textContent = step.text;
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    spotlight.style.top = `${rect.top - 8}px`;
    spotlight.style.left = `${rect.left - 8}px`;
    spotlight.style.width = `${rect.width + 16}px`;
    spotlight.style.height = `${rect.height + 16}px`;
  } else {
    spotlight.style.top = "20%";
    spotlight.style.left = "20%";
    spotlight.style.width = "60%";
    spotlight.style.height = "20%";
  }
}

function endTour() {
  const overlay = document.getElementById("tour-overlay");
  if (overlay) overlay.classList.remove("show");
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
    <div class="toggle-row"><span>Sound on</span><label class="switch"><input type="checkbox" id="opt-sound"><span class="slider"></span></label></div>
    <label>Volume: <input type="range" id="opt-volume" min="0" max="1" step="0.05"></label><br>
    <div class="toggle-row"><span>Auto-save progress</span><label class="switch"><input type="checkbox" id="opt-autosave"><span class="slider"></span></label></div>
    <div class="toggle-row"><span>Auto-hide sidebar</span><label class="switch"><input type="checkbox" id="opt-autohide"><span class="slider"></span></label></div>
    <label>Brightness: <input type="range" id="opt-brightness" min="0.7" max="1.2" step="0.05"></label><br>
    <br>
    <label>Theme:
      <select id="opt-theme">
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  `;
  wrap.querySelector("#opt-sound").checked = userOptions.sound;
  wrap.querySelector("#opt-volume").value = userOptions.volume;
  wrap.querySelector("#opt-autosave").checked = userOptions.autoSave;
  wrap.querySelector("#opt-autohide").checked = userOptions.autoHideSidebar;
  wrap.querySelector("#opt-brightness").value = userOptions.brightness || 1;
  wrap.querySelector("#opt-theme").value = userOptions.theme || "system";
  wrap.querySelectorAll("input,select").forEach((el) => el.addEventListener("change", saveOptions));
  showModal("Settings", wrap);
}

function saveOptions() {
  const modal = document.getElementById("app-modal");
  if (!modal) return;
  userOptions.sound = modal.querySelector("#opt-sound").checked;
  userOptions.volume = parseFloat(modal.querySelector("#opt-volume").value || "0.5");
  userOptions.autoSave = modal.querySelector("#opt-autosave").checked;
  userOptions.autoHideSidebar = modal.querySelector("#opt-autohide").checked;
  userOptions.brightness = parseFloat(modal.querySelector("#opt-brightness").value || "1");
  userOptions.theme = modal.querySelector("#opt-theme").value || "system";
  localStorage.setItem("gqOptions", JSON.stringify(userOptions));
  document.body.style.filter = `brightness(${userOptions.brightness})`;
  document.body.classList.remove("light", "dark");
  if (userOptions.theme === "light") document.body.classList.add("light");
  if (userOptions.theme === "dark") document.body.classList.add("dark");
  document.body.classList.toggle("sidebar-hidden", !!userOptions.autoHideSidebar);
  if (masterGain) masterGain.gain.value = userOptions.volume;
}

function loadOptions() {
  const stored = localStorage.getItem("gqOptions");
  if (stored) {
    try { userOptions = JSON.parse(stored); } catch (e) {}
  }
  document.body.style.filter = `brightness(${userOptions.brightness || 1})`;
  document.body.classList.remove("light", "dark");
  if (userOptions.theme === "light") document.body.classList.add("light");
  if (userOptions.theme === "dark") document.body.classList.add("dark");
  if (userOptions.theme === "system") {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.add(prefersDark ? "dark" : "light");
  }
  document.body.classList.toggle("sidebar-hidden", !!userOptions.autoHideSidebar);
  if (masterGain) masterGain.gain.value = userOptions.volume;
}

function toggleSidebar() {
  document.body.classList.toggle("sidebar-hidden");
  userOptions.autoHideSidebar = document.body.classList.contains("sidebar-hidden");
  localStorage.setItem("gqOptions", JSON.stringify(userOptions));
}

function updateLessonProgress() {
  const bar = document.getElementById("lesson-progress-bar");
  const text = document.getElementById("lesson-progress-text");
  const cat = document.getElementById("lesson-category");
  if (!bar || !text || !cat) return;
  if (!currentLesson) {
    bar.style.width = "0%";
    text.textContent = "Lesson: —";
    cat.textContent = "Category: —";
    return;
  }
  const total = currentLesson.exercises.length || 1;
  const pct = Math.min(100, Math.floor((currentExerciseIndex / total) * 100));
  bar.style.width = `${pct}%`;
  text.textContent = `Lesson: ${currentLesson.title}`;
  const world = lessonData.worlds.find((w) => w.id === currentLesson.worldId);
  cat.textContent = `Category: ${world ? world.title.replace(/World\\s\\d+\\:\\s*/i, "") : "Lesson"}`;
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

function loadAudioMap() {
  const stored = localStorage.getItem("gqAudioMap");
  if (stored) {
    try { return JSON.parse(stored); } catch (e) {}
  }
  return { alphabet: { items: {} }, vocab: { items: {} } };
}

function loadVocabMapFile() {
  return fetch("assets/audio/vocab-map.json", { cache: "force-cache" })
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({}));
}

function mergeVocabMaps(localMap, fileMap) {
  const merged = { alphabet: { items: {} }, vocab: { items: {} } };
  if (fileMap?.alphabet?.items) merged.alphabet.items = { ...fileMap.alphabet.items };
  if (fileMap?.vocab?.items) merged.vocab.items = { ...fileMap.vocab.items };
  if (localMap?.alphabet?.items) merged.alphabet.items = { ...merged.alphabet.items, ...localMap.alphabet.items };
  if (localMap?.vocab?.items) merged.vocab.items = { ...merged.vocab.items, ...localMap.vocab.items };
  return merged;
}

function openVocabListModal() {
  const wrap = document.createElement("div");
  wrap.className = "vocab-list";
  wrap.innerHTML = `
    <div class="audio-map">
      <p class="muted">Assign audio times for each vocabulary entry.</p>
      <audio id="audio-map-player" controls preload="metadata"></audio>
      <div class="audio-map-row">
        <label>Start (sec):
          <input id="audio-start" type="number" min="0" step="0.01">
        </label>
        <button id="set-start" class="btn ghost" type="button">Use current time</button>
      </div>
      <div class="audio-map-row">
        <label>End (sec):
          <input id="audio-end" type="number" min="0" step="0.01">
        </label>
        <button id="set-end" class="btn ghost" type="button">Use current time</button>
      </div>
      <div class="audio-map-row">
        <button id="save-mark" class="btn" type="button">Save mark</button>
        <button id="play-range" class="btn ghost" type="button">Play range</button>
        <button id="export-map" class="btn ghost" type="button">Export JSON</button>
      </div>
    </div>
    <div class="vocab-list__items" id="vocab-list"></div>
  `;

  const audioMap = loadAudioMap();
  const player = wrap.querySelector("#audio-map-player");
  const startInput = wrap.querySelector("#audio-start");
  const endInput = wrap.querySelector("#audio-end");
  const list = wrap.querySelector("#vocab-list");
  player.src = "assets/audio/vocab56.m4a";

  let selectedKey = null;

  function selectRow(key, rowEl) {
    selectedKey = key;
    list.querySelectorAll(".vocab-list__row").forEach((r) => r.classList.remove("active"));
    rowEl.classList.add("active");
    const entry = audioMap.vocab?.items?.[key];
    startInput.value = entry?.start ?? "";
    endInput.value = entry?.end ?? "";
  }

  loadVocabMapFile().then((fileMap) => {
    const merged = mergeVocabMaps(audioMap, fileMap);
    const mappedKeys = new Set(Object.keys(merged.vocab?.items || {}));
    list.innerHTML = "";
    let displayIndex = 0;
    (vocabDatabase || []).forEach((v) => {
      const key = (v.transliteration || v.english || v.greek || "").toLowerCase().trim();
      if (mappedKeys.has(key)) return;
      displayIndex += 1;
      const row = document.createElement("div");
      row.className = "vocab-list__row";
      row.innerHTML = `<span class="muted">${displayIndex}.</span> <strong>${v.greek || ""}</strong> <span class="muted">${v.transliteration || ""}</span> — ${v.english || ""}`;
      row.addEventListener("click", () => selectRow(key, row));
      list.appendChild(row);
    });
  });

  wrap.querySelector("#set-start").addEventListener("click", () => { startInput.value = player.currentTime.toFixed(2); });
  wrap.querySelector("#set-end").addEventListener("click", () => { endInput.value = player.currentTime.toFixed(2); });
  wrap.querySelector("#save-mark").addEventListener("click", () => {
    if (!selectedKey) {
      toast("Select a vocabulary row first.");
      return;
    }
    const start = parseFloat(startInput.value);
    const end = parseFloat(endInput.value);
    if (!audioMap.vocab) audioMap.vocab = { items: {} };
    audioMap.vocab.items[selectedKey] = { start, end };
    localStorage.setItem("gqAudioMap", JSON.stringify(audioMap));
    toast("Saved audio mark.");
    // Auto-scroll and move to next vocab entry
    const rows = Array.from(list.querySelectorAll(".vocab-list__row"));
    const currentIndex = rows.findIndex((r) => r.classList.contains("active"));
    if (currentIndex >= 0 && currentIndex < rows.length - 1) {
      const nextRow = rows[currentIndex + 1];
      nextRow.click();
      nextRow.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
  wrap.querySelector("#play-range").addEventListener("click", () => {
    const s = parseFloat(startInput.value || "0");
    const e = parseFloat(endInput.value || "0");
    if (!isNaN(s)) {
      player.currentTime = s;
      player.play();
      if (!isNaN(e) && e > s) {
        const stop = () => {
          if (player.currentTime >= e) {
            player.pause();
            player.removeEventListener("timeupdate", stop);
          }
        };
        player.addEventListener("timeupdate", stop);
      }
    }
  });
  wrap.querySelector("#export-map").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(audioMap, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audio-map.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  showModal("All Vocabulary", wrap);
}

// No auth modal. Sign-in is handled directly by the sidebar buttons.

// Startup chime + intro overlay
function playStartupChime() {
  if (!userOptions.sound) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 440;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 15);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 15.2);
}

function playStartupAmbient() {
  if (startupPlayed || !userOptions.sound) return;
  initAudio();
  if (!audioCtx) return;
  startupPlayed = true;

  const pad = audioCtx.createOscillator();
  const padGain = audioCtx.createGain();
  pad.type = "sawtooth";
  pad.frequency.value = 220;
  padGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  padGain.gain.exponentialRampToValueAtTime(userOptions.volume * 0.35, audioCtx.currentTime + 0.8);
  padGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 15);
  pad.connect(padGain).connect(masterGain);
  pad.start();
  pad.stop(audioCtx.currentTime + 15.2);

  const shimmer = audioCtx.createOscillator();
  const shimmerGain = audioCtx.createGain();
  shimmer.type = "triangle";
  shimmer.frequency.value = 880;
  shimmerGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  shimmerGain.gain.exponentialRampToValueAtTime(userOptions.volume * 0.2, audioCtx.currentTime + 0.4);
  shimmerGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 6);
  shimmer.connect(shimmerGain).connect(masterGain);
  shimmer.start();
  shimmer.stop(audioCtx.currentTime + 6.2);
}

function hideIntro() {
  const intro = document.getElementById("intro-overlay");
  if (intro) {
    intro.classList.add("hide");
    setTimeout(() => intro.remove(), 900);
  }
}

function startOrResumeFromIntro() {
  const intro = document.getElementById("intro-overlay");
  if (!intro || intro.classList.contains("hide")) return;
  if (requireSignIn()) {
    if (progressState.completedLessons.length) {
      startNextUnlockedLesson();
    } else {
      startLesson(lessonData.worlds[0].lessons[0], lessonData.worlds[0]);
    }
  }
  hideIntro();
}

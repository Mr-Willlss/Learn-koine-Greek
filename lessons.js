// lessons.js
const lessonData = {
  worlds: [
    {
      id: "world1",
      title: "World 1: The Alphabet Temple",
      lessons: [
        { id: "l1", title: "Level 1", xp: 10 },
        { id: "l2", title: "Level 2", xp: 10 },
        { id: "l3", title: "Level 3", xp: 15 },
        { id: "l4", title: "Level 4", xp: 20 },
        { id: "l5", title: "Level 5", xp: 25 },
      ]
    },
    {
      id: "world2",
      title: "World 2: First Words & Basic Sentences",
      lessons: [
        { id: "l6", title: "Level 6", xp: 30 },
        { id: "l7", title: "Level 7", xp: 35 },
        { id: "l8", title: "Level 8", xp: 40 },
        { id: "l9", title: "Level 9", xp: 45 },
        { id: "l10", title: "Level 10", xp: 50 },
      ]
    },
    {
      id: "world3",
      title: "World 3: Grammar Foundations — Nouns & Verbs",
      lessons: [
        { id: "l11", title: "Level 11", xp: 55 },
        { id: "l12", title: "Level 12", xp: 60 },
        { id: "l13", title: "Level 13", xp: 65 },
        { id: "l14", title: "Level 14", xp: 70 },
        { id: "l15", title: "Level 15", xp: 75 },
      ]
    },
    {
      id: "world4",
      title: "World 4: Expanding Grammar — Cases, Tenses & Articles",
      lessons: [
        { id: "l16", title: "Level 16", xp: 80 },
        { id: "l17", title: "Level 17", xp: 85 },
        { id: "l18", title: "Level 18", xp: 90 },
        { id: "l19", title: "Level 19", xp: 95 },
        { id: "l20", title: "Level 20", xp: 100 },
      ]
    },
    {
      id: "world5",
      title: "World 5: Advanced Structures — Pronouns & Moods",
      lessons: [
        { id: "l21", title: "Level 21", xp: 105 },
        { id: "l22", title: "Level 22", xp: 110 },
        { id: "l23", title: "Level 23", xp: 115 },
        { id: "l24", title: "Level 24", xp: 120 },
        { id: "l25", title: "Level 25", xp: 125 },
      ]
    },
  ]
};

function shuffleTokens(tokens) {
  const items = [...tokens];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function shuffleItems(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getLessonVocab(lessonNum, vocab, count) {
  const pool = (vocab || []).filter((v) => !lessonNum || v.lesson === lessonNum);
  const pick = pool.length ? pool : (vocab || []);
  const shuffled = shuffleItems(pick);
  if (shuffled.length >= count) {
    return shuffled.slice(0, count);
  }
  const result = [...shuffled];
  let index = 0;
  while (result.length < count && pick.length) {
    result.push(pick[index % pick.length]);
    index += 1;
  }
  return result;
}

function buildSentenceExercise(lessonNum, vocab) {
  const pool = (vocab || []).filter((v) => !lessonNum || v.lesson === lessonNum);
  const pick = pool.length ? pool : (vocab || []);
  const words = pick
    .map((v) => v.greek || v.transliteration || "")
    .filter((w) => w && w.trim().length > 0);
  const uniqueWords = Array.from(new Set(words));

  let sentenceWords = uniqueWords.slice(0, 4);
  if (sentenceWords.length < 3) {
    const allWords = (vocab || [])
      .map((v) => v.greek || v.transliteration || "")
      .filter((w) => w && w.trim().length > 0);
    const offset = Math.max(0, ((lessonNum || 1) - 1) * 3);
    sentenceWords = allWords.slice(offset, offset + 4);
  }
  if (sentenceWords.length < 3) {
    sentenceWords = ["ego", "lego", "ton", "logon"];
  }

  return {
    type: "sentence-builder",
    prompt: "Build the sentence (tap the words in order).",
    sentence: sentenceWords.join(" "),
    tokens: shuffleTokens(sentenceWords)
  };
}

function buildLessonExercises(lesson, vocab) {
  const lessonNum = parseInt((lesson.id || "").replace(/\D/g, ""), 10);
  const sample = getLessonVocab(lessonNum, vocab, 4);
  const exercises = [
    { type: "vocab-recognition", prompt: "Listen and choose the correct meaning.", vocab: sample[0] },
    { type: "listening", prompt: "What did you hear?", vocab: sample[1] },
    { type: "pronunciation", prompt: "Speak the Greek word.", vocab: sample[2] },
    buildSentenceExercise(lessonNum, vocab),
    { type: "translation", prompt: "Translate to English.", vocab: sample[3] }
  ];
  return shuffleItems(exercises);
}



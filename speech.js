// Web Speech API helpers for synthesis and recognition.
const speech = {
  voices: [],
  synth: window.speechSynthesis
};

const GREEK_SINGLE_MAP = {
  α: "a",
  β: "b",
  γ: "g",
  δ: "d",
  ε: "e",
  ζ: "z",
  η: "e",
  θ: "th",
  ι: "i",
  κ: "k",
  λ: "l",
  μ: "m",
  ν: "n",
  ξ: "x",
  ο: "o",
  π: "p",
  ρ: "r",
  σ: "s",
  ς: "s",
  τ: "t",
  υ: "u",
  φ: "ph",
  χ: "ch",
  ψ: "ps",
  ω: "o"
};

const GREEK_MULTI_MAP = [
  ["γγ", "ng"],
  ["γκ", "nk"],
  ["γξ", "nx"],
  ["γχ", "nch"],
  ["αι", "ai"],
  ["αυ", "au"],
  ["ει", "ei"],
  ["ευ", "eu"],
  ["ηυ", "eu"],
  ["οι", "oi"],
  ["ου", "ou"],
  ["υι", "ui"]
];

const SPEECH_ROMANIZATION_RULES = [
  ["gg", "ng"],
  ["gk", "nk"],
  ["ph", "f"],
  ["rh", "r"],
  ["ou", "oo"],
  ["ei", "ay"],
  ["oi", "oy"],
  ["ui", "wee"],
  ["ai", "eye"],
  ["au", "ow"],
  ["eu", "eh-oo"]
];

function initSpeech() {
  if (!speech.synth) {
    return;
  }

  const refresh = () => {
    try {
      speech.voices = speech.synth.getVoices();
    } catch (_) {
      speech.voices = [];
    }
  };

  refresh();

  // Some browsers load voices asynchronously.
  if (!speech.voices.length) {
    speech.synth.onvoiceschanged = () => {
      refresh();
    };
  }
}

function pickVoice(langPrefix) {
  const voices = speech.voices || [];
  const wanted = (langPrefix || "").toLowerCase();

  return (
    voices.find((v) => (v.lang || "").toLowerCase().startsWith(wanted)) ||
    voices.find((v) => (v.lang || "").toLowerCase().startsWith("en")) ||
    null
  );
}

function containsGreek(text) {
  return /[\u0370-\u03ff]/.test(text || "");
}

function stripGreekDiacritics(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u03c2/g, "\u03c3");
}

function transliterateGreekText(text) {
  let normalized = stripGreekDiacritics(text).toLowerCase();
  if (!containsGreek(normalized)) {
    return normalized;
  }

  normalized = normalized.replace(/[·;,]/g, ", ");

  GREEK_MULTI_MAP.forEach(([from, to]) => {
    normalized = normalized.replaceAll(from, to);
  });

  let latin = "";
  for (const char of normalized) {
    latin += GREEK_SINGLE_MAP[char] || char;
  }

  return latin
    .replace(/\//g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

function romanizedGreekToSpeechText(text) {
  let speechText = (text || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[·;,]/g, ", ")
    .replace(/\//g, ", ");

  SPEECH_ROMANIZATION_RULES.forEach(([from, to]) => {
    speechText = speechText.replaceAll(from, to);
  });

  return speechText
    .replace(/\s+/g, " ")
    .trim();
}

function buildGreekSpeechText(text, transliteration = "") {
  const base = (transliteration || "").trim() || transliterateGreekText(text);
  return romanizedGreekToSpeechText(base);
}

function supportsSpeechRecognition() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function ensureVoicesReady(timeoutMs = 900) {
  if (!speech.synth) {
    return Promise.resolve(false);
  }

  if ((speech.voices || []).length) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let done = false;

    const finish = (ok) => {
      if (done) return;
      done = true;
      resolve(ok);
    };

    const t = setTimeout(() => finish(false), timeoutMs);

    const prev = speech.synth.onvoiceschanged;
    speech.synth.onvoiceschanged = () => {
      clearTimeout(t);
      try {
        speech.voices = speech.synth.getVoices();
      } catch (_) {
        speech.voices = [];
      }
      speech.synth.onvoiceschanged = prev;
      finish(true);
    };
  });
}

function speakGreek(text, transliteration = "") {
  if (!speech.synth) {
    toast("Speech synthesis not supported in this browser.");
    return;
  }

  ensureVoicesReady().finally(() => {
    const spokenText = buildGreekSpeechText(text, transliteration) || text;
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const v = pickVoice("en");
    if (v) {
      utterance.voice = v;
    }

    try {
      // Cancel any stuck queue and resume audio.
      speech.synth.cancel();
      speech.synth.resume();
      speech.synth.speak(utterance);
    } catch (_) {
      toast("Could not play speech. Check if the tab is muted.");
    }
  });
}

function speakLatin(text) {
  if (!speech.synth) {
    toast("Speech synthesis not supported in this browser.");
    return;
  }

  ensureVoicesReady().finally(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const v = pickVoice("en");
    if (v) {
      utterance.voice = v;
    }

    try {
      speech.synth.cancel();
      speech.synth.resume();
      speech.synth.speak(utterance);
    } catch (_) {
      toast("Could not play speech. Check if the tab is muted.");
    }
  });
}


function buildPronunciationTargets(expected) {
  const values = Array.isArray(expected) ? expected : [expected];
  const targets = new Set();

  values.forEach((value) => {
    if (!value) return;
    const raw = String(value).trim();
    if (!raw) return;

    targets.add(raw);
    targets.add(transliterateGreekText(raw));
    targets.add(buildGreekSpeechText(raw));

    raw
      .split(/[\/,;]+|\s{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        targets.add(part);
        targets.add(transliterateGreekText(part));
        targets.add(buildGreekSpeechText(part));
      });
  });

  return Array.from(targets).filter(Boolean);
}

function chooseRecognitionLanguage(expected) {
  const values = Array.isArray(expected) ? expected : [expected];
  return values.some((value) => !containsGreek(value)) ? "en-US" : "el-GR";
}

function listenForGreek(expected, callback) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    toast("Speech recognition is not available in this browser. Use Chrome or type the pronunciation.");
    callback({ score: 0, transcript: "", unsupported: true });
    return;
  }

  const expectedTargets = buildPronunciationTargets(expected);
  const recognition = new SpeechRecognition();
  recognition.lang = chooseRecognitionLanguage(expectedTargets);
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 8;

  try {
    recognition.start();
  } catch (_) {
    callback({ score: 0, transcript: "", error: "start-failed" });
    return;
  }
  recognition.onresult = (event) => {
    const alts = Array.from(event.results[0] || []).map((r) => r.transcript.trim());
    const best = alts.reduce(
      (acc, t) => {
        const s = scorePronunciation(expectedTargets, t);
        return s > acc.score ? { score: s, transcript: t } : acc;
      },
      { score: 0, transcript: "" }
    );
    callback(best);
  };
  recognition.onnomatch = () => {
    callback({ score: 0, transcript: "", error: "no-match" });
  };
  recognition.onerror = (event) => {
    const error = event?.error || "recognition-error";
    if (error !== "no-speech" && error !== "aborted") {
      toast("Speech recognition failed. You can type the pronunciation instead.");
    }
    callback({ score: 0, transcript: "", error });
  };
}

// Naive pronunciation score based on character similarity.
function scorePronunciation(expected, actual) {
  if (!expected || !actual) {
    return 0;
  }

  const normalizedActual = normalizeGreek(actual);
  const actualSkeleton = getPronunciationSkeleton(actual);
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  const normalizedExpectedValues = expectedValues
    .map((value) => normalizeGreek(value))
    .filter(Boolean);

  if (!normalizedExpectedValues.length || !normalizedActual) return 0;

  return normalizedExpectedValues.reduce((best, normalizedExpected) => {
    if (normalizedActual.includes(normalizedExpected) || normalizedExpected.includes(normalizedActual)) {
      return Math.max(best, 94);
    }

    const distance = levenshtein(normalizedExpected, normalizedActual);
    const maxLen = Math.max(normalizedExpected.length, normalizedActual.length);
    const score = Math.floor((1 - distance / maxLen) * 100);

    const expectedSkeleton = normalizedExpected.replace(/[aeiou]/g, "");
    let skeletonScore = 0;
    if (expectedSkeleton && actualSkeleton) {
      if (expectedSkeleton === actualSkeleton) {
        skeletonScore = 92;
      } else if (
        expectedSkeleton.includes(actualSkeleton) ||
        actualSkeleton.includes(expectedSkeleton)
      ) {
        skeletonScore = 84;
      } else {
        const skeletonDistance = levenshtein(expectedSkeleton, actualSkeleton);
        const skeletonMaxLen = Math.max(expectedSkeleton.length, actualSkeleton.length);
        skeletonScore = Math.floor((1 - skeletonDistance / skeletonMaxLen) * 100);
      }
    }

    return Math.max(best, Math.max(0, Math.min(100, score)), Math.max(0, Math.min(100, skeletonScore)));
  }, 0);
}

function getPronunciationSkeleton(text) {
  return normalizeGreek(text).replace(/[aeiou]/g, "");
}

function normalizeGreek(text) {
  const latinText = containsGreek(text) ? transliterateGreekText(text) : (text || "");
  const speechText = romanizedGreekToSpeechText(latinText);

  return speechText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents/diacritics
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, "")
    .replace(/qu/g, "k")
    .replace(/c/g, "k")
    .replace(/v/g, "f")
    .replace(/y/g, "i")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/ch/g, "k")
    .replace(/ps/g, "p")
    .replace(/kh/g, "k")
    .replace(/ck/g, "k")
    .replace(/ght/g, "t")
    .replace(/ou/g, "u")
    .replace(/ei/g, "i")
    .replace(/ai/g, "e")
    .replace(/oi/g, "i")
    .replace(/ui/g, "i")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/ow/g, "au")
    .replace(/oa/g, "o")
    .replace(/ouh/g, "u")
    .replace(/gue/g, "g")
    .replace(/dge/g, "j")
    .replace(/x/g, "ks");
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

initSpeech();

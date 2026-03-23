// Web Speech API helpers for synthesis and recognition.
const speech = {
  voices: [],
  synth: window.speechSynthesis
};

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

function speakGreek(text) {
  if (!speech.synth) {
    toast("Speech synthesis not supported in this browser.");
    return;
  }

  ensureVoicesReady().finally(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "el-GR";
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const v = pickVoice("el");
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


function listenForGreek(expected, callback) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    toast("Speech recognition not supported (Chrome works best)." );
    callback({ score: 0, transcript: "" });
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "el-GR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;

  recognition.start();
  recognition.onresult = (event) => {
    const alts = Array.from(event.results[0] || []).map((r) => r.transcript.trim());
    const best = alts.reduce(
      (acc, t) => {
        const s = scorePronunciation(expected, t);
        return s > acc.score ? { score: s, transcript: t } : acc;
      },
      { score: 0, transcript: "" }
    );
    callback(best);
  };
  recognition.onerror = () => {
    callback({ score: 0, transcript: "" });
  };
}

// Naive pronunciation score based on character similarity.
function scorePronunciation(expected, actual) {
  if (!expected || !actual) {
    return 0;
  }

  const normalizedExpected = normalizeGreek(expected);
  const normalizedActual = normalizeGreek(actual);

  if (!normalizedExpected || !normalizedActual) return 0;
  if (normalizedActual.includes(normalizedExpected) || normalizedExpected.includes(normalizedActual)) {
    return 90;
  }

  const distance = levenshtein(normalizedExpected, normalizedActual);
  const maxLen = Math.max(normalizedExpected.length, normalizedActual.length);
  const score = Math.floor((1 - distance / maxLen) * 100);
  return Math.max(0, Math.min(100, score));
}

function normalizeGreek(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents/diacritics
    .replace(/[^a-z\u0370-\u03ff\s]/g, "")
    .replace(/\s+/g, "")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/ch/g, "k")
    .replace(/ps/g, "p")
    .replace(/kh/g, "k")
    .replace(/ou/g, "u")
    .replace(/ei/g, "i")
    .replace(/ai/g, "e");
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

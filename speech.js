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
  recognition.maxAlternatives = 1;

  recognition.start();
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    const score = scorePronunciation(expected, transcript);
    callback({ score, transcript });
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

  const normalizedExpected = expected.toLowerCase();
  const normalizedActual = actual.toLowerCase();

  let matches = 0;
  const minLength = Math.min(normalizedExpected.length, normalizedActual.length);
  for (let i = 0; i < minLength; i += 1) {
    if (normalizedExpected[i] === normalizedActual[i]) {
      matches += 1;
    }
  }

  return Math.floor((matches / Math.max(normalizedExpected.length, normalizedActual.length)) * 100);
}

initSpeech();

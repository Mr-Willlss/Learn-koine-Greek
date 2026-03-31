const VOCAB_ILLUSTRATIONS = [
  {
    id: "bread",
    keywords: ["bread"],
    src: "assets/images/vocab/bread.svg",
    alt: "Illustration of bread",
    label: "Bread"
  },
  {
    id: "wine",
    keywords: ["wine"],
    src: "assets/images/vocab/wine.svg",
    alt: "Illustration of a wine glass",
    label: "Wine"
  },
  {
    id: "child",
    keywords: ["child", "children", "girl", "boy"],
    src: "assets/images/vocab/child.svg",
    alt: "Illustration of a child",
    label: "Child"
  },
  {
    id: "son",
    keywords: ["son"],
    src: "assets/images/vocab/son.svg",
    alt: "Illustration of a boy",
    label: "Son"
  },
  {
    id: "king",
    keywords: ["king"],
    src: "assets/images/vocab/king.svg",
    alt: "Illustration of a king",
    label: "King"
  },
  {
    id: "world",
    keywords: ["world"],
    src: "assets/images/vocab/world.svg",
    alt: "Illustration of the earth",
    label: "World"
  },
  {
    id: "earth",
    keywords: ["earth", "land", "country"],
    src: "assets/images/vocab/earth.svg",
    alt: "Illustration of the globe",
    label: "Earth"
  },
  {
    id: "angel",
    keywords: ["angel", "messenger"],
    src: "assets/images/vocab/angel.svg",
    alt: "Illustration of an angel",
    label: "Angel"
  },
  {
    id: "light",
    keywords: ["light", "lamp"],
    src: "assets/images/vocab/light.svg",
    alt: "Illustration of a light bulb",
    label: "Light"
  },
  {
    id: "man",
    keywords: ["man", "person", "male"],
    src: "assets/images/vocab/man.svg",
    alt: "Illustration of a man",
    label: "Man"
  },
  {
    id: "brother",
    keywords: ["brother"],
    src: "assets/images/vocab/brother.svg",
    alt: "Illustration of a person",
    label: "Brother"
  }
];

function normalizeMeaningForIllustration(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[()[\].;:!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchIllustrationKeyword(normalizedMeaning, keyword) {
  if (!normalizedMeaning || !keyword) return false;
  if (normalizedMeaning === keyword) return true;
  return normalizedMeaning.split(",").some((segment) => {
    const tokens = segment.trim().split(/\s+/);
    return tokens.includes(keyword);
  });
}

function findVocabIllustration(vocab) {
  const meaning = normalizeMeaningForIllustration(vocab?.meaning || vocab?.english || "");
  if (!meaning) return null;

  return VOCAB_ILLUSTRATIONS.find((entry) => entry.keywords.some((keyword) => matchIllustrationKeyword(meaning, keyword))) || null;
}

window.VOCAB_ILLUSTRATIONS = VOCAB_ILLUSTRATIONS;
window.findVocabIllustration = findVocabIllustration;

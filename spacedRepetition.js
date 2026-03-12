// Simple spaced repetition engine.
const spacedRepetition = {
  items: {}
};

function initSpacedRepetition(vocab) {
  vocab.forEach((item) => {
    if (!spacedRepetition.items[item.id]) {
      spacedRepetition.items[item.id] = {
        reviewInterval: 1,
        successCount: 0,
        nextReviewTime: Date.now()
      };
    }
  });
}

function updateSpacedRepetition(id, correct) {
  if (!id) {
    return;
  }
  const record = spacedRepetition.items[id];
  if (!record) {
    return;
  }
  if (correct) {
    record.successCount += 1;
    record.reviewInterval = Math.min(record.reviewInterval * 2, 30);
  } else {
    record.reviewInterval = Math.max(Math.floor(record.reviewInterval / 2), 1);
  }
  record.nextReviewTime = Date.now() + record.reviewInterval * 24 * 60 * 60 * 1000;
}

function getReviewItems(vocab) {
  const now = Date.now();
  return vocab.filter((item) => spacedRepetition.items[item.id]?.nextReviewTime <= now);
}

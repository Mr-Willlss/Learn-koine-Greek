const admin = require("firebase-admin");
const functions = require("firebase-functions");

admin.initializeApp();

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const EXERCISE_COUNT = 8;
const EXERCISE_XP = 5;

const LESSON_XP = {
  l1: 10, l2: 10, l3: 15, l4: 20, l5: 25,
  l6: 30, l7: 35, l8: 40, l9: 45, l10: 50,
  l11: 55, l12: 60, l13: 65, l14: 70, l15: 75,
  l16: 80, l17: 85, l18: 90, l19: 95, l20: 100,
  l21: 105, l22: 110, l23: 115, l24: 120, l25: 125
};

const LESSON_ORDER = Object.keys(LESSON_XP);
const TOTAL_LESSONS = Object.keys(LESSON_XP).length;
const LESSON_GEM_REWARD = 250;
const HEART_GEM_COST = 140;
const HEART_MAX = 5;

const RANK_TIERS = [
  { minXp: 0, label: "Novice Scribe" },
  { minXp: 100, label: "Letter Keeper" },
  { minXp: 250, label: "Temple Reader" },
  { minXp: 500, label: "Syntax Scout" },
  { minXp: 900, label: "Covenant Scholar" },
  { minXp: 1400, label: "Logos Ranger" },
  { minXp: 2000, label: "Koine Champion" },
  { minXp: 2800, label: "Golden Orator" }
];

const LEAGUE_TIERS = [
  { minXp: 0, label: "Bronze" },
  { minXp: 60, label: "Silver" },
  { minXp: 150, label: "Gold" },
  { minXp: 280, label: "Sapphire" },
  { minXp: 450, label: "Ruby" },
  { minXp: 700, label: "Diamond" }
];

function requireAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be signed in.");
  }
  return context.auth.uid;
}

function slugifyUsername(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
}

function getRankLabel(totalXp = 0) {
  let active = RANK_TIERS[0].label;
  RANK_TIERS.forEach((tier) => {
    if (totalXp >= tier.minXp) active = tier.label;
  });
  return active;
}

function getLeagueLabel(weeklyXp = 0) {
  let active = LEAGUE_TIERS[0].label;
  LEAGUE_TIERS.forEach((tier) => {
    if (weeklyXp >= tier.minXp) active = tier.label;
  });
  return active;
}

function isoDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function isoWeekKey(date) {
  const working = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = working.getUTCDay() || 7;
  working.setUTCDate(working.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(working.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((working - yearStart) / 86400000) + 1) / 7);
  return `${working.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function baseUserDocument(uid, data = {}) {
  const totalXp = Number.isFinite(data?.stats?.totalXp) ? data.stats.totalXp : 0;
  const weeklyXp = Number.isFinite(data?.social?.weeklyXp) ? data.social.weeklyXp : 0;
  return {
    uid,
    profile: {
      displayName: data?.profile?.displayName || "Greek learner",
      username: data?.profile?.username || `learner${uid.slice(0, 4).toLowerCase()}`,
      usernameLower: data?.profile?.usernameLower || (data?.profile?.username || `learner${uid.slice(0, 4).toLowerCase()}`),
      bio: data?.profile?.bio || "Learning Koine Greek one lesson at a time.",
      photoURL: data?.profile?.photoURL || "",
      isProfilePublic: data?.profile?.isProfilePublic !== false
    },
    stats: {
      totalXp,
      level: Number.isFinite(data?.stats?.level) ? data.stats.level : Math.max(1, Math.floor(totalXp / 50) + 1),
      totalLessonsCompleted: Number.isFinite(data?.stats?.totalLessonsCompleted) ? data.stats.totalLessonsCompleted : 0,
      progressPercent: Number.isFinite(data?.stats?.progressPercent) ? data.stats.progressPercent : 0,
      streakDays: Number.isFinite(data?.stats?.streakDays) ? data.stats.streakDays : 0,
      totalFriends: Number.isFinite(data?.stats?.totalFriends) ? data.stats.totalFriends : 0
    },
    social: {
      weeklyXp,
      weekKey: data?.social?.weekKey || "",
      league: data?.social?.league || getLeagueLabel(weeklyXp),
      rankTitle: data?.social?.rankTitle || getRankLabel(totalXp),
      lastLessonDay: data?.social?.lastLessonDay || "",
      lastLessonCompletedAt: data?.social?.lastLessonCompletedAt || null
    },
    rewards: {
      gems: Number.isFinite(data?.rewards?.gems) ? data.rewards.gems : 0,
      heartPasses: Number.isFinite(data?.rewards?.heartPasses) ? data.rewards.heartPasses : 0,
      crowns: Number.isFinite(data?.rewards?.crowns) ? data.rewards.crowns : 0
    }
  };
}

async function reserveInitialUsername(transaction, uid, desired) {
  let base = slugifyUsername(desired) || `learner${uid.slice(0, 4).toLowerCase()}`;
  let candidate = base;
  let attempt = 0;

  while (attempt < 25) {
    const usernameRef = db.collection("usernames").doc(candidate);
    const usernameDoc = await transaction.get(usernameRef);
    if (!usernameDoc.exists || usernameDoc.data().uid === uid) {
      transaction.set(usernameRef, { uid, createdAt: FieldValue.serverTimestamp() }, { merge: true });
      return candidate;
    }
    attempt += 1;
    candidate = `${base}${attempt}`;
  }

  throw new functions.https.HttpsError("resource-exhausted", "Could not reserve a username. Please try again.");
}

async function swapUsername(transaction, uid, currentUsername, desired) {
  const nextUsername = slugifyUsername(desired);
  if (!nextUsername) {
    throw new functions.https.HttpsError("invalid-argument", "Username must include letters or numbers.");
  }

  if (currentUsername && currentUsername.toLowerCase() === nextUsername.toLowerCase()) {
    return currentUsername;
  }

  const nextRef = db.collection("usernames").doc(nextUsername);
  const nextDoc = await transaction.get(nextRef);
  if (nextDoc.exists && nextDoc.data().uid !== uid) {
    throw new functions.https.HttpsError("already-exists", "That username is already taken.");
  }

  transaction.set(nextRef, { uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (currentUsername) {
    transaction.delete(db.collection("usernames").doc(currentUsername));
  }
  return nextUsername;
}

function friendshipIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

function sanitizeUserForClient(user) {
  return {
    profile: user.profile,
    stats: user.stats,
    social: user.social,
    rewards: user.rewards
  };
}

function getLessonTitle(lessonId) {
  return `Lesson ${String(lessonId || "").replace(/\D/g, "") || lessonId}`;
}

exports.syncUserProfile = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const userRef = db.collection("users").doc(uid);

  const result = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    const current = doc.exists ? baseUserDocument(uid, doc.data()) : baseUserDocument(uid);
    const displayName = String(data?.displayName || current.profile.displayName || "Greek learner").trim().slice(0, 40);
    const photoURL = String(data?.photoURL || current.profile.photoURL || "").trim().slice(0, 500);
    const desiredUsername = current.profile.username || buildFallbackUsername(uid);
    const username = doc.exists
      ? current.profile.username
      : await reserveInitialUsername(transaction, uid, desiredUsername);

    const merged = {
      ...current,
      profile: {
        ...current.profile,
        displayName,
        photoURL,
        username,
        usernameLower: username.toLowerCase()
      },
      updatedAt: FieldValue.serverTimestamp()
    };

    transaction.set(userRef, merged, { merge: true });
    return merged;
  });

  return { user: sanitizeUserForClient(result) };
});

function buildFallbackUsername(uid) {
  return `learner${uid.slice(0, 4).toLowerCase()}`;
}

exports.updateUserProfile = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const userRef = db.collection("users").doc(uid);

  const result = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    const current = baseUserDocument(uid, doc.exists ? doc.data() : {});
    const displayName = String(data?.displayName || current.profile.displayName).trim().slice(0, 40);
    const bio = String(data?.bio || "").trim().slice(0, 180);
    const isProfilePublic = typeof data?.isProfilePublic === "boolean"
      ? data.isProfilePublic
      : current.profile.isProfilePublic;
    const username = await swapUsername(transaction, uid, current.profile.username, data?.username || current.profile.username);

    const merged = {
      ...current,
      profile: {
        ...current.profile,
        displayName,
        username,
        usernameLower: username.toLowerCase(),
        bio,
        isProfilePublic
      },
      updatedAt: FieldValue.serverTimestamp()
    };

    transaction.set(userRef, merged, { merge: true });
    return merged;
  });

  return { user: sanitizeUserForClient(result) };
});

exports.submitLessonCompletion = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const lessonId = String(data?.lessonId || "").trim();
  if (!LESSON_XP[lessonId]) {
    throw new functions.https.HttpsError("invalid-argument", "Unknown lesson.");
  }
  const lessonIndex = LESSON_ORDER.indexOf(lessonId);
  if (lessonIndex < 0) {
    throw new functions.https.HttpsError("invalid-argument", "Unknown lesson order.");
  }

  const userRef = db.collection("users").doc(uid);
  const completionRef = userRef.collection("lessonCompletions").doc(lessonId);
  const previousLessonId = lessonIndex > 0 ? LESSON_ORDER[lessonIndex - 1] : null;
  const previousCompletionRef = previousLessonId
    ? userRef.collection("lessonCompletions").doc(previousLessonId)
    : null;
  const activityRef = db.collection("activities").doc();
  const awardedXp = LESSON_XP[lessonId] + (EXERCISE_COUNT * EXERCISE_XP);
  const rewardSummary = {
    gems: LESSON_GEM_REWARD,
    heartPasses: lessonIndex % 5 === 4 ? 1 : 0,
    crowns: lessonIndex % 5 === 4 ? 1 : 0
  };
  const now = new Date();
  const weekKey = isoWeekKey(now);
  const todayKey = isoDayKey(now);

  const result = await db.runTransaction(async (transaction) => {
    const reads = [
      transaction.get(userRef),
      transaction.get(completionRef)
    ];
    if (previousCompletionRef) {
      reads.push(transaction.get(previousCompletionRef));
    }

    const [userDoc, completionDoc, previousCompletionDoc] = await Promise.all(reads);

    const current = baseUserDocument(uid, userDoc.exists ? userDoc.data() : {});
    if (completionDoc.exists) {
      return {
        alreadyAwarded: true,
        awardedXp: 0,
        user: current
      };
    }
    if (previousLessonId && !previousCompletionDoc?.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Finish ${previousLessonId.toUpperCase()} before claiming ${lessonId.toUpperCase()}.`
      );
    }

    const totalLessonsCompleted = current.stats.totalLessonsCompleted + 1;
    const totalXp = current.stats.totalXp + awardedXp;
    const previousWeekXp = current.social.weekKey === weekKey ? current.social.weeklyXp : 0;
    const weeklyXp = previousWeekXp + awardedXp;
    const level = Math.max(1, Math.floor(totalXp / 50) + 1);
    const progressPercent = Math.round((totalLessonsCompleted / TOTAL_LESSONS) * 100);

    let streakDays = current.stats.streakDays || 0;
    if (!current.social.lastLessonDay) {
      streakDays = 1;
    } else {
      const previousDay = new Date(`${current.social.lastLessonDay}T00:00:00Z`);
      const currentDay = new Date(`${todayKey}T00:00:00Z`);
      const diffDays = Math.round((currentDay - previousDay) / 86400000);
      if (diffDays === 1) {
        streakDays += 1;
      } else if (diffDays > 1) {
        streakDays = 1;
      }
    }

    const merged = {
      ...current,
      stats: {
        ...current.stats,
        totalXp,
        level,
        totalLessonsCompleted,
        progressPercent,
        streakDays
      },
      social: {
        ...current.social,
        weeklyXp,
        weekKey,
        league: getLeagueLabel(weeklyXp),
        rankTitle: getRankLabel(totalXp),
        lastLessonDay: todayKey,
        lastLessonCompletedAt: FieldValue.serverTimestamp()
      },
      rewards: {
        gems: (current.rewards?.gems || 0) + rewardSummary.gems,
        heartPasses: (current.rewards?.heartPasses || 0) + rewardSummary.heartPasses,
        crowns: (current.rewards?.crowns || 0) + rewardSummary.crowns
      },
      updatedAt: FieldValue.serverTimestamp()
    };

    transaction.set(userRef, merged, { merge: true });
    transaction.set(completionRef, {
      lessonId,
      awardedXp,
      createdAt: FieldValue.serverTimestamp()
    });
    transaction.set(activityRef, {
      actorUid: uid,
      visibility: merged.profile.isProfilePublic ? "public" : "private",
      title: `Completed ${lessonId.toUpperCase()}`,
      message: `Earned ${awardedXp} XP, ${rewardSummary.gems} gems, and reached ${merged.social.rankTitle}.`,
      lessonId,
      awardedXp,
      createdAt: FieldValue.serverTimestamp()
    });

    return {
      alreadyAwarded: false,
      awardedXp,
      rewardSummary,
      user: merged
    };
  });

  return {
    alreadyAwarded: result.alreadyAwarded,
    awardedXp: result.awardedXp,
    rewardSummary: result.rewardSummary || { gems: 0, heartPasses: 0, crowns: 0 },
    user: sanitizeUserForClient(result.user)
  };
});

exports.sendFriendRequest = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const targetUid = String(data?.targetUid || "").trim();
  if (!targetUid || targetUid === uid) {
    throw new functions.https.HttpsError("invalid-argument", "Choose another learner.");
  }

  const userRef = db.collection("users").doc(uid);
  const targetRef = db.collection("users").doc(targetUid);
  const requestRef = db.collection("friendRequests").doc(`${uid}_${targetUid}`);
  const reverseRef = db.collection("friendRequests").doc(`${targetUid}_${uid}`);
  const friendshipRef = db.collection("friendships").doc(friendshipIdFor(uid, targetUid));

  await db.runTransaction(async (transaction) => {
    const [userDoc, targetDoc, requestDoc, reverseDoc, friendshipDoc] = await Promise.all([
      transaction.get(userRef),
      transaction.get(targetRef),
      transaction.get(requestRef),
      transaction.get(reverseRef),
      transaction.get(friendshipRef)
    ]);

    if (!targetDoc.exists) {
      throw new functions.https.HttpsError("not-found", "That learner does not exist.");
    }
    if (friendshipDoc.exists) {
      return;
    }
    if (requestDoc.exists) {
      return;
    }

    const selfUser = baseUserDocument(uid, userDoc.exists ? userDoc.data() : {});
    const otherUser = baseUserDocument(targetUid, targetDoc.exists ? targetDoc.data() : {});

    if (reverseDoc.exists) {
      transaction.delete(reverseRef);
      transaction.set(friendshipRef, {
        members: [uid, targetUid].sort(),
        createdAt: FieldValue.serverTimestamp()
      });
      transaction.set(userRef, { "stats.totalFriends": (selfUser.stats.totalFriends || 0) + 1 }, { merge: true });
      transaction.set(targetRef, { "stats.totalFriends": (otherUser.stats.totalFriends || 0) + 1 }, { merge: true });
      return;
    }

    transaction.set(requestRef, {
      fromUid: uid,
      fromDisplayName: selfUser.profile.displayName,
      toUid: targetUid,
      toDisplayName: otherUser.profile.displayName,
      status: "pending",
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true };
});

exports.respondToFriendRequest = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const requestId = String(data?.requestId || "").trim();
  const action = String(data?.action || "").trim();
  const requestRef = db.collection("friendRequests").doc(requestId);

  await db.runTransaction(async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (!requestDoc.exists) return;

    const request = requestDoc.data();
    if (!["accept", "decline", "cancel"].includes(action)) {
      throw new functions.https.HttpsError("invalid-argument", "Unknown friend request action.");
    }

    if (action === "cancel" && request.fromUid !== uid) {
      throw new functions.https.HttpsError("permission-denied", "Only the sender can cancel this request.");
    }
    if ((action === "accept" || action === "decline") && request.toUid !== uid) {
      throw new functions.https.HttpsError("permission-denied", "Only the recipient can respond to this request.");
    }

    if (action === "accept") {
      const userRef = db.collection("users").doc(request.fromUid);
      const targetRef = db.collection("users").doc(request.toUid);
      const [userDoc, targetDoc] = await Promise.all([
        transaction.get(userRef),
        transaction.get(targetRef)
      ]);
      const selfUser = baseUserDocument(request.fromUid, userDoc.exists ? userDoc.data() : {});
      const otherUser = baseUserDocument(request.toUid, targetDoc.exists ? targetDoc.data() : {});

      transaction.set(db.collection("friendships").doc(friendshipIdFor(request.fromUid, request.toUid)), {
        members: [request.fromUid, request.toUid].sort(),
        createdAt: FieldValue.serverTimestamp()
      });
      transaction.set(userRef, { "stats.totalFriends": (selfUser.stats.totalFriends || 0) + 1 }, { merge: true });
      transaction.set(targetRef, { "stats.totalFriends": (otherUser.stats.totalFriends || 0) + 1 }, { merge: true });
    }

    transaction.delete(requestRef);
  });

  return { ok: true };
});

exports.removeFriend = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const targetUid = String(data?.targetUid || "").trim();
  const friendshipRef = db.collection("friendships").doc(friendshipIdFor(uid, targetUid));
  const userRef = db.collection("users").doc(uid);
  const targetRef = db.collection("users").doc(targetUid);

  await db.runTransaction(async (transaction) => {
    const [friendshipDoc, userDoc, targetDoc] = await Promise.all([
      transaction.get(friendshipRef),
      transaction.get(userRef),
      transaction.get(targetRef)
    ]);
    if (!friendshipDoc.exists) return;

    const selfUser = baseUserDocument(uid, userDoc.exists ? userDoc.data() : {});
    const otherUser = baseUserDocument(targetUid, targetDoc.exists ? targetDoc.data() : {});

    transaction.delete(friendshipRef);
    transaction.set(userRef, { "stats.totalFriends": Math.max(0, (selfUser.stats.totalFriends || 1) - 1) }, { merge: true });
    transaction.set(targetRef, { "stats.totalFriends": Math.max(0, (otherUser.stats.totalFriends || 1) - 1) }, { merge: true });
  });

  return { ok: true };
});

exports.sendGift = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const targetUid = String(data?.targetUid || "").trim();
  const giftType = String(data?.giftType || "").trim();
  if (!targetUid || targetUid === uid) {
    throw new functions.https.HttpsError("invalid-argument", "Choose another learner.");
  }
  if (!["heart", "gems"].includes(giftType)) {
    throw new functions.https.HttpsError("invalid-argument", "Unknown gift type.");
  }

  const friendshipRef = db.collection("friendships").doc(friendshipIdFor(uid, targetUid));
  const senderRef = db.collection("users").doc(uid);
  const targetRef = db.collection("users").doc(targetUid);
  const giftRef = db.collection("gifts").doc();

  const result = await db.runTransaction(async (transaction) => {
    const [friendshipDoc, senderDoc, targetDoc] = await Promise.all([
      transaction.get(friendshipRef),
      transaction.get(senderRef),
      transaction.get(targetRef)
    ]);

    if (!friendshipDoc.exists) {
      throw new functions.https.HttpsError("failed-precondition", "You can only send gifts to a friend.");
    }
    if (!targetDoc.exists) {
      throw new functions.https.HttpsError("not-found", "That learner does not exist.");
    }

    const sender = baseUserDocument(uid, senderDoc.exists ? senderDoc.data() : {});
    const recipient = baseUserDocument(targetUid, targetDoc.exists ? targetDoc.data() : {});

    let giftLabel = "Gem Pack";
    let message = `${sender.profile.displayName} sent you a study boost.`;
    const nextSenderRewards = { ...sender.rewards };
    const nextRecipientRewards = { ...recipient.rewards };

    if (giftType === "heart") {
      if ((sender.rewards?.gems || 0) < HEART_GEM_COST) {
        throw new functions.https.HttpsError("failed-precondition", `You need ${HEART_GEM_COST} gems to send a heart gift.`);
      }
      nextSenderRewards.gems -= HEART_GEM_COST;
      nextRecipientRewards.heartPasses += 1;
      giftLabel = "Heart Gift";
      message = `${sender.profile.displayName} sent you a heart refill gift.`;
    } else {
      if ((sender.rewards?.gems || 0) < HEART_GEM_COST) {
        throw new functions.https.HttpsError("failed-precondition", `You need ${HEART_GEM_COST} gems to send a gem pack.`);
      }
      nextSenderRewards.gems -= HEART_GEM_COST;
      nextRecipientRewards.gems += HEART_GEM_COST;
      giftLabel = "Gem Pack";
      message = `${sender.profile.displayName} sent you ${HEART_GEM_COST} gems.`;
    }

    transaction.set(senderRef, { rewards: nextSenderRewards, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(targetRef, { rewards: nextRecipientRewards, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(giftRef, {
      senderUid: uid,
      senderDisplayName: sender.profile.displayName,
      recipientUid: targetUid,
      recipientDisplayName: recipient.profile.displayName,
      giftType,
      giftLabel,
      message,
      createdAt: FieldValue.serverTimestamp()
    });

    return { sender: { ...sender, rewards: nextSenderRewards } };
  });

  return {
    ok: true,
    user: sanitizeUserForClient(result.sender)
  };
});

exports.createStudyRoom = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const lessonId = String(data?.lessonId || "").trim();
  const invitedUid = String(data?.invitedUid || "").trim();
  if (!LESSON_XP[lessonId]) {
    throw new functions.https.HttpsError("invalid-argument", "Choose a valid lesson.");
  }

  const roomRef = db.collection("studyRooms").doc();
  const hostRef = db.collection("users").doc(uid);
  const friendshipRef = invitedUid ? db.collection("friendships").doc(friendshipIdFor(uid, invitedUid)) : null;

  await db.runTransaction(async (transaction) => {
    const hostDoc = await transaction.get(hostRef);
    const host = baseUserDocument(uid, hostDoc.exists ? hostDoc.data() : {});

    if (friendshipRef) {
      const friendshipDoc = await transaction.get(friendshipRef);
      if (!friendshipDoc.exists) {
        throw new functions.https.HttpsError("failed-precondition", "You can only invite a friend to a study room.");
      }
    }

    transaction.set(roomRef, {
      lessonId,
      lessonTitle: getLessonTitle(lessonId),
      hostUid: uid,
      hostDisplayName: host.profile.displayName,
      memberUids: [uid],
      invitedUids: invitedUid ? [invitedUid] : [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true, roomId: roomRef.id };
});

exports.joinStudyRoom = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const roomId = String(data?.roomId || "").trim();
  if (!roomId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing room id.");
  }

  const roomRef = db.collection("studyRooms").doc(roomId);
  await db.runTransaction(async (transaction) => {
    const roomDoc = await transaction.get(roomRef);
    if (!roomDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Study room not found.");
    }
    const room = roomDoc.data();
    const invited = room.invitedUids || [];
    const members = room.memberUids || [];
    if (!invited.includes(uid) && !members.includes(uid)) {
      throw new functions.https.HttpsError("permission-denied", "You are not invited to this study room.");
    }

    const nextMembers = Array.from(new Set([...members, uid]));
    const nextInvited = invited.filter((memberUid) => memberUid !== uid);
    transaction.set(roomRef, {
      memberUids: nextMembers,
      invitedUids: nextInvited,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return { ok: true };
});

exports.sendStudyMessage = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const roomId = String(data?.roomId || "").trim();
  const text = String(data?.text || "").trim().slice(0, 400);
  const kind = String(data?.kind || "question").trim().slice(0, 32);
  if (!roomId || !text) {
    throw new functions.https.HttpsError("invalid-argument", "Room and message text are required.");
  }

  const roomRef = db.collection("studyRooms").doc(roomId);
  const messageRef = roomRef.collection("messages").doc();
  const userRef = db.collection("users").doc(uid);

  await db.runTransaction(async (transaction) => {
    const [roomDoc, userDoc] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(userRef)
    ]);
    if (!roomDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Study room not found.");
    }

    const room = roomDoc.data();
    const members = room.memberUids || [];
    if (!members.includes(uid)) {
      throw new functions.https.HttpsError("permission-denied", "Join the study room before posting.");
    }

    const user = baseUserDocument(uid, userDoc.exists ? userDoc.data() : {});
    transaction.set(messageRef, {
      authorUid: uid,
      authorName: user.profile.displayName,
      kind,
      text,
      createdAt: FieldValue.serverTimestamp()
    });
    transaction.set(roomRef, { updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return { ok: true };
});

exports.redeemHeartPass = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const userRef = db.collection("users").doc(uid);

  const result = await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const user = baseUserDocument(uid, userDoc.exists ? userDoc.data() : {});
    if ((user.rewards?.heartPasses || 0) <= 0) {
      throw new functions.https.HttpsError("failed-precondition", "You do not have a heart gift to use.");
    }

    const nextRewards = {
      ...user.rewards,
      heartPasses: Math.max(0, (user.rewards?.heartPasses || 0) - 1)
    };

    const merged = {
      ...user,
      rewards: nextRewards,
      updatedAt: FieldValue.serverTimestamp()
    };
    transaction.set(userRef, merged, { merge: true });
    return merged;
  });

  return {
    ok: true,
    user: sanitizeUserForClient(result)
  };
});

exports.buyHeartsWithGems = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const requestedHearts = Math.max(1, Math.min(HEART_MAX, Number(data?.heartCount) || 1));
  const gemCost = requestedHearts * HEART_GEM_COST;
  const userRef = db.collection("users").doc(uid);

  const result = await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const user = baseUserDocument(uid, userDoc.exists ? userDoc.data() : {});
    const currentGems = user.rewards?.gems || 0;
    if (currentGems < gemCost) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `You need ${gemCost} gems for ${requestedHearts} heart${requestedHearts === 1 ? "" : "s"}.`
      );
    }

    const merged = {
      ...user,
      rewards: {
        ...user.rewards,
        gems: currentGems - gemCost
      },
      updatedAt: FieldValue.serverTimestamp()
    };

    transaction.set(userRef, merged, { merge: true });
    return merged;
  });

  return {
    ok: true,
    spentGems: gemCost,
    purchasedHearts: requestedHearts,
    user: sanitizeUserForClient(result)
  };
});

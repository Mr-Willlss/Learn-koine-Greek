const socialState = {
  profile: null,
  activities: [],
  friendships: [],
  incomingRequests: [],
  outgoingRequests: [],
  suggestions: [],
  gifts: {
    received: [],
    sent: []
  },
  studyRooms: [],
  leaderboard: {
    global: [],
    weekly: [],
    friends: []
  }
};

const SOCIAL_EXERCISE_XP = 5;

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

const SOCIAL_LESSON_GEM_REWARD = 250;
const SOCIAL_HEART_GEM_COST = 140;
const SOCIAL_HEART_MAX = 5;

function getCurrentSocialUser() {
  if (typeof authState !== "undefined" && authState.user) return authState.user;
  if (window.firebase && firebase.auth) return firebase.auth().currentUser;
  return null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function totalLessonCount() {
  if (!window.lessonData || !Array.isArray(lessonData.worlds)) return 0;
  return lessonData.worlds.reduce((sum, world) => sum + world.lessons.length, 0);
}

function buildUsernameSeed(user) {
  const raw = user?.displayName || user?.email?.split("@")[0] || "learner";
  const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16);
  const suffix = (user?.uid || "user").slice(0, 4).toLowerCase();
  return `${slug || "learner"}${suffix}`;
}

function getRankLabel(totalXp = 0) {
  let active = RANK_TIERS[0];
  RANK_TIERS.forEach((tier) => {
    if (totalXp >= tier.minXp) active = tier;
  });
  return active.label;
}

function getLeagueLabel(weeklyXp = 0) {
  let active = LEAGUE_TIERS[0];
  LEAGUE_TIERS.forEach((tier) => {
    if (weeklyXp >= tier.minXp) active = tier;
  });
  return active.label;
}

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatActivityDate(value) {
  const date = asDate(value);
  if (!date) return "Just now";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function createFallbackProfile(user = getCurrentSocialUser()) {
  const totalXp = progressState?.xp || 0;
  const completed = progressState?.completedLessons?.length || 0;
  const progressPercent = totalLessonCount() ? Math.round((completed / totalLessonCount()) * 100) : 0;
  const weeklyXp = 0;
  return {
    uid: user?.uid || "local",
    profile: {
      displayName: user?.displayName || "Greek learner",
      username: buildUsernameSeed(user),
      usernameLower: buildUsernameSeed(user),
      bio: "Learning Koine Greek one lesson at a time.",
      photoURL: user?.photoURL || "",
      isProfilePublic: true
    },
    stats: {
      totalXp,
      level: Math.max(1, Math.floor(totalXp / 50) + 1),
      totalLessonsCompleted: completed,
      progressPercent,
      streakDays: 0,
      totalFriends: socialState.friendships.length
    },
    social: {
      weeklyXp,
      league: getLeagueLabel(weeklyXp),
      rankTitle: getRankLabel(totalXp),
      lastLessonCompletedAt: null
    },
    rewards: {
      gems: 0,
      heartPasses: 0,
      crowns: 0
    }
  };
}

function normalizeSocialDocData(uid, data) {
  const fallback = createFallbackProfile({ uid });
  const profile = data?.profile || {};
  const stats = data?.stats || {};
  const social = data?.social || {};
  const rewards = data?.rewards || {};
  const totalXp = Number.isFinite(stats.totalXp) ? stats.totalXp : fallback.stats.totalXp;
  const weeklyXp = Number.isFinite(social.weeklyXp) ? social.weeklyXp : 0;

  return {
    uid,
    profile: {
      displayName: profile.displayName || fallback.profile.displayName,
      username: profile.username || fallback.profile.username,
      usernameLower: profile.usernameLower || (profile.username || fallback.profile.username).toLowerCase(),
      bio: profile.bio || fallback.profile.bio,
      photoURL: profile.photoURL || fallback.profile.photoURL,
      isProfilePublic: profile.isProfilePublic !== false
    },
    stats: {
      totalXp,
      level: Number.isFinite(stats.level) ? stats.level : Math.max(1, Math.floor(totalXp / 50) + 1),
      totalLessonsCompleted: Number.isFinite(stats.totalLessonsCompleted) ? stats.totalLessonsCompleted : fallback.stats.totalLessonsCompleted,
      progressPercent: Number.isFinite(stats.progressPercent) ? stats.progressPercent : fallback.stats.progressPercent,
      streakDays: Number.isFinite(stats.streakDays) ? stats.streakDays : 0,
      totalFriends: Number.isFinite(stats.totalFriends) ? stats.totalFriends : socialState.friendships.length
    },
    social: {
      weeklyXp,
      league: social.league || getLeagueLabel(weeklyXp),
      rankTitle: social.rankTitle || getRankLabel(totalXp),
      lastLessonCompletedAt: social.lastLessonCompletedAt || null
    },
    rewards: {
      gems: Number.isFinite(rewards.gems) ? rewards.gems : 0,
      heartPasses: Number.isFinite(rewards.heartPasses) ? rewards.heartPasses : 0,
      crowns: Number.isFinite(rewards.crowns) ? rewards.crowns : 0
    }
  };
}

function applySocialProfile(profile) {
  socialState.profile = profile;
  if (typeof progressState !== "undefined") {
    progressState.xp = profile.stats.totalXp;
    progressState.level = profile.stats.level;
    if (typeof updateStats === "function") updateStats();
  }
  updateSocialChrome();
}

function applyRewardSummaryToChrome(rewardSummary) {
  if (!rewardSummary) return;
  const baseProfile = socialState.profile || createFallbackProfile();
  const profile = {
    ...baseProfile,
    rewards: {
      gems: (baseProfile.rewards?.gems || 0) + (rewardSummary.gems || 0),
      heartPasses: (baseProfile.rewards?.heartPasses || 0) + (rewardSummary.heartPasses || 0),
      crowns: (baseProfile.rewards?.crowns || 0) + (rewardSummary.crowns || 0)
    }
  };
  socialState.profile = profile;
  updateSocialChrome();
}

function updateSocialChrome() {
  const profile = socialState.profile || createFallbackProfile();
  const rankEl = document.getElementById("stat-rank");
  const leagueEl = document.getElementById("stat-league");
  const streakEl = document.getElementById("stat-streak");
  const heroStatus = document.getElementById("hero-status");
  const heroRankBadge = document.getElementById("hero-rank-badge");
  const focusStreak = document.getElementById("focus-streak-value");
  const focusLeagueNote = document.getElementById("focus-league-note");
  const rewardGems = document.getElementById("reward-gems");
  const rewardHearts = document.getElementById("reward-heart-passes");
  const rewardCrowns = document.getElementById("reward-crowns");
  const rewardLast = document.getElementById("reward-last");

  if (rankEl) rankEl.textContent = `Rank ${profile.social.rankTitle}`;
  if (leagueEl) leagueEl.textContent = `League ${profile.social.league}`;
  if (streakEl) streakEl.textContent = `Streak ${profile.stats.streakDays || 0}`;
  if (heroRankBadge) heroRankBadge.textContent = profile.social.rankTitle;
  if (focusStreak) focusStreak.textContent = `${profile.stats.streakDays || 0} days`;
  if (focusLeagueNote) focusLeagueNote.textContent = `${profile.social.league} League`;
  if (rewardGems) rewardGems.textContent = String(profile.rewards?.gems || 0);
  if (rewardHearts) rewardHearts.textContent = String(profile.rewards?.heartPasses || 0);
  if (rewardCrowns) rewardCrowns.textContent = String(profile.rewards?.crowns || 0);
  if (rewardLast) {
    rewardLast.textContent = getCurrentSocialUser()
      ? `${profile.rewards?.gems || 0} gems saved for gifts and boosts`
      : "Sign in to start collecting rewards";
  }

  if (heroStatus) {
    if (getCurrentSocialUser()) {
      heroStatus.textContent = `${profile.profile.displayName} is in the ${profile.social.league} League with ${profile.stats.totalXp} XP. Keep the streak alive with one solid lesson today.`;
    } else {
      heroStatus.textContent = "Sign in to unlock leagues, friends, and cloud-synced progress across your devices.";
    }
  }
}

function setWideModal(title, body) {
  showModal(title, body);
  const card = document.querySelector("#app-modal .modal-card");
  if (card) card.classList.add("modal-card--wide");
}

function clearWideModal() {
  const card = document.querySelector("#app-modal .modal-card");
  if (card) card.classList.remove("modal-card--wide");
}

function getFieldValue() {
  return window.firebase?.firestore?.FieldValue || null;
}

function serverTimestamp() {
  return getFieldValue()?.serverTimestamp?.() || new Date();
}

function arrayUnion(...values) {
  return getFieldValue()?.arrayUnion?.(...values);
}

function arrayRemove(...values) {
  return getFieldValue()?.arrayRemove?.(...values);
}

function friendshipIdFor(a, b) {
  return [a, b].sort().join("__");
}

function friendRequestIdFor(fromUid, toUid) {
  return `${fromUid}__${toUid}`;
}

function getLessonMeta(lessonId) {
  if (!window.lessonData?.worlds) return null;
  for (const world of lessonData.worlds) {
    const lesson = world.lessons.find((item) => item.id === lessonId);
    if (lesson) {
      return { world, lesson, title: `${world.title} - ${lesson.title}` };
    }
  }
  return null;
}

async function ensureFallbackUserDocument(user = getCurrentSocialUser()) {
  if (!db || !user) return createFallbackProfile(user);
  const userRef = db.collection("users").doc(user.uid);
  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const existing = userDoc.exists ? normalizeSocialDocData(user.uid, userDoc.data()) : createFallbackProfile(user);
    const username = existing.profile.username || buildUsernameSeed(user);
    const usernameRef = db.collection("usernames").doc(username.toLowerCase());
    const usernameDoc = await transaction.get(usernameRef);

    const merged = {
      uid: user.uid,
      profile: {
        ...existing.profile,
        displayName: user.displayName || existing.profile.displayName,
        username,
        usernameLower: username.toLowerCase(),
        photoURL: user.photoURL || existing.profile.photoURL,
        isProfilePublic: existing.profile.isProfilePublic !== false
      },
      stats: {
        ...existing.stats,
        totalXp: progressState?.xp ?? existing.stats.totalXp,
        level: progressState?.level ?? existing.stats.level,
        totalLessonsCompleted: progressState?.completedLessons?.length ?? existing.stats.totalLessonsCompleted,
        progressPercent: totalLessonCount()
          ? Math.round(((progressState?.completedLessons?.length ?? existing.stats.totalLessonsCompleted) / totalLessonCount()) * 100)
          : existing.stats.progressPercent
      },
      social: {
        ...existing.social,
        rankTitle: getRankLabel(progressState?.xp ?? existing.stats.totalXp),
        league: existing.social.league || getLeagueLabel(existing.social.weeklyXp || 0)
      },
      rewards: {
        gems: existing.rewards?.gems || 0,
        heartPasses: existing.rewards?.heartPasses || 0,
        crowns: existing.rewards?.crowns || 0
      },
      updatedAt: serverTimestamp()
    };

    transaction.set(userRef, merged, { merge: true });
    if (!usernameDoc.exists || usernameDoc.data()?.uid === user.uid) {
      transaction.set(usernameRef, { uid: user.uid, username, updatedAt: serverTimestamp() }, { merge: true });
    }
    return merged;
  });
}

async function fallbackSyncUserProfile(payload = {}) {
  const user = getCurrentSocialUser();
  if (!user || !db) throw new Error("Sign in to sync your social profile.");
  const merged = await ensureFallbackUserDocument({
    ...user,
    displayName: payload.displayName || user.displayName,
    photoURL: payload.photoURL || user.photoURL
  });
  return { user: merged };
}

async function fallbackUpdateUserProfile(payload = {}) {
  const user = getCurrentSocialUser();
  if (!user || !db) throw new Error("Sign in to save your profile.");
  const userRef = db.collection("users").doc(user.uid);

  const merged = await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const current = userDoc.exists ? normalizeSocialDocData(user.uid, userDoc.data()) : createFallbackProfile(user);
    const desiredUsername = (payload.username || current.profile.username || buildUsernameSeed(user)).trim().toLowerCase();
    const nextUsername = desiredUsername.replace(/[^a-z0-9]+/g, "").slice(0, 20) || current.profile.username;
    const currentUsername = current.profile.usernameLower || current.profile.username.toLowerCase();
    const newUsernameRef = db.collection("usernames").doc(nextUsername);
    const newUsernameDoc = await transaction.get(newUsernameRef);
    if (newUsernameDoc.exists && newUsernameDoc.data()?.uid !== user.uid) {
      throw new Error("That username is already taken.");
    }

    const mergedProfile = {
      ...current,
      profile: {
        ...current.profile,
        displayName: (payload.displayName || current.profile.displayName).trim().slice(0, 40),
        username: nextUsername,
        usernameLower: nextUsername,
        bio: (payload.bio || "").trim().slice(0, 180),
        isProfilePublic: typeof payload.isProfilePublic === "boolean" ? payload.isProfilePublic : current.profile.isProfilePublic,
        photoURL: current.profile.photoURL || user.photoURL || ""
      },
      updatedAt: serverTimestamp()
    };

    transaction.set(userRef, mergedProfile, { merge: true });
    transaction.set(newUsernameRef, { uid: user.uid, username: nextUsername, updatedAt: serverTimestamp() }, { merge: true });
    if (currentUsername !== nextUsername) {
      transaction.delete(db.collection("usernames").doc(currentUsername));
    }
    return mergedProfile;
  });

  return { user: merged };
}

async function fallbackSendFriendRequest(payload = {}) {
  const user = getCurrentSocialUser();
  const targetUid = String(payload.targetUid || "").trim();
  if (!user || !db || !targetUid || targetUid === user.uid) throw new Error("Choose another learner.");

  const requestRef = db.collection("friendRequests").doc(friendRequestIdFor(user.uid, targetUid));
  const reverseRef = db.collection("friendRequests").doc(friendRequestIdFor(targetUid, user.uid));
  const friendshipRef = db.collection("friendships").doc(friendshipIdFor(user.uid, targetUid));

  await db.runTransaction(async (transaction) => {
    const [requestDoc, reverseDoc, friendshipDoc, selfUserDoc, targetUserDoc] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(reverseRef),
      transaction.get(friendshipRef),
      transaction.get(db.collection("users").doc(user.uid)),
      transaction.get(db.collection("users").doc(targetUid))
    ]);
    if (friendshipDoc.exists) return;
    if (reverseDoc.exists && reverseDoc.data()?.status === "pending") {
      const selfUser = selfUserDoc.exists ? normalizeSocialDocData(user.uid, selfUserDoc.data()) : createFallbackProfile(user);
      const targetUser = targetUserDoc.exists ? normalizeSocialDocData(targetUid, targetUserDoc.data()) : createFallbackProfile({ uid: targetUid });
      transaction.delete(reverseRef);
      transaction.set(friendshipRef, {
        members: [user.uid, targetUid].sort(),
        createdAt: serverTimestamp()
      });
      transaction.set(db.collection("users").doc(user.uid), { "stats.totalFriends": (selfUser.stats.totalFriends || 0) + 1 }, { merge: true });
      transaction.set(db.collection("users").doc(targetUid), { "stats.totalFriends": (targetUser.stats.totalFriends || 0) + 1 }, { merge: true });
      return;
    }
    if (requestDoc.exists) return;
    transaction.set(requestRef, {
      fromUid: user.uid,
      toUid: targetUid,
      status: "pending",
      createdAt: serverTimestamp()
    });
  });
  return { ok: true };
}

async function fallbackRespondToFriendRequest(payload = {}) {
  const user = getCurrentSocialUser();
  const requestId = String(payload.requestId || "").trim();
  const action = String(payload.action || "").trim();
  if (!user || !db || !requestId) throw new Error("Choose a request first.");
  const requestRef = db.collection("friendRequests").doc(requestId);

  await db.runTransaction(async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (!requestDoc.exists) return;
    const request = requestDoc.data();
    if (![request.fromUid, request.toUid].includes(user.uid)) throw new Error("You cannot change that request.");
    if (action === "accept") {
      const friendshipRef = db.collection("friendships").doc(friendshipIdFor(request.fromUid, request.toUid));
      const [selfUserDoc, otherUserDoc] = await Promise.all([
        transaction.get(db.collection("users").doc(request.toUid)),
        transaction.get(db.collection("users").doc(request.fromUid))
      ]);
      const selfUser = selfUserDoc.exists ? normalizeSocialDocData(request.toUid, selfUserDoc.data()) : createFallbackProfile({ uid: request.toUid });
      const otherUser = otherUserDoc.exists ? normalizeSocialDocData(request.fromUid, otherUserDoc.data()) : createFallbackProfile({ uid: request.fromUid });
      transaction.set(friendshipRef, {
        members: [request.fromUid, request.toUid].sort(),
        createdAt: serverTimestamp()
      });
      transaction.set(db.collection("users").doc(request.toUid), { "stats.totalFriends": (selfUser.stats.totalFriends || 0) + 1 }, { merge: true });
      transaction.set(db.collection("users").doc(request.fromUid), { "stats.totalFriends": (otherUser.stats.totalFriends || 0) + 1 }, { merge: true });
      transaction.delete(requestRef);
      return;
    }
    transaction.delete(requestRef);
  });
  return { ok: true };
}

async function fallbackRemoveFriend(payload = {}) {
  const user = getCurrentSocialUser();
  const targetUid = String(payload.targetUid || "").trim();
  if (!user || !db || !targetUid) throw new Error("Choose a friend first.");
  const friendshipRef = db.collection("friendships").doc(friendshipIdFor(user.uid, targetUid));

  await db.runTransaction(async (transaction) => {
    const [friendshipDoc, selfUserDoc, targetUserDoc] = await Promise.all([
      transaction.get(friendshipRef),
      transaction.get(db.collection("users").doc(user.uid)),
      transaction.get(db.collection("users").doc(targetUid))
    ]);
    if (!friendshipDoc.exists) return;
    const selfUser = selfUserDoc.exists ? normalizeSocialDocData(user.uid, selfUserDoc.data()) : createFallbackProfile(user);
    const targetUser = targetUserDoc.exists ? normalizeSocialDocData(targetUid, targetUserDoc.data()) : createFallbackProfile({ uid: targetUid });
    transaction.delete(friendshipRef);
    transaction.set(db.collection("users").doc(user.uid), { "stats.totalFriends": Math.max(0, (selfUser.stats.totalFriends || 1) - 1) }, { merge: true });
    transaction.set(db.collection("users").doc(targetUid), { "stats.totalFriends": Math.max(0, (targetUser.stats.totalFriends || 1) - 1) }, { merge: true });
  });
  return { ok: true };
}

async function fallbackSendGift(payload = {}) {
  const user = getCurrentSocialUser();
  const targetUid = String(payload.targetUid || "").trim();
  const giftType = String(payload.giftType || "").trim();
  if (!user || !db || !targetUid || !["heart", "gems"].includes(giftType)) throw new Error("Choose a valid gift.");

  const result = await db.runTransaction(async (transaction) => {
    const friendshipRef = db.collection("friendships").doc(friendshipIdFor(user.uid, targetUid));
    const giftRef = db.collection("gifts").doc();
    const [friendshipDoc, senderDoc, recipientDoc] = await Promise.all([
      transaction.get(friendshipRef),
      transaction.get(db.collection("users").doc(user.uid)),
      transaction.get(db.collection("users").doc(targetUid))
    ]);
    if (!friendshipDoc.exists) throw new Error("Add this learner as a friend first.");
    const sender = senderDoc.exists ? normalizeSocialDocData(user.uid, senderDoc.data()) : createFallbackProfile(user);
    const recipient = recipientDoc.exists ? normalizeSocialDocData(targetUid, recipientDoc.data()) : createFallbackProfile({ uid: targetUid });
    const nextSenderRewards = { ...sender.rewards };
    const nextRecipientRewards = { ...recipient.rewards };
    let giftLabel = "Gem Pack";
    let message = `${sender.profile.displayName} sent you a study boost.`;

    if (giftType === "heart") {
      if ((sender.rewards?.gems || 0) < SOCIAL_HEART_GEM_COST) throw new Error(`You need ${SOCIAL_HEART_GEM_COST} gems to send a heart gift.`);
      nextSenderRewards.gems -= SOCIAL_HEART_GEM_COST;
      nextRecipientRewards.heartPasses += 1;
      giftLabel = "Heart Gift";
      message = `${sender.profile.displayName} sent you a heart refill gift.`;
    } else {
      if ((sender.rewards?.gems || 0) < SOCIAL_HEART_GEM_COST) throw new Error(`You need ${SOCIAL_HEART_GEM_COST} gems to send a gem pack.`);
      nextSenderRewards.gems -= SOCIAL_HEART_GEM_COST;
      nextRecipientRewards.gems += SOCIAL_HEART_GEM_COST;
      message = `${sender.profile.displayName} sent you ${SOCIAL_HEART_GEM_COST} gems.`;
    }

    transaction.set(db.collection("users").doc(user.uid), { rewards: nextSenderRewards, updatedAt: serverTimestamp() }, { merge: true });
    transaction.set(db.collection("users").doc(targetUid), { rewards: nextRecipientRewards, updatedAt: serverTimestamp() }, { merge: true });
    transaction.set(giftRef, {
      senderUid: user.uid,
      senderDisplayName: sender.profile.displayName,
      recipientUid: targetUid,
      recipientDisplayName: recipient.profile.displayName,
      giftType,
      giftLabel,
      message,
      createdAt: serverTimestamp()
    });
    return { ...sender, rewards: nextSenderRewards };
  });

  return { ok: true, user: result };
}

async function fallbackRedeemHeartPass() {
  const user = getCurrentSocialUser();
  if (!user || !db) throw new Error("Sign in to use a heart gift.");
  const merged = await db.runTransaction(async (transaction) => {
    const userRef = db.collection("users").doc(user.uid);
    const userDoc = await transaction.get(userRef);
    const current = userDoc.exists ? normalizeSocialDocData(user.uid, userDoc.data()) : createFallbackProfile(user);
    if ((current.rewards?.heartPasses || 0) <= 0) throw new Error("You do not have a heart gift to use.");
    const nextRewards = { ...current.rewards, heartPasses: Math.max(0, (current.rewards?.heartPasses || 0) - 1) };
    const mergedProfile = { ...current, rewards: nextRewards, updatedAt: serverTimestamp() };
    transaction.set(userRef, mergedProfile, { merge: true });
    return mergedProfile;
  });
  return { ok: true, user: merged };
}

async function fallbackBuyHeartsWithGems(payload = {}) {
  const user = getCurrentSocialUser();
  const heartCount = Math.max(1, Math.min(SOCIAL_HEART_MAX, Number(payload.heartCount) || 1));
  if (!user || !db) throw new Error("Sign in to buy hearts.");
  const merged = await db.runTransaction(async (transaction) => {
    const userRef = db.collection("users").doc(user.uid);
    const userDoc = await transaction.get(userRef);
    const current = userDoc.exists ? normalizeSocialDocData(user.uid, userDoc.data()) : createFallbackProfile(user);
    const gemCost = heartCount * SOCIAL_HEART_GEM_COST;
    if ((current.rewards?.gems || 0) < gemCost) throw new Error(`You need ${gemCost} gems for ${heartCount} heart${heartCount === 1 ? "" : "s"}.`);
    const nextRewards = { ...current.rewards, gems: (current.rewards?.gems || 0) - gemCost };
    const mergedProfile = { ...current, rewards: nextRewards, updatedAt: serverTimestamp() };
    transaction.set(userRef, mergedProfile, { merge: true });
    return mergedProfile;
  });
  return { ok: true, spentGems: heartCount * SOCIAL_HEART_GEM_COST, purchasedHearts: heartCount, user: merged };
}

async function fallbackCreateStudyRoom(payload = {}) {
  const user = getCurrentSocialUser();
  const lessonId = String(payload.lessonId || "").trim();
  const invitedUid = String(payload.invitedUid || "").trim();
  if (!user || !db || !lessonId) throw new Error("Choose a lesson first.");
  const lessonMeta = getLessonMeta(lessonId);
  const roomRef = db.collection("studyRooms").doc();
  const hostProfile = socialState.profile || (await ensureFallbackUserDocument(user));
  await roomRef.set({
    hostUid: user.uid,
    hostDisplayName: hostProfile.profile.displayName,
    lessonId,
    lessonTitle: lessonMeta?.title || lessonId,
    memberUids: [user.uid],
    invitedUids: invitedUid ? [invitedUid] : [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { ok: true, roomId: roomRef.id };
}

async function fallbackJoinStudyRoom(payload = {}) {
  const user = getCurrentSocialUser();
  const roomId = String(payload.roomId || "").trim();
  if (!user || !db || !roomId) throw new Error("Choose a room first.");
  const roomRef = db.collection("studyRooms").doc(roomId);
  await roomRef.set({
    memberUids: arrayUnion(user.uid) || [user.uid],
    invitedUids: arrayRemove(user.uid) || [],
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { ok: true };
}

async function fallbackSendStudyMessage(payload = {}) {
  const user = getCurrentSocialUser();
  const roomId = String(payload.roomId || "").trim();
  const text = String(payload.text || "").trim();
  const kind = String(payload.kind || "note").trim();
  if (!user || !db || !roomId || !text) throw new Error("Write a message first.");
  const roomRef = db.collection("studyRooms").doc(roomId);
  const roomDoc = await roomRef.get();
  if (!roomDoc.exists) throw new Error("That study room no longer exists.");
  const room = roomDoc.data();
  const allowed = (room.memberUids || []).includes(user.uid) || (room.invitedUids || []).includes(user.uid);
  if (!allowed) throw new Error("You are not part of that study room yet.");
  const profile = socialState.profile || (await ensureFallbackUserDocument(user));
  await roomRef.collection("messages").add({
    authorUid: user.uid,
    authorName: profile.profile.displayName,
    text,
    kind,
    createdAt: serverTimestamp()
  });
  await roomRef.set({
    memberUids: arrayUnion(user.uid) || [user.uid],
    invitedUids: arrayRemove(user.uid) || [],
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { ok: true };
}

async function fallbackSubmitLessonCompletion(payload = {}) {
  const user = getCurrentSocialUser();
  const lessonId = String(payload.lessonId || "").trim();
  if (!user || !db || !lessonId) return null;
  const userRef = db.collection("users").doc(user.uid);
  const completionRef = userRef.collection("lessonCompletions").doc(lessonId);
  const activityRef = db.collection("activities").doc();

  const result = await db.runTransaction(async (transaction) => {
    const [userDoc, completionDoc] = await Promise.all([
      transaction.get(userRef),
      transaction.get(completionRef)
    ]);
    const current = userDoc.exists ? normalizeSocialDocData(user.uid, userDoc.data()) : createFallbackProfile(user);
    if (completionDoc.exists) {
      return { alreadyAwarded: true, awardedXp: 0, rewardSummary: null, user: current };
    }

    const awardedXp = typeof lessonXpEarned !== "undefined" && Number.isFinite(lessonXpEarned)
      ? lessonXpEarned
      : (getLessonMeta(lessonId)?.lesson?.xp || 0);
    const rewardSummary = {
      gems: SOCIAL_LESSON_GEM_REWARD,
      heartPasses: 0,
      crowns: ((progressState?.completedLessons?.length || 0) + 1) % 5 === 0 ? 1 : 0
    };
    const completedCount = new Set([...(progressState?.completedLessons || []), lessonId]).size;
    const totalXp = (current.stats.totalXp || 0) + awardedXp;
    const weeklyXp = (current.social.weeklyXp || 0) + awardedXp;
    const merged = {
      ...current,
      stats: {
        ...current.stats,
        totalXp,
        level: Math.max(1, Math.floor(totalXp / 50) + 1),
        totalLessonsCompleted: completedCount,
        progressPercent: totalLessonCount() ? Math.round((completedCount / totalLessonCount()) * 100) : 0
      },
      social: {
        ...current.social,
        weeklyXp,
        league: getLeagueLabel(weeklyXp),
        rankTitle: getRankLabel(totalXp),
        lastLessonCompletedAt: serverTimestamp()
      },
      rewards: {
        gems: (current.rewards?.gems || 0) + rewardSummary.gems,
        heartPasses: (current.rewards?.heartPasses || 0) + rewardSummary.heartPasses,
        crowns: (current.rewards?.crowns || 0) + rewardSummary.crowns
      },
      updatedAt: serverTimestamp()
    };

    transaction.set(userRef, merged, { merge: true });
    transaction.set(completionRef, { lessonId, awardedXp, createdAt: serverTimestamp() });
    transaction.set(activityRef, {
      actorUid: user.uid,
      visibility: merged.profile.isProfilePublic ? "public" : "private",
      title: `Completed ${lessonId.toUpperCase()}`,
      message: `Earned ${awardedXp} XP, ${rewardSummary.gems} gems, and reached ${merged.social.rankTitle}.`,
      lessonId,
      awardedXp,
      createdAt: serverTimestamp()
    });
    return { alreadyAwarded: false, awardedXp, rewardSummary, user: merged };
  });

  return result;
}

async function socialFallbackCall(name, payload = {}) {
  switch (name) {
    case "syncUserProfile":
      return fallbackSyncUserProfile(payload);
    case "updateUserProfile":
      return fallbackUpdateUserProfile(payload);
    case "sendFriendRequest":
      return fallbackSendFriendRequest(payload);
    case "respondToFriendRequest":
      return fallbackRespondToFriendRequest(payload);
    case "removeFriend":
      return fallbackRemoveFriend(payload);
    case "sendGift":
      return fallbackSendGift(payload);
    case "redeemHeartPass":
      return fallbackRedeemHeartPass(payload);
    case "buyHeartsWithGems":
      return fallbackBuyHeartsWithGems(payload);
    case "createStudyRoom":
      return fallbackCreateStudyRoom(payload);
    case "joinStudyRoom":
      return fallbackJoinStudyRoom(payload);
    case "sendStudyMessage":
      return fallbackSendStudyMessage(payload);
    case "submitLessonCompletion":
      return fallbackSubmitLessonCompletion(payload);
    default:
      throw new Error("This feature still needs Cloud Functions.");
  }
}

function socialCall(name, payload = {}) {
  if (functions) {
    return functions.httpsCallable(name)(payload)
      .then((result) => result.data || {})
      .catch((error) => {
        const code = String(error?.code || "");
        const shouldFallback = code.includes("not-found") || code.includes("unimplemented") || code.includes("unavailable") || code.includes("failed-precondition");
        if (shouldFallback) {
          return socialFallbackCall(name, payload);
        }
        throw error;
      });
  }
  return socialFallbackCall(name, payload);
}

async function syncSocialAuthProfile() {
  const user = getCurrentSocialUser();
  if (!user || !db) {
    applySocialProfile(createFallbackProfile(user));
    return socialState.profile;
  }

  try {
    const data = await socialCall("syncUserProfile", {
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      email: user.email || ""
    });

    if (data.user) {
      applySocialProfile(normalizeSocialDocData(user.uid, data.user));
      return socialState.profile;
    }
  } catch (error) {
    console.error("Social profile sync failed", error);
    applySocialProfile(createFallbackProfile(user));
    return socialState.profile;
  }

  return loadOwnSocialProfile();
}

async function loadOwnSocialProfile() {
  const user = getCurrentSocialUser();
  if (!user || !db) {
    applySocialProfile(createFallbackProfile(user));
    return socialState.profile;
  }

  const doc = await db.collection("users").doc(user.uid).get();
  if (!doc.exists) {
    return syncSocialAuthProfile();
  }

  applySocialProfile(normalizeSocialDocData(user.uid, doc.data()));
  return socialState.profile;
}

async function loadOwnActivities() {
  const user = getCurrentSocialUser();
  if (!user || !db) {
    socialState.activities = [];
    return [];
  }

  const snapshot = await db
    .collection("activities")
    .where("actorUid", "==", user.uid)
    .orderBy("createdAt", "desc")
    .limit(6)
    .get();

  socialState.activities = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return socialState.activities;
}

async function loadLeaderboardRows(fieldPath) {
  if (!db) return [];
  const snapshot = await db
    .collection("users")
    .where("profile.isProfilePublic", "==", true)
    .orderBy(fieldPath, "desc")
    .limit(20)
    .get();

  return snapshot.docs.map((doc, index) => {
    const profile = normalizeSocialDocData(doc.id, doc.data());
    return {
      position: index + 1,
      uid: doc.id,
      displayName: profile.profile.displayName,
      username: profile.profile.username,
      photoURL: profile.profile.photoURL,
      totalXp: profile.stats.totalXp,
      weeklyXp: profile.social.weeklyXp,
      rankTitle: profile.social.rankTitle,
      league: profile.social.league,
      progressPercent: profile.stats.progressPercent
    };
  });
}

async function loadFriendsState() {
  const user = getCurrentSocialUser();
  if (!user || !db) {
    socialState.friendships = [];
    socialState.incomingRequests = [];
    socialState.outgoingRequests = [];
    return socialState;
  }

  const [friendshipsSnap, incomingSnap, outgoingSnap] = await Promise.all([
    db.collection("friendships").where("members", "array-contains", user.uid).orderBy("createdAt", "desc").get(),
    db.collection("friendRequests").where("toUid", "==", user.uid).where("status", "==", "pending").orderBy("createdAt", "desc").get(),
    db.collection("friendRequests").where("fromUid", "==", user.uid).where("status", "==", "pending").orderBy("createdAt", "desc").get()
  ]);

  const friendDocs = friendshipsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const friendIds = friendDocs.map((friendship) => friendship.members.find((memberId) => memberId !== user.uid)).filter(Boolean);

  let friendProfiles = [];
  if (friendIds.length) {
    const snapshots = await Promise.all(friendIds.map((uid) => db.collection("users").doc(uid).get()));
    friendProfiles = snapshots
      .filter((doc) => doc.exists)
      .map((doc) => normalizeSocialDocData(doc.id, doc.data()));
  }

  socialState.friendships = friendDocs.map((friendship) => {
    const friendUid = friendship.members.find((memberId) => memberId !== user.uid);
    const friendProfile = friendProfiles.find((profile) => profile.uid === friendUid);
    return {
      id: friendship.id,
      uid: friendUid,
      createdAt: friendship.createdAt,
      profile: friendProfile || createFallbackProfile({ uid: friendUid })
    };
  });

  socialState.incomingRequests = incomingSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  socialState.outgoingRequests = outgoingSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  updateSocialChrome();
  return socialState;
}

async function loadGiftsState() {
  const user = getCurrentSocialUser();
  if (!user || !db) {
    socialState.gifts.received = [];
    socialState.gifts.sent = [];
    return socialState.gifts;
  }

  const [receivedSnap, sentSnap] = await Promise.all([
    db.collection("gifts").where("recipientUid", "==", user.uid).orderBy("createdAt", "desc").limit(12).get(),
    db.collection("gifts").where("senderUid", "==", user.uid).orderBy("createdAt", "desc").limit(12).get()
  ]);

  socialState.gifts.received = receivedSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  socialState.gifts.sent = sentSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return socialState.gifts;
}

async function loadStudyRoomsState() {
  const user = getCurrentSocialUser();
  if (!user || !db) {
    socialState.studyRooms = [];
    return [];
  }

  const [memberSnap, invitedSnap] = await Promise.all([
    db.collection("studyRooms").where("memberUids", "array-contains", user.uid).orderBy("updatedAt", "desc").limit(8).get(),
    db.collection("studyRooms").where("invitedUids", "array-contains", user.uid).orderBy("updatedAt", "desc").limit(8).get()
  ]);

  const seen = new Set();
  socialState.studyRooms = [...memberSnap.docs, ...invitedSnap.docs]
    .filter((doc) => {
      if (seen.has(doc.id)) return false;
      seen.add(doc.id);
      return true;
    })
    .map((doc) => ({ id: doc.id, ...doc.data() }));

  return socialState.studyRooms;
}

async function loadLeaderboards() {
  const [globalRows, weeklyRows] = await Promise.all([
    loadLeaderboardRows("stats.totalXp"),
    loadLeaderboardRows("social.weeklyXp")
  ]);

  socialState.leaderboard.global = globalRows;
  socialState.leaderboard.weekly = weeklyRows;

  const friendIds = new Set(socialState.friendships.map((friend) => friend.uid));
  const selfUid = getCurrentSocialUser()?.uid;
  if (selfUid) friendIds.add(selfUid);
  socialState.leaderboard.friends = [socialState.profile, ...socialState.friendships.map((friend) => friend.profile)]
    .filter(Boolean)
    .filter((profile) => friendIds.has(profile.uid))
    .sort((a, b) => (b.stats.totalXp || 0) - (a.stats.totalXp || 0))
    .map((profile, index) => ({
      position: index + 1,
      uid: profile.uid,
      displayName: profile.profile.displayName,
      username: profile.profile.username,
      photoURL: profile.profile.photoURL,
      totalXp: profile.stats.totalXp,
      weeklyXp: profile.social.weeklyXp,
      rankTitle: profile.social.rankTitle,
      league: profile.social.league,
      progressPercent: profile.stats.progressPercent
    }));
  return socialState.leaderboard;
}

function buildSuggestionReason(profile, currentProfile) {
  if (!currentProfile) return "Public learner on the same platform";
  if (profile.social.league === currentProfile.social.league) {
    return `Also in ${profile.social.league} League`;
  }
  if (Math.abs((profile.stats.totalXp || 0) - (currentProfile.stats.totalXp || 0)) <= 150) {
    return "Very close to your XP level";
  }
  if (Math.abs((profile.stats.progressPercent || 0) - (currentProfile.stats.progressPercent || 0)) <= 10) {
    return "On a similar lesson path";
  }
  if ((profile.stats.streakDays || 0) >= 3) {
    return "Keeps an active learning streak";
  }
  return "Good learner to add to your study circle";
}

function scoreSuggestedProfile(profile, currentProfile) {
  if (!currentProfile) return 0;
  let score = 0;
  if (profile.social.league === currentProfile.social.league) score += 45;
  score += Math.max(0, 40 - Math.abs((profile.stats.totalXp || 0) - (currentProfile.stats.totalXp || 0)) / 12);
  score += Math.max(0, 25 - Math.abs((profile.stats.progressPercent || 0) - (currentProfile.stats.progressPercent || 0)));
  score += Math.min(12, profile.stats.streakDays || 0);
  return score;
}

async function loadSuggestedFriends() {
  const user = getCurrentSocialUser();
  if (!db) {
    socialState.suggestions = [];
    return [];
  }

  const [xpSnap, progressSnap] = await Promise.all([
    db.collection("users")
      .where("profile.isProfilePublic", "==", true)
      .orderBy("stats.totalXp", "desc")
      .limit(18)
      .get(),
    db.collection("users")
      .where("profile.isProfilePublic", "==", true)
      .orderBy("stats.progressPercent", "desc")
      .limit(18)
      .get()
  ]);

  const blockedIds = new Set([
    user?.uid,
    ...socialState.friendships.map((friend) => friend.uid),
    ...socialState.incomingRequests.map((request) => request.fromUid),
    ...socialState.outgoingRequests.map((request) => request.toUid)
  ]);

  const seen = new Map();
  [...xpSnap.docs, ...progressSnap.docs].forEach((doc) => {
    if (blockedIds.has(doc.id)) return;
    if (!seen.has(doc.id)) {
      seen.set(doc.id, normalizeSocialDocData(doc.id, doc.data()));
    }
  });

  const currentProfile = socialState.profile || createFallbackProfile(user);
  socialState.suggestions = [...seen.values()]
    .map((profile) => ({
      ...profile,
      suggestionReason: buildSuggestionReason(profile, currentProfile),
      suggestionScore: scoreSuggestedProfile(profile, currentProfile)
    }))
    .sort((a, b) => b.suggestionScore - a.suggestionScore)
    .slice(0, 6);

  return socialState.suggestions;
}

async function searchPlayers(term) {
  const user = getCurrentSocialUser();
  if (!db || !term.trim()) return [];
  const normalized = term.trim().toLowerCase();

  const snapshot = await db
    .collection("users")
    .where("profile.isProfilePublic", "==", true)
    .orderBy("profile.usernameLower")
    .startAt(normalized)
    .endAt(`${normalized}\uf8ff`)
    .limit(8)
    .get();

  return snapshot.docs
    .filter((doc) => doc.id !== user?.uid)
    .map((doc) => normalizeSocialDocData(doc.id, doc.data()));
}

function renderActivityFeed(items) {
  if (!items.length) {
    return `<p class="muted">Your recent wins will show up here as you complete lessons.</p>`;
  }

  return items
    .map((item) => `
      <div class="social-list-row">
        <div>
          <strong>${escapeHtml(item.title || "Lesson complete")}</strong>
          <p class="muted">${escapeHtml(item.message || "Progress saved to your profile.")}</p>
        </div>
        <span class="social-meta">${escapeHtml(formatActivityDate(item.createdAt))}</span>
      </div>
    `)
    .join("");
}

function leaderboardRowsMarkup(rows, valueLabel) {
  if (!rows.length) {
    return `<p class="muted">No public players yet. Be the first scholar on the board.</p>`;
  }

  return rows
    .map((row) => `
      <div class="social-list-row ${row.uid === getCurrentSocialUser()?.uid ? "is-self" : ""}">
        <div class="social-player">
          <div class="social-rank-pill">#${row.position}</div>
          <div>
            <strong>${escapeHtml(row.displayName)}</strong>
            <p class="muted">@${escapeHtml(row.username)} - ${escapeHtml(row.rankTitle)}</p>
          </div>
        </div>
        <div class="social-score">
          <strong>${escapeHtml(String(valueLabel === "Weekly XP" ? row.weeklyXp : row.totalXp))}</strong>
          <span class="social-meta">${escapeHtml(valueLabel)}</span>
        </div>
      </div>
    `)
    .join("");
}

function friendshipRowsMarkup() {
  if (!socialState.friendships.length) {
    return `<p class="muted">No friends yet. Search for a learner and send your first request.</p>`;
  }

  return socialState.friendships
    .map((friend) => `
      <div class="social-list-row">
        <div>
          <strong>${escapeHtml(friend.profile.profile.displayName)}</strong>
          <p class="muted">@${escapeHtml(friend.profile.profile.username)} - ${escapeHtml(friend.profile.social.rankTitle)} - ${friend.profile.stats.totalXp} XP</p>
        </div>
        <div class="social-actions">
          <button class="btn ghost" data-view-profile="${escapeHtml(friend.uid)}" type="button">View</button>
          <button class="btn ghost" data-remove-friend="${escapeHtml(friend.uid)}" type="button">Remove</button>
        </div>
      </div>
    `)
    .join("");
}

function suggestedFriendRowsMarkup() {
  if (!socialState.suggestions.length) {
    return `<p class="muted">No suggestions yet. As more learners sign in, this list will start filling up.</p>`;
  }

  return socialState.suggestions
    .map((profile) => `
      <div class="social-list-row social-list-row--suggested">
        <div>
          <strong>${escapeHtml(profile.profile.displayName)}</strong>
          <p class="muted">@${escapeHtml(profile.profile.username)} - ${escapeHtml(profile.social.rankTitle)} - ${profile.stats.totalXp} XP</p>
          <p class="social-reason">${escapeHtml(profile.suggestionReason || "Good learner to add to your study circle")}</p>
        </div>
        <div class="social-actions">
          <button class="btn ghost" data-view-profile="${escapeHtml(profile.uid)}" type="button">View</button>
          <button class="btn" data-send-request="${escapeHtml(profile.uid)}" type="button">Add friend</button>
        </div>
      </div>
    `)
    .join("");
}

function requestRowsMarkup(items, kind) {
  if (!items.length) return `<p class="muted">No ${kind} requests right now.</p>`;

  return items
    .map((item) => `
      <div class="social-list-row">
        <div>
          <strong>${escapeHtml(item.fromDisplayName || item.toDisplayName || "Greek learner")}</strong>
          <p class="muted">${kind === "incoming" ? "Wants to join your study circle." : "Pending approval."}</p>
        </div>
        <div class="social-actions">
          ${
            kind === "incoming"
              ? `<button class="btn" data-accept-request="${escapeHtml(item.id)}" type="button">Accept</button>
                 <button class="btn ghost" data-decline-request="${escapeHtml(item.id)}" type="button">Decline</button>`
              : `<button class="btn ghost" data-cancel-request="${escapeHtml(item.id)}" type="button">Cancel</button>`
          }
        </div>
      </div>
    `)
    .join("");
}

function giftRowsMarkup(items, emptyMessage) {
  if (!items.length) return `<p class="muted">${escapeHtml(emptyMessage)}</p>`;

  return items
    .map((item) => `
      <div class="gift-card">
        <h5>${escapeHtml(item.giftLabel || item.giftType || "Gift")}</h5>
        <p>${escapeHtml(item.message || "A study boost was shared.")}</p>
        <p class="social-meta">${escapeHtml(formatActivityDate(item.createdAt))}</p>
      </div>
    `)
    .join("");
}

function studyRoomCardsMarkup(items) {
  if (!items.length) {
    return `<p class="muted">No study rooms yet. Start one for your next lesson and invite a friend.</p>`;
  }

  return items
    .map((room) => `
      <div class="study-room-card">
        <h5>${escapeHtml(room.lessonTitle || room.lessonId || "Study room")}</h5>
        <p class="study-room-meta">Host: ${escapeHtml(room.hostDisplayName || "Greek learner")} - ${escapeHtml(room.memberUids?.length || 1)} learners inside</p>
        <div class="social-actions">
          <button class="btn ghost" data-open-room="${escapeHtml(room.id)}" type="button">Open room</button>
          ${room.invitedUids?.includes(getCurrentSocialUser()?.uid) ? `<button class="btn" data-join-room="${escapeHtml(room.id)}" type="button">Join</button>` : ""}
        </div>
      </div>
    `)
    .join("");
}

function friendGiftOptionsMarkup() {
  if (!socialState.friendships.length) {
    return `<p class="muted">Add a friend first, then you can send them gifts and study boosts.</p>`;
  }

  return socialState.friendships
    .map((friend) => `
      <div class="social-list-row">
        <div>
          <strong>${escapeHtml(friend.profile.profile.displayName)}</strong>
          <p class="muted">@${escapeHtml(friend.profile.profile.username)} - ${escapeHtml(friend.profile.social.rankTitle)}</p>
        </div>
        <div class="social-actions">
          <button class="btn btn--mint" data-send-heart="${escapeHtml(friend.uid)}" type="button">Send heart (140)</button>
          <button class="btn btn--sky" data-send-gems="${escapeHtml(friend.uid)}" type="button">Send gems (140)</button>
        </div>
      </div>
    `)
    .join("");
}

async function openLeaderboardModal() {
  const wrap = document.createElement("div");
  wrap.className = "social-modal";
  wrap.innerHTML = `<p class="muted">Loading leaderboards...</p>`;
  setWideModal("Leaderboards", wrap);

  try {
    await loadFriendsState();
    await loadLeaderboards();
    wrap.innerHTML = `
      <div class="social-section">
        <div class="social-section__head">
          <h4>Global XP Board</h4>
          <span class="social-meta">All public players</span>
        </div>
        ${leaderboardRowsMarkup(socialState.leaderboard.global, "Total XP")}
      </div>
      <div class="social-section">
        <div class="social-section__head">
          <h4>Weekly League</h4>
          <span class="social-meta">Refreshes each week</span>
        </div>
        ${leaderboardRowsMarkup(socialState.leaderboard.weekly, "Weekly XP")}
      </div>
      <div class="social-section">
        <div class="social-section__head">
          <h4>Friends Board</h4>
          <span class="social-meta">Your study circle</span>
        </div>
        ${leaderboardRowsMarkup(socialState.leaderboard.friends, "Total XP")}
      </div>
    `;
  } catch (error) {
    console.error(error);
    wrap.innerHTML = `<p class="muted">Leaderboards are not ready yet. Once Firestore indexes are deployed, this board will light up.</p>`;
  }
}

async function openPublicProfileModal(uid) {
  if (!db) return;
  const doc = await db.collection("users").doc(uid).get();
  if (!doc.exists) {
    toast("That profile is not available.");
    return;
  }

  const profile = normalizeSocialDocData(uid, doc.data());
  const wrap = document.createElement("div");
  wrap.className = "social-modal";
  wrap.innerHTML = `
    <div class="profile-hero">
      <img class="profile-avatar" src="${escapeHtml(profile.profile.photoURL || "assets/images/mascot-logo.svg")}" alt="">
      <div>
        <p class="eyebrow">Study partner</p>
        <h3>${escapeHtml(profile.profile.displayName)}</h3>
        <p class="muted">@${escapeHtml(profile.profile.username)} - ${escapeHtml(profile.social.rankTitle)}</p>
      </div>
    </div>
    <div class="social-stat-grid">
      <div class="social-stat-card"><span class="eyebrow">Total XP</span><strong>${profile.stats.totalXp}</strong></div>
      <div class="social-stat-card"><span class="eyebrow">League</span><strong>${escapeHtml(profile.social.league)}</strong></div>
      <div class="social-stat-card"><span class="eyebrow">Progress</span><strong>${profile.stats.progressPercent}%</strong></div>
      <div class="social-stat-card"><span class="eyebrow">Streak</span><strong>${profile.stats.streakDays} days</strong></div>
    </div>
    <div class="social-section">
      <h4>Profile note</h4>
      <p class="muted">${escapeHtml(profile.profile.bio || "This learner has not written a bio yet.")}</p>
    </div>
  `;
  setWideModal("Player Profile", wrap);
}

async function refreshFriendsModal(wrap) {
  await loadFriendsState();
  await loadSuggestedFriends().catch(() => {
    socialState.suggestions = [];
  });
  wrap.innerHTML = `
    <div class="social-section">
      <div class="social-section__head">
        <h4>Suggested study partners</h4>
        <span class="social-meta">Based on XP, league, and progress</span>
      </div>
      ${suggestedFriendRowsMarkup()}
    </div>
    <div class="social-section">
      <div class="social-section__head">
        <h4>Find friends</h4>
        <span class="social-meta">Search by username</span>
      </div>
      <div class="social-search">
        <input id="friend-search-input" type="text" placeholder="Search usernames, for example logoslover">
        <button class="btn" id="friend-search-btn" type="button">Search</button>
      </div>
      <div id="friend-search-results" class="social-list">
        <p class="muted">Search for another learner to add to your study circle.</p>
      </div>
    </div>
    <div class="social-section">
      <div class="social-section__head">
        <h4>Incoming requests</h4>
        <span class="social-meta">${socialState.incomingRequests.length} waiting</span>
      </div>
      ${requestRowsMarkup(socialState.incomingRequests, "incoming")}
    </div>
    <div class="social-section">
      <div class="social-section__head">
        <h4>Outgoing requests</h4>
        <span class="social-meta">${socialState.outgoingRequests.length} pending</span>
      </div>
      ${requestRowsMarkup(socialState.outgoingRequests, "outgoing")}
    </div>
    <div class="social-section">
      <div class="social-section__head">
        <h4>Your friends</h4>
        <span class="social-meta">${socialState.friendships.length} learners</span>
      </div>
      ${friendshipRowsMarkup()}
    </div>
  `;

  wrap.querySelector("#friend-search-btn").addEventListener("click", async () => {
    const term = wrap.querySelector("#friend-search-input").value;
    const resultsWrap = wrap.querySelector("#friend-search-results");
    resultsWrap.innerHTML = `<p class="muted">Searching...</p>`;
    try {
      const results = await searchPlayers(term);
      if (!results.length) {
        resultsWrap.innerHTML = `<p class="muted">No public learners found for that search yet.</p>`;
        return;
      }
      resultsWrap.innerHTML = results
        .map((profile) => `
          <div class="social-list-row">
            <div>
              <strong>${escapeHtml(profile.profile.displayName)}</strong>
              <p class="muted">@${escapeHtml(profile.profile.username)} - ${escapeHtml(profile.social.rankTitle)} - ${profile.stats.totalXp} XP</p>
            </div>
            <div class="social-actions">
              <button class="btn ghost" data-view-profile="${escapeHtml(profile.uid)}" type="button">View</button>
              <button class="btn" data-send-request="${escapeHtml(profile.uid)}" type="button">Add friend</button>
            </div>
          </div>
        `)
        .join("");
      bindFriendsActions(wrap);
    } catch (error) {
      console.error(error);
      resultsWrap.innerHTML = `<p class="muted">Search needs a Firestore index. Deploy the included indexes and try again.</p>`;
    }
  });

  bindFriendsActions(wrap);
}

function bindFriendsActions(wrap) {
  wrap.querySelectorAll("[data-send-request]").forEach((button) => {
    button.addEventListener("click", async () => {
      await socialCall("sendFriendRequest", { targetUid: button.dataset.sendRequest });
      toast("Friend request sent.");
      await refreshFriendsModal(wrap);
    });
  });

  wrap.querySelectorAll("[data-accept-request]").forEach((button) => {
    button.addEventListener("click", async () => {
      await socialCall("respondToFriendRequest", { requestId: button.dataset.acceptRequest, action: "accept" });
      toast("Friend request accepted.");
      await refreshFriendsModal(wrap);
    });
  });

  wrap.querySelectorAll("[data-decline-request]").forEach((button) => {
    button.addEventListener("click", async () => {
      await socialCall("respondToFriendRequest", { requestId: button.dataset.declineRequest, action: "decline" });
      toast("Friend request declined.");
      await refreshFriendsModal(wrap);
    });
  });

  wrap.querySelectorAll("[data-cancel-request]").forEach((button) => {
    button.addEventListener("click", async () => {
      await socialCall("respondToFriendRequest", { requestId: button.dataset.cancelRequest, action: "cancel" });
      toast("Friend request cancelled.");
      await refreshFriendsModal(wrap);
    });
  });

  wrap.querySelectorAll("[data-remove-friend]").forEach((button) => {
    button.addEventListener("click", async () => {
      await socialCall("removeFriend", { targetUid: button.dataset.removeFriend });
      toast("Friend removed from your study circle.");
      await refreshFriendsModal(wrap);
    });
  });

  wrap.querySelectorAll("[data-view-profile]").forEach((button) => {
    button.addEventListener("click", () => openPublicProfileModal(button.dataset.viewProfile));
  });
}

async function openFriendsModal() {
  if (!requireSignIn()) return;
  const wrap = document.createElement("div");
  wrap.className = "social-modal";
  wrap.innerHTML = `<p class="muted">Loading your study circle...</p>`;
  setWideModal("Friends", wrap);

  try {
    await refreshFriendsModal(wrap);
  } catch (error) {
    console.error(error);
    wrap.innerHTML = `<p class="muted">Friends will be ready once Firestore rules, indexes, and Cloud Functions are deployed.</p>`;
  }
}

function getFlatLessons() {
  if (!window.lessonData?.worlds) return [];
  const flat = [];
  lessonData.worlds.forEach((world) => {
    world.lessons.forEach((lesson) => {
      flat.push({
        id: lesson.id,
        title: `${world.title} - ${lesson.title}`
      });
    });
  });
  return flat;
}

function buildShareUrl() {
  const shareUrl = new URL(location.href);
  shareUrl.searchParams.set("invite", getCurrentSocialUser()?.uid || "");
  return shareUrl.toString();
}

async function openInviteModal() {
  const wrap = document.createElement("div");
  wrap.className = "social-modal";
  const shareUrl = buildShareUrl();
  const profile = socialState.profile || createFallbackProfile(getCurrentSocialUser());
  wrap.innerHTML = `
    <div class="social-card-callout">
      <h4>Invite friends safely</h4>
      <p>Share your invite link, post your progress card, or send the link directly. Google contacts matching is intentionally not automatic here because it needs an extra People API permission and Google app verification.</p>
    </div>
    <div class="social-inline-grid">
      <div class="social-section">
        <div class="social-section__head">
          <h4>Your share card</h4>
          <span class="social-meta">Easy for classmates to find</span>
        </div>
        <div class="invite-badge-stack">
          <span class="invite-badge">Username: @${escapeHtml(profile.profile.username)}</span>
          <span class="invite-badge">League: ${escapeHtml(profile.social.league)}</span>
          <span class="invite-badge">XP: ${escapeHtml(String(profile.stats.totalXp || 0))}</span>
        </div>
      </div>
      <div class="social-section">
        <div class="social-section__head">
          <h4>Best school demo flow</h4>
          <span class="social-meta">No contacts needed</span>
        </div>
        <div class="invite-checklist">
          <p>1. Share your username with classmates</p>
          <p>2. Share your invite link in WhatsApp or class group</p>
          <p>3. Let them search you by username and send a request</p>
        </div>
      </div>
    </div>
    <div class="social-section">
      <div class="social-section__head">
        <h4>Your invite link</h4>
        <span class="social-meta">Share anywhere</span>
      </div>
      <label class="social-field">
        <span>Invite URL</span>
        <input id="invite-link-input" type="text" readonly value="${escapeHtml(shareUrl)}">
      </label>
      <div class="social-actions">
        <button class="btn btn--sky" id="invite-share-btn" type="button">Share invite</button>
        <button class="btn ghost" id="invite-copy-btn" type="button">Copy link</button>
      </div>
    </div>
  `;
  setWideModal("Invite Friends", wrap);

  wrap.querySelector("#invite-share-btn").addEventListener("click", async () => {
    const payload = {
      title: "Learn Koine Greek invite",
      text: "Join me on Learn Koine Greek so we can climb the leaderboard together.",
      url: shareUrl
    };
    if (navigator.share) {
      await navigator.share(payload);
      return;
    }
    await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
    toast("Invite copied to your clipboard.");
  });

  wrap.querySelector("#invite-copy-btn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast("Invite link copied.");
  });
}

async function openGiftsModal() {
  if (!requireSignIn()) return;
  const wrap = document.createElement("div");
  wrap.className = "social-modal";
  wrap.innerHTML = `<p class="muted">Loading gifts...</p>`;
  setWideModal("Gifts", wrap);

  try {
    await Promise.all([loadOwnSocialProfile(), loadFriendsState(), loadGiftsState()]);
    const profile = socialState.profile || createFallbackProfile();
    const heartsNow = typeof progressState !== "undefined" ? progressState.hearts : SOCIAL_HEART_MAX;
    const missingHearts = Math.max(0, SOCIAL_HEART_MAX - heartsNow);
    const recommendedHearts = heartsNow <= 3 ? Math.min(2, missingHearts) : 1;
    const fullRefillCost = missingHearts * SOCIAL_HEART_GEM_COST;
    const recommendedCost = recommendedHearts * SOCIAL_HEART_GEM_COST;
    wrap.innerHTML = `
      <div class="gift-wallet">
        <div class="gift-wallet__item">
          <span class="eyebrow">Gems</span>
          <strong>${profile.rewards.gems || 0}</strong>
        </div>
        <div class="gift-wallet__item">
          <span class="eyebrow">Heart gifts</span>
          <strong>${profile.rewards.heartPasses || 0}</strong>
        </div>
        <div class="gift-wallet__item">
          <span class="eyebrow">Crowns</span>
          <strong>${profile.rewards.crowns || 0}</strong>
        </div>
      </div>
      <div class="social-card-callout">
        <h4>Heart shop</h4>
        <p>${heartsNow <= 3
          ? `You are down to ${heartsNow} hearts. We recommend buying ${recommendedHearts} heart${recommendedHearts === 1 ? "" : "s"} for ${recommendedCost} gems so you can keep playing.`
          : `Each heart costs ${SOCIAL_HEART_GEM_COST} gems. Every completed lesson adds ${SOCIAL_LESSON_GEM_REWARD} gems to your reward pocket.`}</p>
      </div>
      <div class="social-actions">
        <button class="btn btn--mint" id="redeem-heart-pass-btn" type="button" ${profile.rewards.heartPasses ? "" : "disabled"}>Use one heart gift</button>
        <button class="btn btn--sky" id="buy-recommended-hearts-btn" type="button" ${!recommendedHearts || (profile.rewards.gems || 0) < recommendedCost ? "disabled" : ""}>Buy ${recommendedHearts} heart${recommendedHearts === 1 ? "" : "s"} (${recommendedCost} gems)</button>
        <button class="btn ghost" id="buy-full-hearts-btn" type="button" ${!missingHearts || (profile.rewards.gems || 0) < fullRefillCost ? "disabled" : ""}>Full refill (${fullRefillCost} gems)</button>
      </div>
      <div class="social-section">
        <div class="social-section__head">
          <h4>Send a boost</h4>
          <span class="social-meta">Share rewards with friends</span>
        </div>
        ${friendGiftOptionsMarkup()}
      </div>
      <div class="social-inline-grid">
        <div class="social-section">
          <div class="social-section__head">
            <h4>Received</h4>
            <span class="social-meta">${socialState.gifts.received.length} gifts</span>
          </div>
          ${giftRowsMarkup(socialState.gifts.received, "No gifts yet.")}
        </div>
        <div class="social-section">
          <div class="social-section__head">
            <h4>Sent</h4>
            <span class="social-meta">${socialState.gifts.sent.length} gifts</span>
          </div>
          ${giftRowsMarkup(socialState.gifts.sent, "No gifts sent yet.")}
        </div>
      </div>
    `;

    const redeemBtn = wrap.querySelector("#redeem-heart-pass-btn");
    if (redeemBtn) {
      redeemBtn.addEventListener("click", async () => {
        try {
          const data = await socialCall("redeemHeartPass");
          if (data.user) applySocialProfile(normalizeSocialDocData(getCurrentSocialUser().uid, data.user));
          if (typeof progressState !== "undefined") {
            progressState.hearts = SOCIAL_HEART_MAX;
            progressState.heartsUpdatedAt = Date.now();
            progressState.exhaustedHeartTimes = [];
            if (typeof updateStats === "function") updateStats();
            if (typeof saveLocalProgress === "function") saveLocalProgress();
          }
          toast("One heart gift restored your hearts.");
          openGiftsModal();
        } catch (error) {
          console.error(error);
          toast(error.message || "Could not use the heart gift.");
        }
      });
    }

    const buyRecommendedBtn = wrap.querySelector("#buy-recommended-hearts-btn");
    if (buyRecommendedBtn) {
      buyRecommendedBtn.addEventListener("click", async () => {
        try {
          const data = await socialCall("buyHeartsWithGems", { heartCount: recommendedHearts });
          if (data.user) applySocialProfile(normalizeSocialDocData(getCurrentSocialUser().uid, data.user));
          if (typeof progressState !== "undefined") {
            progressState.hearts = Math.min(SOCIAL_HEART_MAX, progressState.hearts + (data.purchasedHearts || recommendedHearts));
            progressState.heartsUpdatedAt = Date.now();
            const missingAfterPurchase = Math.max(0, SOCIAL_HEART_MAX - progressState.hearts);
            progressState.exhaustedHeartTimes = progressState.exhaustedHeartTimes
              .sort((a, b) => a - b)
              .slice(-missingAfterPurchase);
            if (typeof updateStats === "function") updateStats();
            if (typeof saveLocalProgress === "function") saveLocalProgress();
            if (progressState.hearts > 0 && typeof currentLesson !== "undefined" && currentLesson && typeof renderExercise === "function") {
              renderExercise();
            }
          }
          toast(`Bought ${data.purchasedHearts || recommendedHearts} heart${(data.purchasedHearts || recommendedHearts) === 1 ? "" : "s"} for ${data.spentGems || recommendedCost} gems.`);
          openGiftsModal();
        } catch (error) {
          console.error(error);
          toast(error.message || "Could not buy hearts with gems.");
        }
      });
    }

    const buyFullBtn = wrap.querySelector("#buy-full-hearts-btn");
    if (buyFullBtn) {
      buyFullBtn.addEventListener("click", async () => {
        try {
          const data = await socialCall("buyHeartsWithGems", { heartCount: missingHearts });
          if (data.user) applySocialProfile(normalizeSocialDocData(getCurrentSocialUser().uid, data.user));
          if (typeof progressState !== "undefined") {
            progressState.hearts = SOCIAL_HEART_MAX;
            progressState.heartsUpdatedAt = Date.now();
            progressState.exhaustedHeartTimes = [];
            if (typeof updateStats === "function") updateStats();
            if (typeof saveLocalProgress === "function") saveLocalProgress();
            if (progressState.hearts > 0 && typeof currentLesson !== "undefined" && currentLesson && typeof renderExercise === "function") {
              renderExercise();
            }
          }
          toast(`Full heart refill purchased for ${data.spentGems || fullRefillCost} gems.`);
          openGiftsModal();
        } catch (error) {
          console.error(error);
          toast(error.message || "Could not buy the full heart refill.");
        }
      });
    }

    wrap.querySelectorAll("[data-send-heart]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const data = await socialCall("sendGift", { targetUid: button.dataset.sendHeart, giftType: "heart" });
          if (data.user) applySocialProfile(normalizeSocialDocData(getCurrentSocialUser().uid, data.user));
          toast("Heart gift sent.");
          openGiftsModal();
        } catch (error) {
          console.error(error);
          toast(error.message || "Could not send that heart gift.");
        }
      });
    });

    wrap.querySelectorAll("[data-send-gems]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const data = await socialCall("sendGift", { targetUid: button.dataset.sendGems, giftType: "gems" });
          if (data.user) applySocialProfile(normalizeSocialDocData(getCurrentSocialUser().uid, data.user));
          toast("Gem pack sent.");
          openGiftsModal();
        } catch (error) {
          console.error(error);
          toast(error.message || "Could not send that gem pack.");
        }
      });
    });
  } catch (error) {
    console.error(error);
    wrap.innerHTML = `<p class="muted">${escapeHtml(error.message || "Gifts are not ready until Firebase is fully deployed.")}</p>`;
  }
}

async function loadStudyMessages(roomId) {
  if (!db || !roomId) return [];
  const snapshot = await db.collection("studyRooms").doc(roomId).collection("messages").orderBy("createdAt", "asc").limit(30).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function openStudyRoomThread(roomId) {
  const roomDoc = await db.collection("studyRooms").doc(roomId).get();
  if (!roomDoc.exists) {
    toast("That study room is not available anymore.");
    return;
  }

  const room = { id: roomDoc.id, ...roomDoc.data() };
  const messages = await loadStudyMessages(roomId);
  const wrap = document.createElement("div");
  wrap.className = "social-modal";
  wrap.innerHTML = `
    <div class="social-card-callout">
      <h4>${escapeHtml(room.lessonTitle || room.lessonId || "Study room")}</h4>
      <p>Use this room to ask a hard question, answer a friend's question, or keep each other moving through the lesson.</p>
    </div>
    <div class="study-message-list">
      ${
        messages.length
          ? messages.map((message) => `
            <div class="study-message">
              <strong>${escapeHtml(message.authorName || "Learner")} - ${escapeHtml(message.kind || "note")}</strong>
              <p>${escapeHtml(message.text || "")}</p>
            </div>
          `).join("")
          : `<p class="muted">No messages yet. Ask the first question.</p>`
      }
    </div>
    <div class="study-composer">
      <select id="study-message-kind">
        <option value="question">Question</option>
        <option value="tip">Tip</option>
        <option value="check-in">Check-in</option>
      </select>
      <textarea id="study-message-text" placeholder="Ask what confused you, or explain a tricky part to your friend."></textarea>
      <div class="social-actions">
        ${room.invitedUids?.includes(getCurrentSocialUser()?.uid) ? `<button class="btn btn--mint" id="study-join-btn" type="button">Join room</button>` : ""}
        <button class="btn btn--berry" id="study-send-btn" type="button">Send</button>
      </div>
    </div>
  `;
  setWideModal("Study Room", wrap);

  const joinBtn = wrap.querySelector("#study-join-btn");
  if (joinBtn) {
    joinBtn.addEventListener("click", async () => {
      try {
        await socialCall("joinStudyRoom", { roomId });
        toast("You joined the study room.");
        openStudyRoomThread(roomId);
      } catch (error) {
        console.error(error);
        toast(error.message || "Could not join this room.");
      }
    });
  }

  wrap.querySelector("#study-send-btn").addEventListener("click", async () => {
    try {
      const text = wrap.querySelector("#study-message-text").value.trim();
      const kind = wrap.querySelector("#study-message-kind").value;
      if (!text) {
        toast("Write a message first.");
        return;
      }
      await socialCall("sendStudyMessage", { roomId, text, kind });
      openStudyRoomThread(roomId);
    } catch (error) {
      console.error(error);
      toast(error.message || "Could not send that message.");
    }
  });
}

async function openStudyTogetherModal(lesson) {
  if (!requireSignIn()) return;
  const wrap = document.createElement("div");
  wrap.className = "social-modal";
  wrap.innerHTML = `<p class="muted">Loading study rooms...</p>`;
  setWideModal("Study Together", wrap);

  try {
    await Promise.all([loadStudyRoomsState(), loadFriendsState()]);
    const flatLessons = getFlatLessons();
    const suggestedLesson = lesson?.id || flatLessons[0]?.id || "";
    wrap.innerHTML = `
      <div class="social-card-callout">
        <h4>Shared lesson rooms</h4>
        <p>These rooms are the first step toward co-op lessons. You can invite a friend into the same lesson, drop a question, and coordinate your progress in real time through Firestore updates.</p>
      </div>
      <div class="social-section">
        <div class="social-section__head">
          <h4>Start a room</h4>
          <span class="social-meta">Pick a lesson and invite one friend</span>
        </div>
        <div class="study-composer">
          <select id="study-room-lesson">
            ${flatLessons.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === suggestedLesson ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
          </select>
          <select id="study-room-friend">
            <option value="">Invite a friend later</option>
            ${socialState.friendships.map((friend) => `<option value="${escapeHtml(friend.uid)}">${escapeHtml(friend.profile.profile.displayName)} (@${escapeHtml(friend.profile.profile.username)})</option>`).join("")}
          </select>
          <button class="btn btn--berry" id="study-room-create-btn" type="button">Create room</button>
        </div>
      </div>
      <div class="social-section">
        <div class="social-section__head">
          <h4>Your active rooms</h4>
          <span class="social-meta">${socialState.studyRooms.length} room(s)</span>
        </div>
        ${studyRoomCardsMarkup(socialState.studyRooms)}
      </div>
    `;

    wrap.querySelector("#study-room-create-btn").addEventListener("click", async () => {
      try {
        const lessonId = wrap.querySelector("#study-room-lesson").value;
        const invitedUid = wrap.querySelector("#study-room-friend").value || "";
        const data = await socialCall("createStudyRoom", { lessonId, invitedUid });
        toast("Study room created.");
        if (data.roomId) {
          openStudyRoomThread(data.roomId);
        } else {
          openStudyTogetherModal(lesson);
        }
      } catch (error) {
        console.error(error);
        toast(error.message || "Could not create the study room.");
      }
    });

    wrap.querySelectorAll("[data-open-room]").forEach((button) => {
      button.addEventListener("click", () => openStudyRoomThread(button.dataset.openRoom));
    });
    wrap.querySelectorAll("[data-join-room]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await socialCall("joinStudyRoom", { roomId: button.dataset.joinRoom });
          toast("You joined the room.");
          openStudyRoomThread(button.dataset.joinRoom);
        } catch (error) {
          console.error(error);
          toast(error.message || "Could not join this room.");
        }
      });
    });
  } catch (error) {
    console.error(error);
    wrap.innerHTML = `<p class="muted">${escapeHtml(error.message || "Study rooms need Firebase deployment before they can open.")}</p>`;
  }
}

async function openAskLessonQuestionModal(lesson, exercise) {
  if (!requireSignIn()) return;
  await loadFriendsState().catch(() => {});
  const wrap = document.createElement("div");
  wrap.className = "social-modal";
  const flatLessons = getFlatLessons();
  const selectedLesson = lesson?.id || flatLessons[0]?.id || "";
  const vocabHint = exercise?.vocab?.greek ? ` about ${exercise.vocab.greek}` : "";
  wrap.innerHTML = `
    <div class="social-card-callout">
      <h4>Ask for help without losing momentum</h4>
      <p>Turn your current difficulty into a question for a friend or a study room. This keeps the lesson social without forcing you to leave the path.</p>
    </div>
    <div class="study-composer">
      <select id="question-lesson">
        ${flatLessons.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedLesson ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
      </select>
      <select id="question-friend">
        <option value="">Post in a new study room</option>
        ${socialState.friendships.map((friend) => `<option value="${escapeHtml(friend.uid)}">${escapeHtml(friend.profile.profile.displayName)}</option>`).join("")}
      </select>
      <textarea id="question-text" placeholder="For example: I understand the word${escapeHtml(vocabHint)}, but I am confused about why the sentence order works this way.">${escapeHtml(exercise?.prompt ? `I need help with: ${exercise.prompt}` : "")}</textarea>
      <button class="btn btn--berry" id="question-send-btn" type="button">Send question</button>
    </div>
  `;
  setWideModal("Ask A Friend", wrap);

  wrap.querySelector("#question-send-btn").addEventListener("click", async () => {
    try {
      const lessonId = wrap.querySelector("#question-lesson").value;
      const invitedUid = wrap.querySelector("#question-friend").value || "";
      const text = wrap.querySelector("#question-text").value.trim();
      if (!text) {
        toast("Write your question first.");
        return;
      }
      const roomData = await socialCall("createStudyRoom", { lessonId, invitedUid });
      if (!roomData.roomId) {
        throw new Error("Could not create a study room for this question.");
      }
      await socialCall("sendStudyMessage", { roomId: roomData.roomId, text, kind: "question" });
      toast("Question sent.");
      openStudyRoomThread(roomData.roomId);
    } catch (error) {
      console.error(error);
      toast(error.message || "Could not send your question.");
    }
  });
}

async function shareOwnProgress() {
  const profile = socialState.profile || createFallbackProfile();
  const text = `${profile.profile.displayName} is a ${profile.social.rankTitle} in Learn Koine Greek with ${profile.stats.totalXp} XP, ${profile.stats.progressPercent}% progress, and a ${profile.stats.streakDays}-day streak.`;
  const url = location.href;

  if (navigator.share) {
    await navigator.share({ title: "Learn Koine Greek progress", text, url });
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast("Progress summary copied to your clipboard.");
    return;
  }

  toast("Sharing is not available in this browser.");
}

async function saveProfileSettingsFromModal(wrap) {
  const payload = {
    displayName: wrap.querySelector("#profile-display-name").value.trim(),
    username: wrap.querySelector("#profile-username").value.trim(),
    bio: wrap.querySelector("#profile-bio").value.trim(),
    isProfilePublic: wrap.querySelector("#profile-public").checked
  };

  const data = await socialCall("updateUserProfile", payload);
  if (data.user) {
    applySocialProfile(normalizeSocialDocData(getCurrentSocialUser().uid, data.user));
  } else {
    await loadOwnSocialProfile();
  }
  toast("Profile saved.");
}

async function openProfileModal() {
  const user = getCurrentSocialUser();
  if (!user) {
    const body = document.createElement("div");
    body.innerHTML = `
      <p>Please sign in with Google to build your public profile, join leagues, and add friends.</p>
      <button class="btn" id="profile-signin-btn" type="button">Sign in with Google</button>
    `;
    showModal("Profile", body);
    clearWideModal();
    body.querySelector("#profile-signin-btn").addEventListener("click", () => signInWithGoogle());
    return;
  }

  const profile = socialState.profile || (await loadOwnSocialProfile());
  await loadOwnActivities();
  await loadFriendsState();

  const wrap = document.createElement("div");
  wrap.className = "social-modal";
  wrap.innerHTML = `
    <div class="profile-hero">
      <img class="profile-avatar" src="${escapeHtml(profile.profile.photoURL || "assets/images/mascot-logo.svg")}" alt="">
      <div>
        <p class="eyebrow">Public profile</p>
        <h3>${escapeHtml(profile.profile.displayName)}</h3>
        <p class="muted">@${escapeHtml(profile.profile.username)} - ${escapeHtml(profile.social.rankTitle)} - ${escapeHtml(profile.social.league)} League</p>
      </div>
      <div class="social-actions social-actions--stack">
        <button class="btn" id="share-progress-btn" type="button">Share progress</button>
        <button class="btn ghost" id="profile-open-gifts-btn" type="button">Open gifts</button>
      </div>
    </div>
    <div class="social-stat-grid">
      <div class="social-stat-card"><span class="eyebrow">Total XP</span><strong>${profile.stats.totalXp}</strong></div>
      <div class="social-stat-card"><span class="eyebrow">Level</span><strong>${profile.stats.level}</strong></div>
      <div class="social-stat-card"><span class="eyebrow">Lessons</span><strong>${profile.stats.totalLessonsCompleted}</strong></div>
      <div class="social-stat-card"><span class="eyebrow">Progress</span><strong>${profile.stats.progressPercent}%</strong></div>
      <div class="social-stat-card"><span class="eyebrow">Weekly XP</span><strong>${profile.social.weeklyXp}</strong></div>
      <div class="social-stat-card"><span class="eyebrow">Friends</span><strong>${socialState.friendships.length}</strong></div>
      <div class="social-stat-card"><span class="eyebrow">Streak</span><strong>${profile.stats.streakDays} days</strong></div>
      <div class="social-stat-card"><span class="eyebrow">Visibility</span><strong>${profile.profile.isProfilePublic ? "Public" : "Private"}</strong></div>
      <div class="social-stat-card"><span class="eyebrow">Gems</span><strong>${profile.rewards.gems || 0}</strong></div>
      <div class="social-stat-card"><span class="eyebrow">Heart gifts</span><strong>${profile.rewards.heartPasses || 0}</strong></div>
      <div class="social-stat-card"><span class="eyebrow">Crowns</span><strong>${profile.rewards.crowns || 0}</strong></div>
    </div>
    <div class="social-grid-two">
      <div class="social-section">
        <div class="social-section__head">
          <h4>Edit profile</h4>
          <span class="social-meta">People will find you by username</span>
        </div>
        <label class="social-field">
          <span>Display name</span>
          <input id="profile-display-name" type="text" maxlength="40" value="${escapeHtml(profile.profile.displayName)}">
        </label>
        <label class="social-field">
          <span>Username</span>
          <input id="profile-username" type="text" maxlength="20" value="${escapeHtml(profile.profile.username)}">
        </label>
        <label class="social-field">
          <span>Bio</span>
          <textarea id="profile-bio" rows="4" maxlength="180">${escapeHtml(profile.profile.bio)}</textarea>
        </label>
        <label class="toggle-row">
          <span>Public profile</span>
          <label class="switch"><input id="profile-public" type="checkbox" ${profile.profile.isProfilePublic ? "checked" : ""}><span class="slider"></span></label>
        </label>
        <button class="btn" id="profile-save-btn" type="button">Save profile</button>
      </div>
      <div class="social-section">
        <div class="social-section__head">
          <h4>Recent milestones</h4>
          <span class="social-meta">Share-worthy moments</span>
        </div>
        ${renderActivityFeed(socialState.activities)}
      </div>
    </div>
  `;

  setWideModal("Profile", wrap);

  wrap.querySelector("#share-progress-btn").addEventListener("click", () => {
    shareOwnProgress().catch((error) => {
      console.error(error);
      toast("Could not open the share sheet just now.");
    });
  });
  wrap.querySelector("#profile-open-gifts-btn").addEventListener("click", () => openGiftsModal());

  wrap.querySelector("#profile-save-btn").addEventListener("click", async () => {
    try {
      await saveProfileSettingsFromModal(wrap);
      await loadOwnActivities();
      openProfileModal();
    } catch (error) {
      console.error(error);
      toast(error.message || "Profile save failed.");
    }
  });
}

async function submitLessonCompletionToSocial(lesson) {
  const user = getCurrentSocialUser();
  if (!user || !lesson) return null;

  const data = await socialCall("submitLessonCompletion", {
    lessonId: lesson.id
  });

  if (data.user) {
    applySocialProfile(normalizeSocialDocData(user.uid, data.user));
  } else {
    await loadOwnSocialProfile();
  }

  loadOwnActivities().catch(() => {});
  loadLeaderboards().catch(() => {});
  return data;
}

function resetSocialState() {
  socialState.profile = null;
  socialState.activities = [];
  socialState.friendships = [];
  socialState.incomingRequests = [];
  socialState.outgoingRequests = [];
  socialState.suggestions = [];
  socialState.gifts.received = [];
  socialState.gifts.sent = [];
  socialState.studyRooms = [];
  socialState.leaderboard.global = [];
  socialState.leaderboard.weekly = [];
  socialState.leaderboard.friends = [];
  updateSocialChrome();
}

window.openProfileModal = openProfileModal;
window.openLeaderboardModal = openLeaderboardModal;
window.openFriendsModal = openFriendsModal;
window.openInviteModal = openInviteModal;
window.openGiftsModal = openGiftsModal;
window.openStudyTogetherModal = openStudyTogetherModal;
window.openAskLessonQuestionModal = openAskLessonQuestionModal;
window.syncSocialAuthProfile = syncSocialAuthProfile;
window.loadOwnSocialProfile = loadOwnSocialProfile;
window.applyRewardSummaryToChrome = applyRewardSummaryToChrome;
window.submitLessonCompletionToSocial = submitLessonCompletionToSocial;
window.loadFriendsState = loadFriendsState;
window.loadLeaderboards = loadLeaderboards;
window.loadGiftsState = loadGiftsState;
window.loadStudyRoomsState = loadStudyRoomsState;
window.resetSocialState = resetSocialState;
window.SOCIAL_EXERCISE_XP = SOCIAL_EXERCISE_XP;

window.addEventListener("gq-auth-changed", (event) => {
  const user = event.detail?.user;
  if (!user) {
    resetSocialState();
    return;
  }

  syncSocialAuthProfile()
    .then(() => Promise.all([
      loadOwnSocialProfile(),
      loadFriendsState().catch(() => {}),
      loadGiftsState().catch(() => {}),
      loadStudyRoomsState().catch(() => {}),
      loadLeaderboards().catch(() => {}),
      loadOwnActivities().catch(() => {})
    ]))
    .catch((error) => {
      console.error(error);
      applySocialProfile(createFallbackProfile(user));
    });
});

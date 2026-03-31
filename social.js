const socialState = {
  profile: null,
  activities: [],
  friendships: [],
  incomingRequests: [],
  outgoingRequests: [],
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
    }
  };
}

function normalizeSocialDocData(uid, data) {
  const fallback = createFallbackProfile({ uid });
  const profile = data?.profile || {};
  const stats = data?.stats || {};
  const social = data?.social || {};
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

function updateSocialChrome() {
  const profile = socialState.profile || createFallbackProfile();
  const rankEl = document.getElementById("stat-rank");
  const leagueEl = document.getElementById("stat-league");
  const streakEl = document.getElementById("stat-streak");
  const heroStatus = document.getElementById("hero-status");
  const heroRankBadge = document.getElementById("hero-rank-badge");
  const focusStreak = document.getElementById("focus-streak-value");
  const focusLeagueNote = document.getElementById("focus-league-note");

  if (rankEl) rankEl.textContent = `Rank ${profile.social.rankTitle}`;
  if (leagueEl) leagueEl.textContent = `League ${profile.social.league}`;
  if (streakEl) streakEl.textContent = `Streak ${profile.stats.streakDays || 0}`;
  if (heroRankBadge) heroRankBadge.textContent = profile.social.rankTitle;
  if (focusStreak) focusStreak.textContent = `${profile.stats.streakDays || 0} days`;
  if (focusLeagueNote) focusLeagueNote.textContent = `${profile.social.league} League`;

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

function socialCall(name, payload = {}) {
  if (!functions) {
    return Promise.reject(new Error("Cloud Functions are not initialized yet."));
  }
  return functions.httpsCallable(name)(payload).then((result) => result.data || {});
}

async function syncSocialAuthProfile() {
  const user = getCurrentSocialUser();
  if (!user || !functions) {
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
    if (!functions) {
      applySocialProfile(createFallbackProfile(user));
      return socialState.profile;
    }
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
  wrap.innerHTML = `
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
  if (!user || !functions || !lesson) return null;

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
  socialState.leaderboard.global = [];
  socialState.leaderboard.weekly = [];
  socialState.leaderboard.friends = [];
  updateSocialChrome();
}

window.openProfileModal = openProfileModal;
window.openLeaderboardModal = openLeaderboardModal;
window.openFriendsModal = openFriendsModal;
window.syncSocialAuthProfile = syncSocialAuthProfile;
window.loadOwnSocialProfile = loadOwnSocialProfile;
window.submitLessonCompletionToSocial = submitLessonCompletionToSocial;
window.loadFriendsState = loadFriendsState;
window.loadLeaderboards = loadLeaderboards;
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
      loadLeaderboards().catch(() => {}),
      loadOwnActivities().catch(() => {})
    ]))
    .catch((error) => {
      console.error(error);
      applySocialProfile(createFallbackProfile(user));
    });
});

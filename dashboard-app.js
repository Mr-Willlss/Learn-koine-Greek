import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import { AnimatePresence, motion } from "https://esm.sh/framer-motion@11.0.28";

const APP = {
  lessonUrl: "home.html"
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function formatDayLabel(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
}

function readProgress() {
  try {
    const raw = localStorage.getItem("greekQuestProgress");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function computeLevelFromXp(xp) {
  const safeXp = Number.isFinite(xp) ? xp : 0;
  return Math.max(1, Math.floor(safeXp / 50) + 1);
}

function computePersonalization(progress) {
  const xp = Number.isFinite(progress?.xp) ? progress.xp : 0;
  const completed = Array.isArray(progress?.completedLessons) ? progress.completedLessons.length : 0;
  const activeLessonId = progress?.activeLessonId || null;
  const activeIndex = Number.isFinite(progress?.activeExerciseIndex) ? progress.activeExerciseIndex : 0;

  const message = activeLessonId
    ? `Continue where you left off: ${activeLessonId} (step ${activeIndex + 1}).`
    : completed
      ? "You have momentum. Continue your next unlocked lesson."
      : "Start with Level 1. Small wins first.";

  // Simulated recommendation: if learner has low completion, bias to basics; else suggest practice.
  const recommend = completed < 3
    ? { kind: "lesson", title: "Continue path", subtitle: "Build your foundation with short lessons." }
    : { kind: "practice", title: "Practice weak words", subtitle: "A quick drill to lock in vocabulary." };

  // Daily goal: 1 lesson, show progress based on completion count mod 1.
  const dailyGoalTotal = 1;
  const dailyGoalDone = 0; // This app tracks daily goal in the game page; keep dashboard lightweight.

  return { xp, completed, message, recommend, dailyGoalTotal, dailyGoalDone };
}

function BentoCard({ title, eyebrow, children, className = "", onClick, ariaLabel }) {
  const clickable = typeof onClick === "function";
  return (
    <motion.section
      layout
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={ariaLabel || title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      whileHover={clickable ? { y: -2 } : undefined}
      whileTap={clickable ? { scale: 0.985 } : undefined}
      className={[
        "relative overflow-hidden rounded-xl3 bg-glass shadow-glow ring-1 ring-stroke",
        "p-4 md:p-5",
        clickable ? "cursor-pointer" : "",
        className
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">{eyebrow}</p> : null}
          <h2 className="mt-1 text-base font-semibold text-white">{title}</h2>
        </div>
      </div>
      <div className="mt-3">{children}</div>
      <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(1200px_500px_at_20%_0%,rgba(255,255,255,0.10),transparent_60%)]" />
    </motion.section>
  );
}

function Pill({ children, tone = "muted" }) {
  const tones = {
    muted: "bg-white/8 text-white/80 ring-white/10",
    gold: "bg-[rgba(255,209,102,0.18)] text-accent-gold ring-[rgba(255,209,102,0.26)]",
    mint: "bg-[rgba(6,214,160,0.18)] text-accent-mint ring-[rgba(6,214,160,0.26)]",
    berry: "bg-[rgba(239,71,111,0.18)] text-accent-berry ring-[rgba(239,71,111,0.26)]",
    sky: "bg-[rgba(17,138,178,0.18)] text-accent-sky ring-[rgba(17,138,178,0.26)]",
    violet: "bg-[rgba(155,93,229,0.18)] text-accent-violet ring-[rgba(155,93,229,0.26)]"
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ${tones[tone] || tones.muted}`}>
      {children}
    </span>
  );
}

function Flame({ active }) {
  return (
    <motion.div
      aria-hidden="true"
      animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 1.2, repeat: active ? Infinity : 0 }}
      className="grid h-9 w-9 place-items-center rounded-xl2 bg-[rgba(255,209,102,0.15)] ring-1 ring-[rgba(255,209,102,0.22)]"
    >
      <span className="text-lg">🔥</span>
    </motion.div>
  );
}

function StreakCard({ streakDays, missedRecently }) {
  const today = new Date();
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });
  const currentIndex = 6;
  const filled = clamp(streakDays, 0, 7);

  const message = missedRecently
    ? "You missed a day. Do one lesson today to restart."
    : streakDays
      ? "Keep it alive. One lesson today protects the streak."
      : "Start your streak today. One lesson is enough.";

  return (
    <BentoCard title="Streak" eyebrow="Daily momentum" ariaLabel="Streak card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Flame active={!missedRecently && streakDays > 0} />
          <div>
            <p className="text-2xl font-bold leading-none">{streakDays} day{streakDays === 1 ? "" : "s"}</p>
            <p className={`mt-1 text-sm ${missedRecently ? "text-accent-berry" : "text-white/70"}`}>{message}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-2">
        {days.map((d, idx) => {
          const isToday = idx === currentIndex;
          const on = idx >= 7 - filled;
          return (
            <div key={d.toISOString()} className="text-center">
              <div className="text-[10px] text-white/55">{formatDayLabel(d)}</div>
              <motion.div
                className={[
                  "mx-auto mt-2 h-3.5 w-3.5 rounded-full ring-1",
                  on ? "bg-accent-mint ring-[rgba(6,214,160,0.35)]" : "bg-white/10 ring-white/12",
                  isToday ? "shadow-[0_0_0_3px_rgba(255,255,255,0.10)]" : ""
                ].join(" ")}
                animate={isToday && on ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                transition={{ duration: 0.5 }}
              />
            </div>
          );
        })}
      </div>
    </BentoCard>
  );
}

function ProgressCard({ xp, completedLessons }) {
  const level = computeLevelFromXp(xp);
  const within = xp % 50;
  const pct = Math.round((within / 50) * 100);
  return (
    <BentoCard title="Progress" eyebrow="XP and levels" ariaLabel="Progress card">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="sky">XP {xp}</Pill>
        <Pill tone="violet">Level {level}</Pill>
        <Pill tone="muted">{completedLessons} lessons</Pill>
      </div>
      <div className="mt-4 rounded-xl2 bg-white/6 p-3 ring-1 ring-white/10">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span>Next level</span>
          <span>{within}/50</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/8">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent-sky via-accent-violet to-accent-berry"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      </div>
    </BentoCard>
  );
}

function RewardChestCard({ gems, onOpen, opened }) {
  return (
    <BentoCard title="Rewards" eyebrow="Chest system" onClick={onOpen} ariaLabel="Rewards chest">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-white/75">Daily chest</p>
          <p className="mt-1 text-white/65 text-sm">Tap to open and collect gems.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill tone="gold">💎 {gems} gems</Pill>
            <Pill tone="mint">✨ bonus ready</Pill>
          </div>
        </div>
        <motion.div
          className="grid h-14 w-14 place-items-center rounded-xl2 bg-[rgba(255,209,102,0.16)] ring-1 ring-[rgba(255,209,102,0.24)]"
          animate={opened ? { rotate: [0, -6, 6, 0], scale: [1, 1.08, 1] } : { rotate: 0, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-2xl">{opened ? "🎁" : "🧰"}</span>
        </motion.div>
      </div>
    </BentoCard>
  );
}

function ContinueCard({ title, subtitle, onContinue }) {
  return (
    <BentoCard title="Continue learning" eyebrow="Primary path" onClick={onContinue} ariaLabel="Continue learning">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold">{title}</p>
          <p className="mt-2 text-sm text-white/70">{subtitle}</p>
        </div>
        <motion.button
          type="button"
          className="shrink-0 rounded-full bg-accent-gold px-4 py-2 text-sm font-semibold text-ink-950 shadow-card"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={(e) => {
            e.stopPropagation();
            onContinue();
          }}
        >
          Continue
        </motion.button>
      </div>
    </BentoCard>
  );
}

function PracticeCard({ onPractice }) {
  return (
    <BentoCard title="Practice" eyebrow="Shortcuts" ariaLabel="Practice shortcuts">
      <div className="grid grid-cols-3 gap-2">
        {[
          { k: "review", t: "Review", c: "bg-[rgba(6,214,160,0.18)] ring-[rgba(6,214,160,0.26)]" },
          { k: "listen", t: "Listen", c: "bg-[rgba(17,138,178,0.18)] ring-[rgba(17,138,178,0.26)]" },
          { k: "speak", t: "Speak", c: "bg-[rgba(155,93,229,0.18)] ring-[rgba(155,93,229,0.26)]" }
        ].map((item) => (
          <motion.button
            key={item.k}
            type="button"
            className={`rounded-xl2 px-3 py-3 text-left text-sm font-semibold ring-1 ${item.c}`}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPractice(item.k)}
          >
            {item.t}
            <div className="mt-1 text-[11px] font-normal text-white/70">Quick drill</div>
          </motion.button>
        ))}
      </div>
    </BentoCard>
  );
}

function NotificationsCard({ items }) {
  return (
    <BentoCard title="Notifications" eyebrow="Updates" ariaLabel="Notifications">
      <div className="space-y-2">
        {items.length ? items.slice(0, 2).map((n) => (
          <div key={n.id} className="rounded-xl2 bg-white/6 p-3 ring-1 ring-white/10">
            <p className="text-sm font-semibold">{n.title}</p>
            <p className="mt-1 text-xs text-white/70">{n.body}</p>
          </div>
        )) : (
          <p className="text-sm text-white/70">No new notifications.</p>
        )}
      </div>
    </BentoCard>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { id: "home", label: "Home", icon: "🏠" },
    { id: "practice", label: "Practice", icon: "⚡" },
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "rewards", label: "Rewards", icon: "🎒" }
  ];
  return (
    <nav className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[1100px] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="grid grid-cols-4 gap-2 rounded-xl3 bg-[rgba(255,255,255,0.06)] p-2 shadow-soft ring-1 ring-stroke backdrop-blur">
        {items.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={[
                "rounded-xl2 px-3 py-2 text-xs font-semibold",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/70",
                active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/6"
              ].join(" ")}
              onClick={() => setTab(item.id)}
            >
              <div className="text-base">{item.icon}</div>
              <div className="mt-0.5">{item.label}</div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Modal({ open, title, children, onClose }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-xl3 bg-ink-900 p-5 shadow-soft ring-1 ring-stroke"
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Update</p>
                <h3 className="mt-1 text-lg font-semibold">{title}</h3>
              </div>
              <button className="rounded-xl2 bg-white/6 px-3 py-2 text-xs text-white/80 ring-1 ring-white/10" onClick={onClose}>
                Close
              </button>
            </div>
            <div className="mt-4">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function App() {
  const [tab, setTab] = useState("home");
  const [authUser, setAuthUser] = useState(null);
  const [progress, setProgress] = useState(() => readProgress());
  const [chestOpened, setChestOpened] = useState(false);
  const [levelUp, setLevelUp] = useState(null);
  const prevLevelRef = useRef(computeLevelFromXp(progress?.xp || 0));

  const personalization = useMemo(() => computePersonalization(progress), [progress]);
  const level = computeLevelFromXp(personalization.xp);

  useEffect(() => {
    const onAuth = (e) => setAuthUser(e?.detail?.user || null);
    window.addEventListener("gq-auth-changed", onAuth);
    return () => window.removeEventListener("gq-auth-changed", onAuth);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setProgress(readProgress()), 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const prev = prevLevelRef.current;
    if (level > prev) {
      setLevelUp({ from: prev, to: level });
    }
    prevLevelRef.current = level;
  }, [level]);

  const notifications = useMemo(() => {
    const items = [];
    if (!authUser) {
      items.push({ id: "auth", title: "Sign in to sync", body: "Use Google sign-in to keep progress across devices." });
    } else {
      items.push({ id: "sync", title: "Cloud sync on", body: "Your progress will follow you to another device." });
    }
    if ((progress?.hearts ?? 5) <= 2) {
      items.push({ id: "hearts", title: "Low hearts", body: "Slow down and focus on accuracy, or come back after a refill." });
    }
    return items;
  }, [authUser, progress]);

  const onContinue = () => {
    window.location.href = `${APP.lessonUrl}?from=dashboard`;
  };

  const onPractice = (kind) => {
    // Practice runs inside the lesson page today; dashboard stays light/fast.
    const map = { review: "mixed", listen: "listening", speak: "speaking" };
    const mode = map[kind] || "mixed";
    window.location.href = `${APP.lessonUrl}?practice=${encodeURIComponent(mode)}&from=dashboard`;
  };

  const openChest = () => {
    setChestOpened(true);
    // Demo: add gems locally; when you later switch to Functions, server can validate.
    setProgress((prev) => {
      const next = { ...(prev || {}) };
      next.xp = Number.isFinite(next.xp) ? next.xp : 0;
      next.updatedAt = Date.now();
      localStorage.setItem("greekQuestProgress", JSON.stringify({ ...readProgress(), ...next }));
      return readProgress();
    });
    window.setTimeout(() => setChestOpened(false), 1800);
  };

  const signIn = () => {
    if (typeof window.signInWithGoogle === "function") {
      window.signInWithGoogle({ preferRedirect: true });
    }
  };
  const signOut = () => {
    if (typeof window.signOutUser === "function") window.signOutUser();
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(17,138,178,0.20),transparent_60%),radial-gradient(900px_500px_at_70%_20%,rgba(155,93,229,0.22),transparent_55%),radial-gradient(900px_500px_at_30%_80%,rgba(6,214,160,0.16),transparent_60%)]" />

      <header className="relative mx-auto max-w-[1100px] px-4 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl2 bg-white/6 ring-1 ring-white/10">
              <span className="text-lg">🌀</span>
            </div>
            <div>
              <div className="font-display text-lg font-semibold leading-tight">Learn Koine Greek</div>
              <div className="text-xs text-white/60">Bite-sized lessons. Big momentum.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={authUser ? "mint" : "muted"}>{authUser ? "Cloud sync on" : "Device only"}</Pill>
            {authUser ? (
              <button className="rounded-xl2 bg-white/6 px-3 py-2 text-xs font-semibold text-white/85 ring-1 ring-white/10" onClick={signOut}>
                Log out
              </button>
            ) : (
              <button className="rounded-xl2 bg-accent-gold px-3 py-2 text-xs font-semibold text-ink-950 shadow-card" onClick={signIn}>
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1100px] px-4 pb-28 pt-4">
        <div className="grid h-[calc(100dvh-160px)] grid-cols-1 grid-rows-[auto_1fr] gap-3 overflow-hidden md:gap-4">
          <div className="rounded-xl3 bg-glass p-4 shadow-card ring-1 ring-stroke backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Personalized</p>
                <p className="mt-1 text-sm text-white/80">{personalization.message}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="sky">XP {personalization.xp}</Pill>
                <Pill tone="violet">Level {level}</Pill>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 grid-rows-6 gap-3 overflow-hidden md:grid-cols-12 md:grid-rows-3 md:gap-4">
            <div className="md:col-span-7 md:row-span-2">
              <ContinueCard
                title={personalization.recommend.title}
                subtitle={personalization.recommend.subtitle}
                onContinue={onContinue}
              />
            </div>
            <div className="md:col-span-5 md:row-span-2">
              <StreakCard streakDays={Number.isFinite(progress?.streakDays) ? progress.streakDays : 0} missedRecently={!!progress?.streakMissed} />
            </div>
            <div className="md:col-span-4">
              <RewardChestCard gems={Number.isFinite(progress?.gems) ? progress.gems : 0} onOpen={openChest} opened={chestOpened} />
            </div>
            <div className="md:col-span-4">
              <ProgressCard xp={personalization.xp} completedLessons={personalization.completed} />
            </div>
            <div className="md:col-span-4">
              <PracticeCard onPractice={onPractice} />
            </div>
            <div className="md:col-span-12 md:row-span-1">
              <NotificationsCard items={notifications} />
            </div>
          </div>
        </div>
      </main>

      <BottomNav tab={tab} setTab={setTab} />

      <Modal
        open={!!levelUp}
        title={levelUp ? `Level up: ${levelUp.from} → ${levelUp.to}` : ""}
        onClose={() => setLevelUp(null)}
      >
        <p className="text-sm text-white/80">Nice work. Keep going for another quick win.</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button className="rounded-xl2 bg-accent-gold px-4 py-2 text-sm font-semibold text-ink-950 shadow-card" onClick={() => setLevelUp(null)}>
            Continue
          </button>
        </div>
      </Modal>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);


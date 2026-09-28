import { getTrackMeta, isPlaying, getProgress } from "~/mod/features/utils/player";

interface DayStats {
  tracksPlayed: number;
  listeningTimeSec: number;
  artists: Record<string, number>;
}

interface StatsData {
  dailyStats: Record<string, DayStats>;
}

interface ActiveTrackSession {
  trackId: string;
  meta: any;
  durationSec: number;
  listenedSec: number;
  maxPositionSec: number;
  completed: boolean;
  reachedEnd: boolean;
}

let statsData: StatsData = { dailyStats: {} };
let activeSession: ActiveTrackSession | null = null;
let lastPollTimestamp = performance.now();
let dirty = false;

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ensureDay(key: string): DayStats {
  if (!statsData.dailyStats[key]) {
    statsData.dailyStats[key] = { tracksPlayed: 0, listeningTimeSec: 0, artists: {} };
  }
  return statsData.dailyStats[key];
}

function cleanOldData() {
  // Keep only last 90 days
  const keys = Object.keys(statsData.dailyStats).sort();
  if (keys.length > 90) {
    const toRemove = keys.slice(0, keys.length - 90);
    toRemove.forEach(k => delete statsData.dailyStats[k]);
    dirty = true;
  }
}

async function loadStats() {
  try {
    const stored = await window.yandexMusicMod?.getStorageValue("stats/data");
    if (stored && typeof stored === 'object' && stored.dailyStats) {
      statsData = stored as StatsData;
      // Sanitize inflated records where tracks were recorded without being listened to:
      // (e.g., 21 tracks in 360 seconds = 17 sec per track, physically impossible to have finished 21 tracks)
      Object.values(statsData.dailyStats).forEach(day => {
        if (day.tracksPlayed > 0 && day.listeningTimeSec < day.tracksPlayed * 45) {
          day.tracksPlayed = Math.max(0, Math.floor(day.listeningTimeSec / 150));
          dirty = true;
        }
      });
      if (dirty) saveStats();
    }
  } catch (e) {
    console.error('[Stats] Failed to load stats:', e);
  }
}

function saveStats() {
  if (!dirty) return;
  try {
    window.yandexMusicMod?.setStorageValue("stats/data", statsData);
    dirty = false;
  } catch (e) {
    console.error('[Stats] Failed to save stats:', e);
  }
}

function checkAndCredit(session: ActiveTrackSession, day: DayStats) {
  if (session.completed) return;
  const dur = session.durationSec > 0 ? session.durationSec : 180;

  // Track is counted ONLY if it was listened to completion:
  // 1) Reached the end (within 5 seconds of end or audio.ended) AND was actually listened to for at least 50% of track length (or at least 35 sec)
  // OR
  // 2) The user listened to at least 80% of the entire track duration
  const reachedEndValid = session.reachedEnd && session.listenedSec >= Math.min(35, dur * 0.5);
  const listenedThrough = session.listenedSec >= Math.max(25, dur * 0.80);

  if (reachedEndValid || listenedThrough) {
    session.completed = true;
    day.tracksPlayed++;

    if (session.meta?.artists) {
      session.meta.artists.forEach((a: any) => {
        if (a.name) {
          day.artists[a.name] = (day.artists[a.name] || 0) + 1;
        }
      });
    }

    dirty = true;
    saveStats();
    console.log(`[Stats] Track counted (listened to end): ${session.meta?.title || session.trackId} (${Math.round(session.listenedSec)}s / ${Math.round(dur)}s)`);
  }
}

function hookAudioEnded() {
  document.querySelectorAll("audio").forEach(audio => {
    if ((audio as any).__statsEndedHooked) return;
    (audio as any).__statsEndedHooked = true;
    audio.addEventListener("ended", () => {
      if (activeSession && !activeSession.completed) {
        activeSession.reachedEnd = true;
        const day = ensureDay(getTodayKey());
        checkAndCredit(activeSession, day);
      }
    });
  });
}

function poll() {
  try {
    hookAudioEnded();

    const now = performance.now();
    const dt = Math.min(3, Math.max(0.5, (now - lastPollTimestamp) / 1000));
    lastPollTimestamp = now;

    const playResult = isPlaying();
    if (playResult.isErr() || !playResult.value) return;

    const metaResult = getTrackMeta();
    if (metaResult.isErr() || !metaResult.value) return;

    const meta = metaResult.value;
    const trackId = meta.id || `${meta.title}:${meta.artists?.map((a: any) => a.name).join(',')}`;
    if (!trackId) return;

    const todayKey = getTodayKey();
    const day = ensureDay(todayKey);

    // Track total listening time
    day.listeningTimeSec += Math.round(dt);
    dirty = true;

    // Progress and audio info
    const progressResult = getProgress();
    const progress = progressResult.isOk() ? progressResult.value : null;

    const globalAudio = (window as any).__yandexMusicActiveAudio || ((window as any).__yandexMusicGetAudio && (window as any).__yandexMusicGetAudio());
    const audioList = Array.from(document.querySelectorAll("audio"));
    const activeAudio = globalAudio || audioList.find(a => !a.paused && a.currentTime > 0) || audioList[0] || null;

    const duration = (progress && progress.duration > 0)
      ? progress.duration
      : (activeAudio && activeAudio.duration > 0 ? activeAudio.duration : (meta.durationMs ? meta.durationMs / 1000 : 180));

    const position = (progress && Number.isFinite(progress.position))
      ? progress.position
      : (activeAudio ? activeAudio.currentTime : 0);

    const isAudioEnded = Boolean(activeAudio && activeAudio.ended);

    // Check track transition
    if (!activeSession || activeSession.trackId !== trackId) {
      if (activeSession && !activeSession.completed) {
        checkAndCredit(activeSession, day);
      }
      activeSession = {
        trackId,
        meta,
        durationSec: duration,
        listenedSec: 0,
        maxPositionSec: position,
        completed: false,
        reachedEnd: false,
      };
    }

    // Accumulate for active session
    activeSession.durationSec = Math.max(activeSession.durationSec, duration);
    activeSession.listenedSec += dt;
    activeSession.maxPositionSec = Math.max(activeSession.maxPositionSec, position);

    if (
      isAudioEnded ||
      (activeSession.durationSec > 10 && position >= activeSession.durationSec - 5) ||
      (progress && progress.progress >= 92)
    ) {
      activeSession.reachedEnd = true;
    }

    if (!activeSession.completed) {
      checkAndCredit(activeSession, day);
    }
  } catch (e) {
    // silently ignore
  }
}

export function getStats() {
  const today = getTodayKey();
  const now = new Date();
  
  // Calculate week start (Monday)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekStartKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
  
  // Calculate month start
  const monthStartKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  let todayStats = ensureDay(today);
  
  let weekTracks = 0, weekTime = 0;
  let monthTracks = 0, monthTime = 0;
  const allArtists: Record<string, number> = {};

  Object.entries(statsData.dailyStats).forEach(([key, day]) => {
    if (key >= weekStartKey) {
      weekTracks += day.tracksPlayed;
      weekTime += day.listeningTimeSec;
    }
    if (key >= monthStartKey) {
      monthTracks += day.tracksPlayed;
      monthTime += day.listeningTimeSec;
    }
    Object.entries(day.artists).forEach(([name, count]) => {
      allArtists[name] = (allArtists[name] || 0) + count;
    });
  });

  let allTimeTracks = 0, allTimeTime = 0;
  Object.values(statsData.dailyStats).forEach((day) => {
    allTimeTracks += day.tracksPlayed;
    allTimeTime += day.listeningTimeSec;
  });

  // Top 15 artists
  const topArtists = Object.entries(allArtists)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  return {
    today: { tracks: todayStats.tracksPlayed, timeSec: todayStats.listeningTimeSec },
    week: { tracks: weekTracks, timeSec: weekTime },
    month: { tracks: monthTracks, timeSec: monthTime },
    allTime: { tracks: allTimeTracks, timeSec: allTimeTime },
    topArtists,
  };
}

export function resetStats() {
  statsData = { dailyStats: {} };
  activeSession = null;
  dirty = true;
  saveStats();
}

export { loadStats };

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

// Initialize
(async () => {
  await loadStats();
  cleanOldData();
  setInterval(poll, 1500);
  setInterval(saveStats, 30000);
  // Save on page unload
  window.addEventListener('beforeunload', () => saveStats());
  console.log('[Stats] Accurate tracker initialized (counts only completed tracks)');
})();

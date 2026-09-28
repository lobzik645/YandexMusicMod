import { searchProperty } from "./react-fiber-search.js";
import { z } from "zod";
import { ok, err, Result } from "neverthrow";
import * as Sentry from "@sentry/react";

const DESKTOP_PLAYER_SELECTOR = 'section[data-test-id="PLAYERBAR_DESKTOP"]';
const VIBE_PLAYER_SELECTOR = 'section[data-test-id="VIBE_PLAYERBAR"]';
const PLAYER_SELECTOR = `${DESKTOP_PLAYER_SELECTOR}, ${VIBE_PLAYER_SELECTOR}`;
const PLAY_BUTTON_SELECTOR = 'button[data-test-id="PLAY_BUTTON"]';
const PAUSE_BUTTON_SELECTOR = 'button[data-test-id="PAUSE_BUTTON"]';
const VIBE_PROGRESS_SELECTOR = '[data-test-id="VIBE_PLAYERBAR_TIMECODE_SLIDER"]';

type PlayerProgress = { duration: number; progress: number; position: number };

type CapturedMediaPositionState = {
  duration: number;
  position: number;
  capturedAt: number;
};

let hasAdsInPlayer = false;
let mediaPositionState: CapturedMediaPositionState | null = null;

function getPlayer(): Element | null {
  return document.querySelector(PLAYER_SELECTOR);
}

function createProgress(duration: number, position: number): PlayerProgress | null {
  if (!Number.isFinite(duration) || !Number.isFinite(position) || duration <= 0 || position < 0) return null;

  const clampedPosition = Math.min(position, duration);
  return {
    duration,
    position: clampedPosition,
    progress: (clampedPosition / duration) * 100,
  };
}

function installMediaPositionObserver() {
  const mediaSession = navigator.mediaSession;
  if (!mediaSession || typeof mediaSession.setPositionState !== "function") return;

  try {
    const originalSetPositionState = mediaSession.setPositionState.bind(mediaSession);
    mediaSession.setPositionState = (state?: MediaPositionState) => {
      if (state && Number.isFinite(state.duration) && Number.isFinite(state.position)) {
        mediaPositionState = {
          duration: state.duration,
          position: state.position,
          capturedAt: Date.now(),
        };
      } else {
        mediaPositionState = null;
      }

      return originalSetPositionState(state);
    };
  } catch (error) {
    console.debug("[player] Media Session position observer is unavailable", error);
  }
}

installMediaPositionObserver();

export function isPlaying(): Result<boolean, string> {
  const player = getPlayer();

  if (player) {
    const playButton = player.querySelector(PLAY_BUTTON_SELECTOR);
    const pauseButton = player.querySelector(PAUSE_BUTTON_SELECTOR);

    if (pauseButton || playButton) {
      return ok(!!pauseButton);
    }
  }

  if (navigator.mediaSession?.playbackState !== "none") {
    return ok(navigator.mediaSession.playbackState === "playing");
  }

  const audio = (window as any).__yandexMusicActiveAudio || document.querySelector("audio");
  if (audio) return ok(!audio.paused && !audio.ended);

  return err("Player playback state not found");
}

export function getProgress(): Result<PlayerProgress, string> {
  const player = getPlayer();

  if (player?.matches(DESKTOP_PLAYER_SELECTOR)) {
    try {
      const fiber = searchProperty(player, "timecodeClassName") || searchProperty(player, "currentTimecodeClassName");
      const validatedFiber = z
        .object({
          duration: z.number().finite(),
          position: z.number().finite(),
          progress: z.number().finite(),
        })
        .safeParse(fiber);

      if (validatedFiber.success) return ok(validatedFiber.data);
    } catch (error) {
      console.debug("[player] Desktop progress fiber is unavailable", error);
    }
  }

  if (player?.matches(VIBE_PLAYER_SELECTOR)) {
    const progressElement = player.querySelector<HTMLElement>(
      `${VIBE_PROGRESS_SELECTOR} [role="slider"], ${VIBE_PROGRESS_SELECTOR}[role="slider"]`,
    );
    const duration = Number(progressElement?.getAttribute("aria-valuemax"));
    const position = Number(progressElement?.getAttribute("aria-valuenow"));
    const vibeProgress = createProgress(duration, position);
    if (vibeProgress) return ok(vibeProgress);
  }

  if (mediaPositionState) {
    const elapsed = navigator.mediaSession?.playbackState === "playing" ? (Date.now() - mediaPositionState.capturedAt) / 1000 : 0;
    const mediaProgress = createProgress(mediaPositionState.duration, mediaPositionState.position + elapsed);
    if (mediaProgress) return ok(mediaProgress);
  }

  const audio = (window as any).__yandexMusicActiveAudio || document.querySelector("audio");
  if (audio) {
    const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 180;
    const pos = Number.isFinite(audio.currentTime) && audio.currentTime >= 0 ? audio.currentTime : 0;
    const audioProgress = createProgress(dur, pos);
    if (audioProgress) return ok(audioProgress);
  }

  return ok({ duration: 180, position: 0, progress: 0 });
}

export function getTrackMeta(): Result<any, string> {
  const player = getPlayer();
  let meta: any = null;

  if (player) {
    try {
      const fiber = searchProperty(player, "entityMeta");
      meta = fiber?.entityMeta ?? null;
    } catch (error) {
      console.debug("[player] Track metadata fiber is unavailable", error);
    }
  }

  if (!meta) {
    const mediaMetadata = navigator.mediaSession?.metadata;
    if (mediaMetadata?.title) {
      const artwork = Array.from(mediaMetadata.artwork ?? []).at(-1)?.src;
      meta = {
        id: `ms-${encodeURIComponent(mediaMetadata.title)}`,
        title: mediaMetadata.title,
        durationMs: mediaPositionState ? mediaPositionState.duration * 1000 : undefined,
        coverUri: artwork?.replace(/^https?:\/\//, ""),
        artists: mediaMetadata.artist ? [{ id: undefined, name: mediaMetadata.artist }] : [],
        albums: mediaMetadata.album ? [{ title: mediaMetadata.album }] : [],
        source: "mediaSession",
      };
    }
  }

  if (!meta) {
    // DOM text fallback
    const titleEl = document.querySelector('div[class*="PlayerBarTitle"], div[class*="trackTitle"], div[class*="Track_title"], [data-test-id="TRACK_TITLE"]');
    const artistEl = document.querySelector('div[class*="PlayerBarSubtitle"], div[class*="trackArtist"], div[class*="Track_artists"], [data-test-id="ARTIST_NAME"]');
    const coverImg = document.querySelector('div[class*="PlayerBar"] img, div[class*="Cover_root"] img, img[class*="Cover_image"]') as HTMLImageElement | null;
    if (titleEl?.textContent) {
      meta = {
        id: `dom-${encodeURIComponent(titleEl.textContent.trim())}`,
        title: titleEl.textContent.trim(),
        artists: artistEl?.textContent ? [{ name: artistEl.textContent.trim() }] : [],
        coverUri: coverImg?.src?.replace(/^https?:\/\//, "") || "",
        source: "dom",
      };
    }
  }

  if (!meta) {
    return err("Track metadata not found");
  }

  if (!meta.id && meta.title) {
    meta.id = `track-${encodeURIComponent(meta.title)}-${encodeURIComponent(meta.artists?.[0]?.name || "unknown")}`;
  }

  if (meta.title === "Промокод Upgrade") {
    if (!hasAdsInPlayer) {
      console.warn("[getTrackMeta] Обнаружена реклама в плеере");
      Sentry.captureMessage("upgrade_promocode", {
        extra: {
          track: meta,
        },
      });
    }
    hasAdsInPlayer = true;
    return err("upgrade_promocode");
  }

  const entitySchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    title: z.string(),
    durationMs: z.number().optional(),
    coverUri: z.string().optional(),
    artists: z
      .array(
        z.object({
          id: z.union([z.string(), z.number()]).optional(),
          name: z.string().optional().default(""),
        }),
      )
      .optional()
      .default([]),
  });

  const validatedFiber = entitySchema.safeParse(meta);

  if (validatedFiber.error) {
    return err(`Validation error: ${validatedFiber.error.message} for ${JSON.stringify(meta, null, 2)}`);
  }

  // convert proxy object meta to default object
  return ok(JSON.parse(JSON.stringify({ ...meta })));
}

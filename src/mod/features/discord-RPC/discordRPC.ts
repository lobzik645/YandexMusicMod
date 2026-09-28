import { getTrackMeta, getProgress, isPlaying } from "~/mod/features/utils/player";
import * as Sentry from "@sentry/react";

let isRpcEnabled = true;
let showModButton = true;

// Функция для получения состояния плеера из окна приложения. Её вызывает main процесс - src\mod\main.js
window.__getPlayerState = () => {
  const trackMetaRequest = getTrackMeta();
  const playbackRequest = getProgress();
  const isPlayingRequest = isPlaying();

  if (trackMetaRequest.isErr()) {
    return {
      enabled: isRpcEnabled,
      showModButton: showModButton,
      data: null,
    };
  }

  const playback = playbackRequest.isOk()
    ? playbackRequest.value
    : { duration: 180, position: 0, progress: 0 };
  const playing = isPlayingRequest.isOk() ? isPlayingRequest.value : true;

  const state = {
    enabled: isRpcEnabled,
    showModButton: showModButton,
    data: {
      trackMeta: trackMetaRequest.value,
      playback,
      isPlaying: playing,
    },
  };

  return state;
};

function broadcastState() {
  try {
    if (typeof window !== "undefined" && window.__getPlayerState && window.yandexMusicMod?.updateDiscordRpc) {
      const state = window.__getPlayerState();
      window.yandexMusicMod.updateDiscordRpc(state);
    }
  } catch (e) {
    // ignore
  }
}

window.yandexMusicMod.onStorageChanged((key: string, value: any) => {
  if (key === "discordRPC/enabled" && value !== isRpcEnabled) {
    isRpcEnabled = value;
    broadcastState();
  }
  if (key === "discordRPC/showModButton" && value !== showModButton) {
    showModButton = value;
    broadcastState();
  }
});

(async () => {
  isRpcEnabled = (await window.yandexMusicMod.getStorageValue("discordRPC/enabled")) !== false;
  showModButton = (await window.yandexMusicMod.getStorageValue("discordRPC/showModButton")) !== false;
  
  // Periodic broadcast
  setInterval(broadcastState, 1500);
})();

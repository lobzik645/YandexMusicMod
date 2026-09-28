const { BrowserWindow, ipcMain } = require("electron");
const { Client } = require("@xhayper/discord-rpc");

const CLIENT_ID = "1283109459463377011";
const ACTIVITY_COOLDOWN = 4 * 1000;

let lastActivityChanged = 0;
let lastTrackKey = null;
let lastIsPlaying = false;
let client = null;
let reconnectTimeout = null;
let latestPlayerState = null;

try {
  if (ipcMain) {
    ipcMain.on("yandexMusicMod.updateDiscordRpc", (_ev, state) => {
      latestPlayerState = state;
    });
  }
} catch (e) {}

function scheduleReconnect() {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    initRpc();
  }, 4000);
}

function initRpc() {
  try {
    if (client) {
      try {
        client.destroy();
      } catch (e) {}
    }

    client = new Client({ clientId: CLIENT_ID });

    client.login().catch((e) => {
      console.error("[DISCORD RPC] Login failed:", e);
      scheduleReconnect();
    });

    client.on("ready", () => {
      console.log("[DISCORD RPC] Hooked successfully!");
      console.log("[DISCORD RPC] User:", client.user?.username);
    });

    client.on("disconnected", () => {
      console.log("[DISCORD RPC] Disconnected");
      scheduleReconnect();
    });

    client.on("error", (e) => {
      console.log("[DISCORD RPC] Error:", e);
      scheduleReconnect();
    });

    client.on("close", () => {
      console.log("[DISCORD RPC] Closed");
      scheduleReconnect();
    });
  } catch (err) {
    console.error("[DISCORD RPC] initRpc error:", err);
    scheduleReconnect();
  }
}

async function updateActivity() {
  setTimeout(updateActivity, 1500);

  if (!client?.user) return;

  try {
    const playerState = latestPlayerState || (await GetAppPlayerState());

    if (!playerState) return;

    // Discord RPC не включен
    if (playerState.enabled === false) {
      if (lastTrackKey !== null) {
        client.user.clearActivity().catch(() => {});
        lastTrackKey = null;
        lastIsPlaying = false;
      }
      return;
    }

    const playerStateData = playerState.data;

    if (!playerStateData?.trackMeta || !playerStateData.isPlaying) {
      if (lastTrackKey !== null) {
        client.user.clearActivity().catch(() => {});
        lastTrackKey = null;
        lastIsPlaying = false;
      }
      return;
    }

    const trackId = playerStateData.trackMeta.id;
    const trackTitle = playerStateData.trackMeta.title || "Без названия";
    const trackArtists = Array.isArray(playerStateData.trackMeta.artists)
      ? playerStateData.trackMeta.artists.map((a) => a.name).filter(Boolean).join(", ")
      : "";
    const currentTrackKey = `${trackId || ""}:${trackTitle}:${trackArtists}`;

    const isNewTrackOrState = lastTrackKey !== currentTrackKey || lastIsPlaying !== playerStateData.isPlaying;

    if (!isNewTrackOrState && (lastActivityChanged + ACTIVITY_COOLDOWN > Date.now())) {
      return;
    }

    const position = playerStateData.playback?.position || 0;
    const duration = playerStateData.playback?.duration || 0;

    let startTimestamp = undefined;
    let endTimestamp = undefined;
    if (duration > 0 && position >= 0) {
      startTimestamp = Math.round(Date.now() - position * 1000);
      endTimestamp = Math.round(Date.now() + (duration - position) * 1000);
    } else {
      startTimestamp = Math.round(Date.now());
    }

    const coverUri = playerStateData.trackMeta.coverUri;
    let coverUrl = undefined;
    if (coverUri) {
      if (coverUri.startsWith("http://") || coverUri.startsWith("https://")) {
        coverUrl = coverUri.replaceAll("%%", "300x300");
      } else {
        coverUrl = `https://${coverUri.replaceAll("%%", "300x300")}`;
      }
    }

    const titleFull = playerStateData.trackMeta.version
      ? `${trackTitle} (${playerStateData.trackMeta.version})`
      : trackTitle;

    const buttons = [];
    if (trackId && /^\d+$/.test(String(trackId))) {
      buttons.push({
        label: "🎵 Открыть трек",
        url: `https://music.yandex.ru/track/${trackId}`,
      });
    } else if (trackTitle) {
      buttons.push({
        label: "🎵 Найти в Яндекс Музыке",
        url: `https://music.yandex.ru/search?text=${encodeURIComponent(trackTitle)}`,
      });
    }

    if (playerState.showModButton) {
      buttons.push({
        label: "💻 Luna Mod",
        url: "https://github.com/gagayhhad-tech/YandexMusicBetaMod-FckCensor",
      });
    }

    const rpcRequest = {
      type: 2,
      details: titleFull.slice(0, 120),
      state: (trackArtists || "Яндекс Музыка").slice(0, 120),
      instance: false,
    };

    if (coverUrl) {
      rpcRequest.largeImageKey = coverUrl;
      rpcRequest.largeImageText = (playerStateData.trackMeta.albums?.[0]?.title || "Яндекс Музыка").slice(0, 120);
    }

    if (startTimestamp && endTimestamp && endTimestamp > startTimestamp) {
      rpcRequest.startTimestamp = startTimestamp;
      rpcRequest.endTimestamp = endTimestamp;
    }

    if (buttons.length > 0) {
      rpcRequest.buttons = buttons.slice(0, 2);
    }

    await client.user.setActivity(rpcRequest);

    lastTrackKey = currentTrackKey;
    lastIsPlaying = playerStateData.isPlaying;
    lastActivityChanged = Date.now();
  } catch (ex) {
    console.log("[DISCORD RPC] Error updating activity:", ex);
  }
}

initRpc();
updateActivity();

async function GetAppPlayerState() {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (win && !win.isDestroyed() && win.webContents) {
      try {
        const state = await win.webContents.executeJavaScript(`
          (function() {
            try {
              return typeof window.__getPlayerState === "function" ? window.__getPlayerState() : null;
            } catch (e) {
              return null;
            }
          })()
        `);
        if (state) {
          return state;
        }
      } catch (e) {
        // window might not have loaded or might be another window (e.g. OSD)
      }
    }
  }
  return null;
}

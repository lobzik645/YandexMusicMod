import axios from "axios";
import type { AxiosInstance } from "axios";
import { Result, ResultAsync, ok, err, okAsync, errAsync } from "neverthrow";
import { z } from "zod";

const SECRET_KEY = "kzqU4XhfCaY6B6JTHODeq5";
const OAuthToken = localStorage.oauth ? "OAuth " + JSON.parse(localStorage.oauth).value : null;

// Бандл мода выполняется РАНЬШЕ кода приложения, window.VERSION ещё не задан
// (и в новых версиях клиента вообще не существует). Без валидной версии
// get-file-info отвечает 403 not-allowed.
const APP_VERSION: string = (window as any).VERSION || "5.127.0";

export enum QualityEnum {
  LOSSLESS = "lossless",
  NQ = "nq",
  LQ = "lq",
}

const headers = {
  "X-Yandex-Music-Client": "YandexMusicDesktopAppWindows/" + APP_VERSION,
  "X-Yandex-Music-Frontend": "new",
  "X-Yandex-Music-Without-Invocation-Info": "1",
  Authorization: OAuthToken,
};

// Create axios client with common headers
const yandexMusicClient: AxiosInstance = axios.create({
  baseURL: "https://api.music.yandex.net",
  headers: headers,
  // Prevent axios from throwing on HTTP error status codes
  validateStatus: () => true,
});

// HMAC sign function
export async function getSign(params: { secretKey: string; data: string }): Promise<Result<string, string>> {
  try {
    const { secretKey, data } = params;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      {
        name: "HMAC",
        hash: {
          name: "SHA-256",
        },
      },
      true,
      ["sign", "verify"],
    );

    const messageData = encoder.encode(data);
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature))).slice(0, -1);

    return ok(base64Signature);
  } catch (error) {
    return err(`Failed to generate HMAC signature: ${error}`);
  }
}

// Нормализует ответ get-file-info: всегда есть url (первая ссылка), urls и key (или null)
function normalizeDownloadInfo(downloadInfo: any): any {
  const urls: string[] = Array.isArray(downloadInfo.urls) ? downloadInfo.urls : [];
  const url = downloadInfo.url || downloadInfo.directLink || urls[0] || null;

  return {
    ...downloadInfo,
    urls: urls.length ? urls : url ? [url] : [],
    url,
    // ключ шифрования есть только у encraw-транспорта; подменённые (YMLiberty) треки идут без него
    key: downloadInfo.key || null,
    codec: downloadInfo.codec || "mp3",
  };
}

// Получить прямую ссылку на трек
export async function getTrackUrl(trackId: string, quality: QualityEnum): Promise<Result<any, string>> {
  try {
    if (typeof (window as any).getYMLibertyTrackUrlAsync === "function") {
      const fckUrl = await (window as any).getYMLibertyTrackUrlAsync(trackId);
      if (fckUrl) {
        return ok(
          normalizeDownloadInfo({
            trackId: trackId,
            directLink: fckUrl,
            codec: fckUrl.endsWith(".flac") ? "flac" : "mp3",
            bitrateInKbps: 320,
          }),
        );
      }
    }

    const ts = Math.floor(Date.now() / 1000);
    const audioСodecs = ["flac", "aac", "he-aac", "mp3", "flac-mp4", "aac-mp4", "he-aac-mp4"];
    const transports = "encraw";

    const signResult = await getSign({
      data: `${ts}${trackId}${quality}${audioСodecs.join("")}${transports}`,
      secretKey: SECRET_KEY,
    });

    if (signResult.isErr()) {
      return err(signResult.error);
    }

    for (let i = 0; i < 10; i++) {
      const response = await yandexMusicClient.get(
        `/get-file-info?ts=${ts}&trackId=${trackId}&quality=${quality}&codecs=${encodeURIComponent(audioСodecs.join(","))}&transports=${transports}&sign=${encodeURIComponent(signResult.value)}`,
      );

      if (response.status !== 200) {
        return err(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (response.data.downloadInfo.trackId !== trackId) {
        console.warn("[downloader] Track id mismatch :", response.data.downloadInfo.trackId, trackId);
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }

      const downloadInfo = normalizeDownloadInfo(response.data.downloadInfo);

      if (!downloadInfo.url) {
        return err("Failed to get track URL: response has no urls");
      }

      return ok(downloadInfo);
    }

    return err(`Failed to get track URL: too many requests`);
  } catch (error) {
    return err(`Failed to get track URL: ${error}`);
  }
}

// Получить треки из альбома
export async function getAlbumTracks(id: string): Promise<Result<string[], string>> {
  try {
    const response = await yandexMusicClient.get(
      `/albums/${id}/with-tracks?resumeStream=false&richTracks=false&withListeningFinished=false`,
    );

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.data?.volumes) {
      return err("Invalid response format: missing volumes");
    }

    const trackIds = response.data.volumes.flatMap((volume: any[]) => volume.map((track: any) => track.id));

    return ok(trackIds);
  } catch (error) {
    return err(`Failed to get album tracks: ${error}`);
  }
}

// UUID-плейлисты запрашиваются через /playlist/{uuid}, остальные (вида /users/{uid}/playlists/{kind}) — через /users/{uid}/playlists/{kind}
export function isPlaylistUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// Получить треки из плейлиста
export async function getPlaylistTracks(id: string, owner?: string | null): Promise<Result<string[], string>> {
  try {
    const playlistPath = isPlaylistUuid(id)
      ? `/playlist/${id}`
      : owner
        ? `/users/${owner}/playlists/${id}`
        : `/playlist/${id}`;

    const response = await yandexMusicClient.get(`${playlistPath}?resumeStream=false&richTracks=false`);

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.data?.tracks) {
      return err("Invalid response format: missing tracks");
    }

    const trackIds = response.data.tracks.map((track: any) => String(track.id));

    return ok(trackIds);
  } catch (error) {
    return err(`Failed to get playlist tracks: ${error}`);
  }
}

// Получить треки артиста
export async function getArtistTracks(id: string): Promise<Result<string[], string>> {
  try {
    const response = await yandexMusicClient.get(`/artists/${id}/track-ids?`);

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.data || !Array.isArray(response.data)) {
      return err("Invalid response format: missing tracks");
    }

    const trackIds = response.data;

    return ok(trackIds);
  } catch (error) {
    return err(`Failed to get playlist tracks: ${error}`);
  }
}

// Получить треки по айди
export async function getTracksInfo(trackIds: string[], skipAuth = false): Promise<Result<Array<any>, string>> {
  try {
    const queryTracks = trackIds.join(",");

    const response = await yandexMusicClient.get(
      `/tracks?trackIds=${queryTracks}&removeDuplicates=false&withProgress=true`,
      {
        headers: {
          ...headers,
          Authorization: skipAuth ? undefined : OAuthToken,
        },
      },
    );

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!Array.isArray(response.data)) {
      return err("Invalid response format: expected array");
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to get tracks info: ${error}`);
  }
}

// Добавить трек в лайки пользователя
export async function likeTrack(userId: number, trackId: string): Promise<Result<any, string>> {
  try {
    const response = await yandexMusicClient.post(
      `/users/${userId}/likes/tracks/add?trackId=${trackId}`,
      {},
      {
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.status !== 200 && response.status !== 201) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to add track to likes: ${error}`);
  }
}

// Получить информацию об аккаунте
export async function getAccountInfo(): Promise<Result<{ uid: number }, string>> {
  try {
    const response = await yandexMusicClient.get("/account/about");

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.data) {
      return err("Invalid response format: missing data");
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to get account info: ${error}`);
  }
}

export async function getLikesAndHistory(): Promise<
  Result<{ favorites: { playlistUuid: string }; count: number }, string>
> {
  try {
    const response = await yandexMusicClient.get("/landing-blocks/likes-and-history");

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.data) {
      return err("Invalid response format: missing data");
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to get likes and history: ${error}`);
  }
}

// Получить настройки аккаунта
export async function getAccountSettings(): Promise<
  Result<{ adsDisabled: boolean; userMusicVisibility: string }, string>
> {
  try {
    const response = await yandexMusicClient.get("/account/settings");

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.data) {
      return err("Invalid response format: missing data");
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to get likes and history: ${error}`);
  }
}

// Обновить настройки аккаунта (по ключу и значению)
export async function updateAccountSettings(
  key: string,
  value: string | number | boolean,
): Promise<Result<any, string>> {
  try {
    const response = await yandexMusicClient.post(`/account/settings?${key}=${value}`);

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to update account settings: ${error}`);
  }
}

// Получить настройки аккаунта
export async function getAccountExperiments(): Promise<Result<any, string>> {
  try {
    const response = await yandexMusicClient.get("/account/experiments/details");

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to get account experiments: ${error}`);
  }
}


import { getTrackUrl, QualityEnum } from "~/mod/features/utils/api";
import { toast } from "sonner";

export type QueueStatus = "pending" | "downloading" | "decrypting" | "completed" | "error" | "cancelled";

export interface QueueItem {
  id: string;
  trackId: string;
  title: string;
  artistsText: string;
  coverUri: string | null;
  status: QueueStatus;
  /** 0..100, -1 = безразмерный (total неизвестен) */
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  /** качество и папка фиксируются на момент постановки в очередь, чтобы
   * новая партия с другими настройками не меняла их у уже ожидающих треков */
  quality: QualityEnum;
  folderPath: string;
  error?: string;
  /** показать тост по завершении (для одиночных треков из контекстного меню) */
  notify?: boolean;
}

const MAX_CONCURRENT = 3;

const items = new Map<string, QueueItem>();
const order: string[] = [];
const listeners = new Set<() => void>();
let running = 0;
let counter = 0;

// Кэш снапшота: useSyncExternalStore требует стабильную ссылку между рендерами,
// иначе React уходит в бесконечный ре-рендер и крашит дерево
let snapshotCache: QueueItem[] = [];

function rebuildSnapshot() {
  snapshotCache = order.map((id) => items.get(id)!).filter(Boolean);
}

function notify() {
  rebuildSnapshot();
  listeners.forEach((l) => l());
}

function nextId(): string {
  counter += 1;
  return `dl-${Date.now()}-${counter}`;
}

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getQueueSnapshot(): QueueItem[] {
  return snapshotCache;
}

export function getQueueStats() {
  const all = getQueueSnapshot();
  return {
    total: all.length,
    pending: all.filter((i) => i.status === "pending").length,
    active: all.filter((i) => i.status === "downloading" || i.status === "decrypting").length,
    completed: all.filter((i) => i.status === "completed").length,
    failed: all.filter((i) => i.status === "error" || i.status === "cancelled").length,
  };
}

function upsertItem(item: QueueItem) {
  if (!items.has(item.id)) order.push(item.id);
  items.set(item.id, item);
  notify();
}

function patchItem(id: string, patch: Partial<QueueItem>) {
  const item = items.get(id);
  if (!item) return;
  items.set(id, { ...item, ...patch });
  notify();
}

// Прогресс из main-процесса
window.yandexMusicMod.onDownloadProgress((payload) => {
  const { id, status, loaded, total, speed } = payload || {};
  if (!id || !items.has(id)) return;

  const item = items.get(id)!;
  const progress = total > 0 ? Math.min(100, (loaded / total) * 100) : item.progress;

  patchItem(id, {
    status: status === "decrypting" ? "decrypting" : (status as QueueStatus) || item.status,
    downloadedBytes: loaded || 0,
    totalBytes: total || item.totalBytes,
    speedBytesPerSec: speed || 0,
    progress,
  });
});

// Тосты для одиночных загрузок (контекстное меню / «Текущий трек»):
// результат виден сразу, без открытия панели настроек
function notifySuccess(item: QueueItem) {
  toast.success("Трек скачан", {
    description: `${item.artistsText ? item.artistsText + " — " : ""}${item.title}`,
    action: {
      label: "Папка",
      onClick: () => window.yandexMusicMod.openFolder(item.folderPath || ""),
    },
  });
}

function notifyFailure(item: QueueItem, error?: string) {
  toast.error("Не удалось скачать трек", {
    description: `${item.artistsText ? item.artistsText + " — " : ""}${item.title}${error ? `: ${error}` : ""}`,
  });
}

async function processItem(item: QueueItem) {
  running += 1;
  patchItem(item.id, { status: "downloading" });
  console.log(`[DownloadQueue] started: ${item.trackId} "${item.title}" quality=${item.quality}`);

  try {
    const downloadInfo = await getTrackUrl(item.trackId, item.quality);

    if (downloadInfo.isErr()) {
      console.error(`[DownloadQueue] getTrackUrl failed for ${item.trackId}:`, downloadInfo.error);
      patchItem(item.id, { status: "error", error: downloadInfo.error, speedBytesPerSec: 0 });
      return;
    }

    const meta = {
      id: item.trackId,
      title: item.title,
      artists: item.artistsText ? item.artistsText.split(", ").map((name) => ({ name })) : [],
      albums: [],
      coverUri: item.coverUri || undefined,
    };

    const result = await window.yandexMusicMod.downloadTrack(downloadInfo.value, meta, item.folderPath, item.id);
    console.log(`[DownloadQueue] main download result for ${item.trackId}:`, JSON.stringify(result));

    if (result?.cancelled) {
      patchItem(item.id, { status: "cancelled", speedBytesPerSec: 0 });
    } else if (result?.error) {
      patchItem(item.id, { status: "error", error: result.error, speedBytesPerSec: 0 });
      if (item.notify) notifyFailure(item, result.error);
    } else {
      patchItem(item.id, { status: "completed", progress: 100, speedBytesPerSec: 0 });
      if (item.notify) notifySuccess(item);
    }
  } catch (error) {
    patchItem(item.id, { status: "error", error: String(error), speedBytesPerSec: 0 });
    if (item.notify) notifyFailure(item, String(error));
  } finally {
    running -= 1;
    pump();
  }
}

function pump() {
  while (running < MAX_CONCURRENT) {
    const next = getQueueSnapshot().find((i) => i.status === "pending");
    if (!next) break;
    patchItem(next.id, { status: "downloading" });
    processItem(next);
  }
}

// Добавить треки в очередь (возврат: сколько добавлено и сколько пропущено как дубли)
export function enqueueTracks(
  tracks: Array<{ id: string; title?: string; artists?: any[]; coverUri?: string; available?: boolean }>,
  quality: QualityEnum,
  folderPath?: string,
): { added: number; duplicates: number } {
  let added = 0;
  let duplicates = 0;

  for (const track of tracks) {
    if (!track?.id) continue;
    if (track.available === false) continue;

    // не дублируем: этот трек уже ждёт/скачивается
    const trackIdStr = String(track.id);
    const activeDuplicate = [...items.values()].some(
      (i) => i.trackId === trackIdStr && (i.status === "pending" || i.status === "downloading" || i.status === "decrypting"),
    );
    if (activeDuplicate) {
      duplicates += 1;
      continue;
    }

    const id = nextId();
    upsertItem({
      id,
      trackId: String(track.id),
      title: track.title || "Неизвестный трек",
      artistsText: (track.artists || []).map((a: any) => a.name).filter(Boolean).join(", "),
      coverUri: track.coverUri || null,
      status: "pending",
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speedBytesPerSec: 0,
      // качество и папка фиксируются на момент постановки в очередь
      quality,
      folderPath: folderPath || "",
      // одиночная загрузка — уведомляем о результате тостом
      notify: tracks.length === 1,
    });
    added += 1;
  }

  pump();
  return { added, duplicates };
}

export function cancelQueueItem(id: string) {
  window.yandexMusicMod.cancelDownload(id);
  patchItem(id, { status: "cancelled", speedBytesPerSec: 0 });
}

// Повторить неудачную/отменённую загрузку
export function retryQueueItem(id: string) {
  const item = items.get(id);
  if (!item) return;
  patchItem(id, {
    status: "pending",
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speedBytesPerSec: 0,
    error: undefined,
  });
  pump();
}

export function clearFinishedFromQueue() {
  for (const id of [...order]) {
    const item = items.get(id);
    if (item && (item.status === "completed" || item.status === "error" || item.status === "cancelled")) {
      items.delete(id);
      order.splice(order.indexOf(id), 1);
    }
  }
  notify();
}

// Дебаг-хук для самодиагностики (используется self-test'ом и из консоли)
(window as any).__lunaDebug = {
  enqueue: enqueueTracks,
  stats: getQueueStats,
  snapshot: getQueueSnapshot,
  clearFinished: clearFinishedFromQueue,
};

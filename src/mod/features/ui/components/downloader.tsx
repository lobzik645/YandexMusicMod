import { useState, useEffect, useRef, useSyncExternalStore } from "react";

import { getCurrentNumericTrackId } from "~/mod/features/utils/player";
import { getAlbumTracks, getArtistTracks, getPlaylistTracks, getTracksInfo, QualityEnum } from "~/mod/features/utils/api";
import {
  enqueueTracks,
  cancelQueueItem,
  retryQueueItem,
  clearFinishedFromQueue,
  subscribeQueue,
  getQueueSnapshot,
  getQueueStats,
  type QueueItem,
} from "~/mod/features/downloader/download-queue";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Button } from "@ui/components/ui/button";
import { If } from "@ui/components/ui/if";
import { Progress } from "@ui/components/ui/progress";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@ui/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/components/ui/select";
import { Input } from "@ui/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";

import { Info, FolderOpen, Folder, Download, X, RotateCcw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

enum pageTypeEnum {
  OTHER,
  ARTIST,
  PLAYLIST,
  ALBUM,
}

const qualityLabels: Record<QualityEnum, string> = {
  [QualityEnum.LOSSLESS]: "Максимальное",
  [QualityEnum.NQ]: "Среднее",
  [QualityEnum.LQ]: "Низкое",
};

const CONCURRENT_DOWNLOADS = 3;

function coverUrl(coverUri: string | null | undefined): string | null {
  if (!coverUri) return null;
  return `https://${coverUri.replaceAll("%%", "200x200")}`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  if (bytes >= 1024) return `${Math.floor(bytes / 1024)} КБ`;
  return `${bytes} Б`;
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec) return "";
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} МБ/с`;
  return `${Math.floor(bytesPerSec / 1024)} КБ/с`;
}

function useQueue() {
  return useSyncExternalStore(subscribeQueue, getQueueSnapshot, getQueueSnapshot);
}

function QueueRow({ item }: { item: QueueItem }) {
  const cover = coverUrl(item.coverUri);
  const isActive = item.status === "downloading" || item.status === "decrypting";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-2.5 transition-all duration-200 hover:bg-white/[0.06]">
      {cover ? (
        <img src={cover} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" loading="lazy" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/5">
          <Download className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium text-foreground">{item.title}</span>
          <span className="shrink-0 truncate text-[10px] text-muted-foreground">{item.artistsText}</span>
        </div>

        <If condition={isActive || item.status === "pending"}>
          <div className="mt-1 flex items-center gap-2">
            <Progress value={item.progress > 0 ? item.progress : item.status === "pending" ? 0 : 5} className="h-1.5" />
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {item.status === "decrypting"
                ? "Обработка…"
                : item.status === "pending"
                  ? "В очереди"
                  : item.totalBytes > 0
                    ? `${Math.floor(item.progress)}% • ${formatSpeed(item.speedBytesPerSec)}`
                    : formatBytes(item.downloadedBytes)}
            </span>
          </div>
        </If>

        <If condition={item.status === "completed"}>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Скачано{item.totalBytes > 0 ? ` • ${formatBytes(item.totalBytes)}` : ""}
          </div>
        </If>

        <If condition={item.status === "error"}>
          <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-red-400">
            <AlertCircle className="h-3 w-3 shrink-0" /> {item.error || "Ошибка"}
          </div>
        </If>

        <If condition={item.status === "cancelled"}>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Отменено</div>
        </If>
      </div>

      <div className="shrink-0">
        <If condition={isActive}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 cursor-pointer"
            onClick={() => cancelQueueItem(item.id)}
            title="Отменить"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </If>
        <If condition={item.status === "error" || item.status === "cancelled"}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 cursor-pointer"
            onClick={() => retryQueueItem(item.id)}
            title="Повторить"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </If>
        <If condition={item.status === "pending"}>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        </If>
      </div>
    </div>
  );
}

export function Downloader() {
  const [downloadType, setDownloadType] = useState(pageTypeEnum.OTHER);
  const [downloadQuality, setDownloadQuality] = useState(QualityEnum.LOSSLESS);
  const [isCollecting, setIsCollecting] = useState(false);
  const [downloadFolderPath, setDownloadFolderPath] = useState<string | null>(null);
  const [lastCollectProgress, setLastCollectProgress] = useState("");

  const queue = useQueue();
  const queueStats = getQueueStats();
  const downloadCancelledRef = useRef(false);

  // Load saved download folder path and quality on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedPath = await window.yandexMusicMod.getStorageValue("downloadFolderPath");
        if (savedPath) {
          setDownloadFolderPath(savedPath);
        }

        const savedQuality = await window.yandexMusicMod.getStorageValue("downloadQuality");
        if (savedQuality && Object.values(QualityEnum).includes(savedQuality)) {
          setDownloadQuality(savedQuality);
        }
      } catch (error) {
        console.warn("Failed to load downloader settings:", error);
      }
    };
    loadSettings();
  }, []);

  const saveDownloadPath = async (path: string | null) => {
    try {
      await window.yandexMusicMod.setStorageValue("downloadFolderPath", path);
      setDownloadFolderPath(path);
    } catch (error) {
      console.error("Failed to save download folder path:", error);
      toast.error("Не удалось сохранить путь к папке");
    }
  };

  const handleSelectFolder = async () => {
    try {
      const result = await window.yandexMusicMod.selectDownloadFolder();
      if (result.success && result.path) {
        await saveDownloadPath(result.path);
        toast.success("Папка для загрузки выбрана", {
          description: result.path,
        });
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
      toast.error("Не удалось выбрать папку");
    }
  };

  const handleOpenFolder = async () => {
    if (!downloadFolderPath) {
      toast.warning("Папка не выбрана");
      return;
    }

    try {
      const result = await window.yandexMusicMod.openFolder(downloadFolderPath);
      if (!result.success) {
        toast.error("Не удалось открыть папку", {
          description: result.error || "Неизвестная ошибка",
        });
      }
    } catch (error) {
      console.error("Failed to open folder:", error);
      toast.error("Не удалось открыть папку");
    }
  };

  const pageType = window.location.href.includes("/artist")
    ? pageTypeEnum.ARTIST
    : window.location.href.includes("/playlists")
      ? pageTypeEnum.PLAYLIST
      : window.location.href.includes("/album")
        ? pageTypeEnum.ALBUM
        : pageTypeEnum.OTHER;

  useEffect(() => {
    setDownloadType(pageType);
  }, [pageType]);

  const urlParams = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname;

  // Плейлисты бывают двух видов: /users/{owner}/playlists/{kind} и /playlists/{uuid}
  const playlistOwnerKindMatch = pathname.match(/\/users\/([^\/\?#]+)\/playlists\/([^\/\?#]+)/);
  const playlistUuidOrKindMatch = pathname.match(/\/playlists\/([^\/\?#]+)/);

  const playlistId =
    playlistOwnerKindMatch?.[2] || playlistUuidOrKindMatch?.[1] || urlParams.get("playlistUuid") || null;
  const playlistOwner = playlistOwnerKindMatch?.[1] || null;

  const collectionId =
    pageType === pageTypeEnum.ARTIST
      ? (pathname.match(/\/artist\/([^\/\?#]+)/)?.[1] || urlParams.get("artistId"))
      : pageType === pageTypeEnum.ALBUM
        ? (pathname.match(/\/album\/([^\/\?#]+)/)?.[1] || urlParams.get("albumId"))
        : pageType === pageTypeEnum.PLAYLIST
          ? playlistId
          : null;

  // Собрать список треков текущей страницы и поставить в очередь
  async function collectAndEnqueue() {
    if (isCollecting) {
      downloadCancelledRef.current = true;
      setIsCollecting(false);
      setLastCollectProgress("");
      return;
    }

    downloadCancelledRef.current = false;
    setIsCollecting(true);

    try {
      let trackIds: string[] = [];

      switch (downloadType) {
        case pageTypeEnum.OTHER: {
          const trackId = getCurrentNumericTrackId();
          if (!trackId) {
            toast.warning("Нет играющего трека для скачивания");
            return;
          }
          trackIds = [trackId];
          break;
        }

        case pageTypeEnum.ALBUM:
          if (!collectionId) return toast.warning("Не удалось определить альбом");
          {
            const trackIdsResult = await getAlbumTracks(collectionId);
            if (trackIdsResult.isErr()) {
              toast.error("Произошла ошибка", { description: trackIdsResult.error });
              return;
            }
            trackIds = trackIdsResult.value;
          }
          break;

        case pageTypeEnum.ARTIST:
          if (!collectionId) return toast.warning("Не удалось определить артиста");
          {
            const trackIdsResult = await getArtistTracks(collectionId);
            if (trackIdsResult.isErr()) {
              toast.error("Произошла ошибка", { description: trackIdsResult.error });
              return;
            }
            trackIds = trackIdsResult.value;
          }
          break;

        case pageTypeEnum.PLAYLIST:
          if (!collectionId) return toast.warning("Не удалось определить плейлист");
          {
            const trackIdsResult = await getPlaylistTracks(collectionId, playlistOwner);
            if (trackIdsResult.isErr()) {
              toast.error("Произошла ошибка", { description: trackIdsResult.error });
              return;
            }
            trackIds = trackIdsResult.value;
          }
          break;
      }

      // Получаем метаданные чанками, чтобы в очереди были обложки и названия
      const tracks: any[] = [];
      const chunkSize = 50;

      for (let i = 0; i < trackIds.length; i += chunkSize) {
        if (downloadCancelledRef.current) return;
        setLastCollectProgress(`Получение информации о треках ${i + 1} / ${trackIds.length}`);

        const chunk = trackIds.slice(i, i + chunkSize);
        const info = await getTracksInfo(chunk, true);

        if (info.isErr()) {
          console.error("[Downloader] get tracks info", info.error);
          toast.error("Произошла ошибка при получении информации о треках", { description: info.error });
          return;
        }

        tracks.push(...info.value);

        if (i + chunkSize < trackIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      if (downloadCancelledRef.current) return;

      if (!tracks.length) {
        toast.warning("Нет треков для скачивания");
        return;
      }

      const { added, duplicates } = enqueueTracks(tracks, downloadQuality, downloadFolderPath || "");
      if (added > 0) {
        toast.success("Очередь загрузки", {
          description:
            added === 1
              ? "Трек добавлен в очередь"
              : `Добавлено треков: ${added} (${CONCURRENT_DOWNLOADS} параллельно)`,
        });
      } else if (duplicates > 0) {
        toast.info("Очередь загрузки", { description: "Эти треки уже в очереди" });
      } else {
        toast.warning("Нет треков, доступных для скачивания");
      }
    } catch (error) {
      console.error("[Downloader] unexpected error while collecting tracks", error);
      toast.error("Произошла непредвиденная ошибка", { description: String(error) });
    } finally {
      setIsCollecting(false);
      setLastCollectProgress("");
    }
  }

  const changeDownloadQuality = (value: QualityEnum) => {
    setDownloadQuality(value);
    window.yandexMusicMod.setStorageValue("downloadQuality", value);
  };

  return (
    <ExpandableCard title="Скачивание музыки" icon={<Download className="h-4 w-4" />} opened={false}>
      <div className="flex flex-col gap-5 pt-2 px-3">
        <div className="flex gap-4 items-center justify-center">
          <span className="text-sm text-foreground">Скачать</span>
          <Select value={downloadType.toString()} onValueChange={(value) => setDownloadType(parseInt(value, 10))}>
            <SelectTrigger className="text-foreground w-full">
              <SelectValue className="text-foreground" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={pageTypeEnum.OTHER.toString()}>Текущий трек</SelectItem>

              <If condition={pageType === pageTypeEnum.ALBUM}>
                <SelectItem value={pageTypeEnum.ALBUM.toString()}>Весь альбом</SelectItem>
              </If>
              <If condition={pageType === pageTypeEnum.PLAYLIST}>
                <SelectItem value={pageTypeEnum.PLAYLIST.toString()}>Весь плейлист</SelectItem>
              </If>
              <If condition={pageType === pageTypeEnum.ARTIST}>
                <SelectItem value={pageTypeEnum.ARTIST.toString()}>Все треки артиста</SelectItem>
              </If>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-4 items-center justify-center">
          <span className="text-sm text-foreground">Качество</span>
          <Select value={downloadQuality} onValueChange={(value) => changeDownloadQuality(value as QualityEnum)}>
            <SelectTrigger className="text-foreground w-full">
              <SelectValue className="text-foreground" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(QualityEnum).map((quality) => (
                <SelectItem key={quality} value={quality}>
                  {qualityLabels[quality]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3">
          <Input
            type="text"
            value={downloadFolderPath || "Папка не выбрана"}
            readOnly
            className="flex-1 text-sm cursor-default w-full"
            placeholder="Выберите папку для загрузки"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="p-2 h-9 w-9"
                onClick={handleSelectFolder}
                disabled={isCollecting}
              >
                <Folder className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Выбрать папку</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="p-2 h-9 w-9"
                onClick={handleOpenFolder}
                disabled={!downloadFolderPath}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Открыть папку</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Button variant="default" className="w-auto" disabled={isCollecting} onClick={collectAndEnqueue}>
          {isCollecting ? lastCollectProgress || "Сбор треков…" : "В очередь загрузки"}
        </Button>

        {/* Очередь загрузок */}
        <If condition={queue.length > 0}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Очередь · {queueStats.active}/{CONCURRENT_DOWNLOADS} активно
              </span>
              <If condition={queueStats.completed + queueStats.failed > 0 && queueStats.pending + queueStats.active === 0}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={clearFinishedFromQueue}
                >
                  Очистить
                </Button>
              </If>
            </div>

            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
              {queue.map((item) => (
                <QueueRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        </If>

        <Alert variant="default" className="cursor-default">
          <Info />
          <div className="text-sm text-muted-foreground">
            Для загрузки всех треков артиста, плейлиста или альбома - откройте соответствующую страницу
          </div>
        </Alert>
      </div>
    </ExpandableCard>
  );
}

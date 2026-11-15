import { useEffect, useRef, useState } from "react";

import { getTrackMeta } from "~/mod/features/utils/player";
import { createPortal } from "react-dom";

import { Switch } from "@ui/components/ui/switch";
import { Label } from "@ui/components/ui/label";
import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { MonitorPlay } from "lucide-react";

const OSD_STORAGE_KEY = "osd/enabled";
const OSD_VISIBLE_MS = 2200;
const POLL_INTERVAL_MS = 600;

interface OsdTrack {
  id: string;
  title: string;
  artistsText: string;
  coverUrl: string | null;
}

function buildCoverUrl(coverUri?: string): string | null {
  if (!coverUri) return null;
  return `https://${coverUri.replaceAll("%%", "400x400")}`;
}

function resolveOsdTrack(): OsdTrack | null {
  const metaResult = getTrackMeta();
  if (metaResult.isErr()) return null;
  const meta = metaResult.value;

  if (!meta?.id || !meta?.title) return null;

  return {
    id: String(meta.id),
    title: meta.title,
    artistsText: (meta.artists || []).map((a: any) => a.name).filter(Boolean).join(", "),
    coverUrl: buildCoverUrl(meta.coverUri),
  };
}

export function OsdOverlay() {
  const [enabled, setEnabled] = useState(true);
  const [track, setTrack] = useState<OsdTrack | null>(null);
  const [visible, setVisible] = useState(false);
  const lastTrackIdRef = useRef<string | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstPollRef = useRef(true);

  useEffect(() => {
    (async () => {
      const stored = await window.yandexMusicMod.getStorageValue(OSD_STORAGE_KEY);
      setEnabled(stored !== false);
    })();

    window.yandexMusicMod.onStorageChanged((key: string, value: any) => {
      if (key === OSD_STORAGE_KEY) setEnabled(value !== false);
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      lastTrackIdRef.current = null;
      return;
    }

    const interval = setInterval(() => {
      const current = resolveOsdTrack();
      if (!current) return;

      const previousId = lastTrackIdRef.current;
      lastTrackIdRef.current = current.id;

      // первый опрос: показывать не надо
      if (firstPollRef.current) {
        firstPollRef.current = false;
        return;
      }

      if (previousId && previousId !== current.id) {
        setTrack(current);
        setVisible(true);

        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setVisible(false), OSD_VISIBLE_MS);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [enabled]);

  if (!enabled || !track) return null;

  return createPortal(
    <div
      className={`fixed bottom-6 left-1/2 z-[999998] -translate-x-1/2 transition-all duration-300 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      }`}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-950/85 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {track.coverUrl ? (
          <img
            src={track.coverUrl}
            alt=""
            className="h-11 w-11 rounded-lg object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="h-11 w-11 rounded-lg bg-white/5" />
        )}
        <div className="flex max-w-[320px] flex-col overflow-hidden">
          <span className="truncate text-sm font-semibold text-foreground">{track.title}</span>
          <span className="truncate text-xs text-muted-foreground">{track.artistsText || " "}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function OsdSettingsCard() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await window.yandexMusicMod.getStorageValue(OSD_STORAGE_KEY);
      setEnabled(stored !== false);
    })();
  }, []);

  return (
    <ExpandableCard title="OSD при смене трека" icon={<MonitorPlay className="h-4 w-4" />}>
      <div className="flex flex-col gap-4 pt-2 px-3">
        <div className="flex items-center gap-3">
          <Switch
            id="osd-toggle"
            checked={enabled}
            onCheckedChange={(value) => {
              setEnabled(value);
              window.yandexMusicMod.setStorageValue(OSD_STORAGE_KEY, value);
            }}
          />
          <Label htmlFor="osd-toggle" className="cursor-pointer">
            Показывать всплывающий оверлей с треком при переключении
          </Label>
        </div>
      </div>
    </ExpandableCard>
  );
}

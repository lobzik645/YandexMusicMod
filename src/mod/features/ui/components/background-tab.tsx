import React, { useEffect, useState } from "react";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { Input } from "@ui/components/ui/input";
import { Button } from "@ui/components/ui/button";
import {
  Film,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Sliders,
  Image as ImageIcon,
  Video as VideoIcon,
  Layers,
  FolderOpen,
  X,
  ExternalLink,
} from "lucide-react";

interface SavedBackground {
  id: string;
  name: string;
  path: string;
  isVideo: boolean;
}

const DEFAULT_PRESETS: SavedBackground[] = [
  {
    id: "preset-cyberpunk",
    name: "Cyberpunk City",
    path: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    isVideo: false,
  },
  {
    id: "preset-purple-nebula",
    name: "Purple Nebula",
    path: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80",
    isVideo: false,
  },
  {
    id: "preset-anime-lofi",
    name: "Anime Lofi Night",
    path: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80",
    isVideo: false,
  },
  {
    id: "preset-minimal-waves",
    name: "Deep Minimalist Waves",
    path: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
    isVideo: false,
  },
  {
    id: "preset-retrowave-neon",
    name: "Neon Retrowave",
    path: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&q=80",
    isVideo: false,
  },
  {
    id: "preset-dark-mountains",
    name: "Dark Mountain Night",
    path: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80",
    isVideo: false,
  },
];

function BackgroundThumbnail({
  item,
  port,
  className,
}: {
  item: SavedBackground;
  port: number | null;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    setIsError(false);

    if (!item.path) return;

    if (item.path.startsWith("http://") || item.path.startsWith("https://")) {
      setDataUrl(item.path);
    } else {
      if (port) {
        setDataUrl(`http://127.0.0.1:${port}/media?file=${encodeURIComponent(item.path)}`);
      } else {
        window.yandexMusicMod
          .readFileAsDataUrl(item.path)
          .then((res) => {
            if (!isCancelled && res?.success && res.dataUrl) {
              setDataUrl(res.dataUrl);
            } else if (!isCancelled) {
              setIsError(true);
            }
          })
          .catch(() => {
            if (!isCancelled) setIsError(true);
          });
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [item.path, port]);

  if (isError || !dataUrl) {
    return (
      <div className={`flex items-center justify-center bg-white/5 text-purple-300 ${className || "w-full h-full"}`}>
        {item.isVideo ? <VideoIcon className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
      </div>
    );
  }

  if (item.isVideo) {
    return (
      <div className={`relative overflow-hidden bg-black/50 ${className || "w-full h-full"}`}>
        <video
          src={dataUrl}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
          onError={() => setIsError(true)}
        />
        <div className="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none">
          <VideoIcon className="h-3.5 w-3.5 text-white/90 drop-shadow" />
        </div>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={item.name}
      className={`w-full h-full object-cover ${className || ""}`}
      loading="lazy"
      onError={() => setIsError(true)}
    />
  );
}

export function BackgroundTab() {
  const [enabled, setEnabled] = useState(false);
  const [currentPath, setCurrentPath] = useState("");
  const [savedList, setSavedList] = useState<SavedBackground[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [mediaPort, setMediaPort] = useState<number | null>(null);

  // Display settings
  const [opacity, setOpacity] = useState(100);
  const [blur, setBlur] = useState(0);
  const [fitMode, setFitMode] = useState("cover");
  const [transparentSidebar, setTransparentSidebar] = useState(true);
  const [hideTrackGlow, setHideTrackGlow] = useState(true);
  const [hideVibeGlow, setHideVibeGlow] = useState(true);
  const [centerVibePlayer, setCenterVibePlayer] = useState(false);

  useEffect(() => {
    window.yandexMusicMod
      .getMediaServerPort()
      .then(setMediaPort)
      .catch(() => {});

    (async () => {
      const isEnabled = (await window.yandexMusicMod.getStorageValue("custom-background/enabled")) === true;
      const path = (await window.yandexMusicMod.getStorageValue("custom-background/path")) || "";
      const storedList = await window.yandexMusicMod.getStorageValue("custom-background/savedList");

      const op = Number((await window.yandexMusicMod.getStorageValue("custom-background/opacity")) ?? 100);
      const bl = Number((await window.yandexMusicMod.getStorageValue("custom-background/blur")) ?? 0);
      const fit = (await window.yandexMusicMod.getStorageValue("custom-background/fitMode")) || "cover";
      const sidebar = (await window.yandexMusicMod.getStorageValue("custom-background/transparentSidebar")) !== false;
      const tGlow = (await window.yandexMusicMod.getStorageValue("custom-background/hideTrackGlow")) !== false;
      const vGlow = (await window.yandexMusicMod.getStorageValue("custom-background/hideVibeGlow")) !== false;
      const cVibe = (await window.yandexMusicMod.getStorageValue("custom-themes/centerVibePlayer")) === true;

      setEnabled(isEnabled);
      setCurrentPath(path);

      setOpacity(op);
      setBlur(bl);
      setFitMode(fit.toString());
      setTransparentSidebar(sidebar);
      setHideTrackGlow(tGlow);
      setHideVibeGlow(vGlow);
      setCenterVibePlayer(cVibe);

      if (Array.isArray(storedList) && storedList.length > 0) {
        setSavedList(storedList);
      } else {
        const initial = [...DEFAULT_PRESETS];
        if (path && !initial.some((p) => p.path === path)) {
          const fileName = path.split(/[\\/]/).pop() || "Мой фон";
          initial.unshift({
            id: `saved-${Date.now()}`,
            name: fileName,
            path: path,
            isVideo: /\.(mp4|webm|mkv|mov)$/i.test(path),
          });
        }
        setSavedList(initial);
        window.yandexMusicMod.setStorageValue("custom-background/savedList", initial);
      }
    })();
  }, []);

  const saveList = (newList: SavedBackground[]) => {
    setSavedList(newList);
    window.yandexMusicMod.setStorageValue("custom-background/savedList", newList);
  };

  const handleSelectBackground = (item: SavedBackground) => {
    setCurrentPath(item.path);
    window.yandexMusicMod.setStorageValue("custom-background/path", item.path);
    if (!enabled) {
      setEnabled(true);
      window.yandexMusicMod.setStorageValue("custom-background/enabled", true);
    }
  };

  const handleDeleteBackground = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const itemToDelete = savedList.find((i) => i.id === id);
    const filtered = savedList.filter((item) => item.id !== id);
    saveList(filtered);
    if (currentPath === itemToDelete?.path) {
      if (filtered.length > 0) {
        handleSelectBackground(filtered[0]);
      } else {
        setCurrentPath("");
        setEnabled(false);
        window.yandexMusicMod.setStorageValue("custom-background/path", "");
        window.yandexMusicMod.setStorageValue("custom-background/enabled", false);
      }
    }
  };

  const handleAddFile = async () => {
    try {
      const res = await window.yandexMusicMod.selectBackgroundFile();
      if (res && res.success && res.path) {
        const path = res.path;
        const fileName = path.split(/[\\/]/).pop() || "Пользовательский файл";
        const isVid = /\.(mp4|webm|mkv|mov)$/i.test(path);
        const newItem: SavedBackground = {
          id: `file-${Date.now()}`,
          name: fileName,
          path: path,
          isVideo: isVid,
        };
        const newList = [newItem, ...savedList.filter((item) => item.path !== path)];
        saveList(newList);
        handleSelectBackground(newItem);
      }
    } catch (err) {
      console.error("[BackgroundTab] Error adding file:", err);
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    const trimmed = urlInput.trim();
    const fileName = trimmed.split("/").pop()?.split("?")[0] || "URL Фон";
    const isVid = /\.(mp4|webm|mkv|mov)$/i.test(trimmed);
    const newItem: SavedBackground = {
      id: `url-${Date.now()}`,
      name: fileName,
      path: trimmed,
      isVideo: isVid,
    };
    const newList = [newItem, ...savedList.filter((item) => item.path !== trimmed)];
    saveList(newList);
    handleSelectBackground(newItem);
    setUrlInput("");
    setShowUrlInput(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Banner / Master Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="flex flex-col gap-1">
          <Label htmlFor="bg-master-toggle" className="cursor-pointer font-semibold text-sm flex items-center gap-2 text-foreground">
            <Film className="h-4 w-4 text-purple-400" />
            Кастомный фон (Видео или Картинка)
          </Label>
          <span className="text-xs text-muted-foreground">
            Установить анимированное видео (MP4/WebM) или изображение на весь плеер
          </span>
        </div>
        <Switch
          id="bg-master-toggle"
          checked={enabled}
          onCheckedChange={(val) => {
            setEnabled(val);
            window.yandexMusicMod.setStorageValue("custom-background/enabled", val);
          }}
        />
      </div>

      {/* Active Background Preview Card */}
      {enabled && currentPath && (
        <div className="relative overflow-hidden rounded-xl border border-purple-500/40 bg-purple-950/25 p-4 shadow-[0_0_25px_rgba(168,85,247,0.12)]">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-purple-400/50 bg-black/60 shadow-md">
              <BackgroundThumbnail
                item={{
                  id: "active",
                  name: "Текущий фон",
                  path: currentPath,
                  isVideo: /\.(mp4|webm|mkv|mov)$/i.test(currentPath),
                }}
                port={mediaPort}
                className="h-full w-full"
              />
              <div className="absolute top-1 left-1 rounded bg-purple-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                Активен сейчас
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="truncate text-sm font-bold text-foreground">
                  {savedList.find((i) => i.path === currentPath)?.name || currentPath.split(/[\\/]/).pop()}
                </span>
              </div>
              <span className="truncate text-xs text-muted-foreground">{currentPath}</span>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-purple-500/30 hover:bg-purple-500/20 text-purple-200"
                  onClick={() => {
                    setEnabled(false);
                    window.yandexMusicMod.setStorageValue("custom-background/enabled", false);
                  }}
                >
                  Отключить фон
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Background Library / Gallery */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-400" />
            <span className="font-semibold text-sm text-foreground">Список фонов (Галерея с превью)</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs font-medium cursor-pointer"
              onClick={handleAddFile}
            >
              <FolderOpen className="h-3.5 w-3.5 text-purple-300" />
              Добавить файл
            </Button>
            <Button
              variant={showUrlInput ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5 h-8 text-xs font-medium cursor-pointer"
              onClick={() => setShowUrlInput(!showUrlInput)}
            >
              <Plus className="h-3.5 w-3.5 text-purple-300" />
              По ссылке
            </Button>
          </div>
        </div>

        {/* URL Input dropdown */}
        {showUrlInput && (
          <div className="flex items-center gap-2 p-2 rounded-lg border border-white/10 bg-white/[0.03]">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Вставьте прямую ссылку на картинку или mp4..."
              className="h-8 text-xs flex-1"
            />
            <Button size="sm" className="h-8 px-3 text-xs" onClick={handleAddUrl}>
              Добавить
            </Button>
          </div>
        )}

        {/* Saved List Grid with Visual Thumbnails */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {savedList.map((item) => {
            const isActive = enabled && currentPath === item.path;
            return (
              <div
                key={item.id}
                onClick={() => handleSelectBackground(item)}
                className={`group relative flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                  isActive
                    ? "bg-purple-950/40 border-purple-500/70 shadow-[0_0_18px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/40"
                    : "bg-white/[0.02] border-white/8 hover:border-white/20 hover:bg-white/[0.05]"
                }`}
              >
                {/* Visual Image / Video Thumbnail */}
                <div
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-md border bg-black/50 ${
                    isActive ? "border-purple-400/70 shadow-sm" : "border-white/10"
                  }`}
                >
                  <BackgroundThumbnail item={item} port={mediaPort} className="h-full w-full" />
                  {isActive && (
                    <div className="absolute top-1 right-1 rounded-full bg-purple-500 p-0.5 shadow">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                    {isActive && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-500 text-white shrink-0">
                        Активен
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {item.isVideo ? "Видео фон" : "Изображение"}
                  </span>
                </div>

                {/* Delete button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-md transition-opacity"
                  title="Удалить из списка"
                  onClick={(e) => handleDeleteBackground(item.id, e)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visual Adjustments (Opacity, Blur, Mode, Toggles) */}
      <div className="flex flex-col gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-purple-400" />
          <span className="font-semibold text-sm text-foreground">Параметры отображения</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Opacity */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Прозрачность фона</span>
              <span className="font-bold text-foreground">{opacity}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={opacity}
              onChange={(e) => {
                const val = Number(e.target.value);
                setOpacity(val);
                window.yandexMusicMod.setStorageValue("custom-background/opacity", val);
              }}
              className="w-full accent-purple-500 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
            />
          </div>

          {/* Blur */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Размытие (Blur)</span>
              <span className="font-bold text-foreground">{blur}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={blur}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBlur(val);
                window.yandexMusicMod.setStorageValue("custom-background/blur", val);
              }}
              className="w-full accent-purple-500 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
            />
          </div>
        </div>

        {/* Fit mode */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Режим масштабирования</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "cover", label: "Заполнение (Cover)" },
              { id: "contain", label: "Вписать (Contain)" },
            ].map((f) => (
              <Button
                key={f.id}
                variant={fitMode === f.id ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs px-2 justify-center"
                onClick={() => {
                  setFitMode(f.id);
                  window.yandexMusicMod.setStorageValue("custom-background/fitMode", f.id);
                }}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Switches */}
        <div className="flex flex-col gap-2.5 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <Label htmlFor="bg-sidebar-toggle" className="cursor-pointer text-xs font-medium text-foreground">
              Полупрозрачный акрил для боковой панели
            </Label>
            <Switch
              id="bg-sidebar-toggle"
              checked={transparentSidebar}
              onCheckedChange={(val) => {
                setTransparentSidebar(val);
                window.yandexMusicMod.setStorageValue("custom-background/transparentSidebar", val);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="bg-trackglow-toggle" className="cursor-pointer text-xs font-medium text-foreground">
              Скрыть фоновое свечение трека
            </Label>
            <Switch
              id="bg-trackglow-toggle"
              checked={hideTrackGlow}
              onCheckedChange={(val) => {
                setHideTrackGlow(val);
                window.yandexMusicMod.setStorageValue("custom-background/hideTrackGlow", val);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="bg-vibeglow-toggle" className="cursor-pointer text-xs font-medium text-foreground">
              Скрыть анимацию волны (Canvas)
            </Label>
            <Switch
              id="bg-vibeglow-toggle"
              checked={hideVibeGlow}
              onCheckedChange={(val) => {
                setHideVibeGlow(val);
                window.yandexMusicMod.setStorageValue("custom-background/hideVibeGlow", val);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="bg-centervibe-toggle" className="cursor-pointer text-xs font-medium text-foreground">
              Скрыть станции (Моя Волна по центру)
            </Label>
            <Switch
              id="bg-centervibe-toggle"
              checked={centerVibePlayer}
              onCheckedChange={(val) => {
                setCenterVibePlayer(val);
                window.yandexMusicMod.setStorageValue("custom-themes/centerVibePlayer", val);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

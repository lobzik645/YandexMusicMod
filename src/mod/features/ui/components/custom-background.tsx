import { useEffect, useState } from "react";
import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { Input } from "@ui/components/ui/input";
import { Button } from "@ui/components/ui/button";
import { Slider } from "@ui/components/ui/slider";
import { If } from "@ui/components/ui/if";
import { Film, FolderOpen, Trash2, EyeOff, Sparkles, Layout, Maximize2 } from "lucide-react";

export function CustomBackground() {
  const [enabled, setEnabled] = useState(false);
  const [backgroundPath, setBackgroundPath] = useState("");
  const [hideTrackGlow, setHideTrackGlow] = useState(true);
  const [hideVibeGlow, setHideVibeGlow] = useState(true);
  const [transparentSidebar, setTransparentSidebar] = useState(true);
  const [fitMode, setFitMode] = useState("cover");
  const [opacity, setOpacity] = useState(100);
  const [blur, setBlur] = useState(0);

  useEffect(() => {
    (async () => {
      const isEnabled = (await window.yandexMusicMod.getStorageValue("custom-background/enabled")) === true;
      const path = (await window.yandexMusicMod.getStorageValue("custom-background/path")) || "";
      const trackGlow = (await window.yandexMusicMod.getStorageValue("custom-background/hideTrackGlow")) !== false;
      const vibeGlow = (await window.yandexMusicMod.getStorageValue("custom-background/hideVibeGlow")) !== false;
      const sidebar = (await window.yandexMusicMod.getStorageValue("custom-background/transparentSidebar")) !== false;
      const fit = (await window.yandexMusicMod.getStorageValue("custom-background/fitMode")) || "cover";
      const op = Number((await window.yandexMusicMod.getStorageValue("custom-background/opacity")) ?? 100);
      const bl = Number((await window.yandexMusicMod.getStorageValue("custom-background/blur")) ?? 0);

      setEnabled(isEnabled);
      setBackgroundPath(path);
      setHideTrackGlow(trackGlow);
      setHideVibeGlow(vibeGlow);
      setTransparentSidebar(sidebar);
      setFitMode(fit.toString());
      setOpacity(op);
      setBlur(bl);
    })();
  }, []);

  const handleSelectFile = async () => {
    try {
      const res = await window.yandexMusicMod.selectBackgroundFile();
      if (res && res.success && res.path) {
        setBackgroundPath(res.path);
        window.yandexMusicMod.setStorageValue("custom-background/path", res.path);
        if (!enabled) {
          setEnabled(true);
          window.yandexMusicMod.setStorageValue("custom-background/enabled", true);
        }
      }
    } catch (err) {
      console.error("[CustomBackground] Error selecting file:", err);
    }
  };

  const handleClear = () => {
    setBackgroundPath("");
    window.yandexMusicMod.setStorageValue("custom-background/path", "");
  };

  return (
    <ExpandableCard title="Пользовательский фон" icon={<Film className="h-4 w-4" />}>
      <div className="flex flex-col gap-4 pt-2 px-3">
        {/* Toggle Custom Background */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="custom-background-toggle" className="cursor-pointer font-medium text-sm">
              Включить кастомный фон
            </Label>
            <span className="text-xs text-muted-foreground">
              Установить видео (MP4, WebM) или картинку на задний фон
            </span>
          </div>
          <Switch
            id="custom-background-toggle"
            checked={enabled}
            onCheckedChange={(val) => {
              setEnabled(val);
              window.yandexMusicMod.setStorageValue("custom-background/enabled", val);
            }}
          />
        </div>

        <If condition={enabled}>
          <div className="flex flex-col gap-4">
            {/* File selection */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Файл или ссылка на фон</Label>
              <div className="flex gap-2">
                <Input
                  value={backgroundPath}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBackgroundPath(val);
                    window.yandexMusicMod.setStorageValue("custom-background/path", val);
                  }}
                  placeholder="Путь к видео/картинке или URL..."
                  className="text-xs h-9"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0 gap-1.5 h-9 px-3"
                  onClick={handleSelectFile}
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>Обзор</span>
                </Button>
                {backgroundPath && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-9 w-9 text-destructive"
                    onClick={handleClear}
                    title="Очистить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Fit mode selector */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-border/40">
              <div className="flex justify-between items-center text-xs">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Maximize2 className="h-3.5 w-3.5" />
                  Масштаб и качество (Разрешение)
                </Label>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                {[
                  { id: "cover", label: "Cover (По экрану)" },
                  { id: "none", label: "1:1 (Оригинал)" },
                  { id: "contain", label: "Contain (Вписать)" },
                  { id: "fill", label: "Fill (Растянуть)" },
                ].map((mode) => (
                  <Button
                    key={mode.id}
                    variant={fitMode === mode.id ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs px-2.5 justify-center font-normal"
                    onClick={() => {
                      setFitMode(mode.id);
                      window.yandexMusicMod.setStorageValue("custom-background/fitMode", mode.id);
                    }}
                  >
                    {mode.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Hide Track Gradient Glow */}
            <div className="flex items-center justify-between gap-3 py-1 border-t border-border/40">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="hide-track-glow-toggle" className="cursor-pointer font-medium text-sm flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Скрыть цветовой градиент трека
                </Label>
                <span className="text-xs text-muted-foreground">
                  Убрать цветное свечение на весь экран от обложки играющего трека
                </span>
              </div>
              <Switch
                id="hide-track-glow-toggle"
                checked={hideTrackGlow}
                onCheckedChange={(val) => {
                  setHideTrackGlow(val);
                  window.yandexMusicMod.setStorageValue("custom-background/hideTrackGlow", val);
                }}
              />
            </div>

            {/* Hide Vibe Glow (Pink/Yellow fluid blob) */}
            <div className="flex items-center justify-between gap-3 py-1 border-t border-border/40">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="hide-vibe-glow-toggle" className="cursor-pointer font-medium text-sm flex items-center gap-1.5">
                  <EyeOff className="h-3.5 w-3.5" />
                  Скрыть свечение Моей Волны
                </Label>
                <span className="text-xs text-muted-foreground">
                  Убрать розово-жёлтую каплю в центре, чтобы не перекрывать фон
                </span>
              </div>
              <Switch
                id="hide-vibe-glow-toggle"
                checked={hideVibeGlow}
                onCheckedChange={(val) => {
                  setHideVibeGlow(val);
                  window.yandexMusicMod.setStorageValue("custom-background/hideVibeGlow", val);
                }}
              />
            </div>

            {/* Transparent Sidebar */}
            <div className="flex items-center justify-between gap-3 py-1 border-t border-border/40">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="transparent-sidebar-toggle" className="cursor-pointer font-medium text-sm flex items-center gap-1.5">
                  <Layout className="h-3.5 w-3.5" />
                  Прозрачная боковая панель и кнопка мода
                </Label>
                <span className="text-xs text-muted-foreground">
                  Сделать левое меню навигации полностью прозрачным
                </span>
              </div>
              <Switch
                id="transparent-sidebar-toggle"
                checked={transparentSidebar}
                onCheckedChange={(val) => {
                  setTransparentSidebar(val);
                  window.yandexMusicMod.setStorageValue("custom-background/transparentSidebar", val);
                }}
              />
            </div>

            {/* Opacity slider */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
              <div className="flex justify-between items-center text-xs">
                <Label className="text-xs font-medium">Прозрачность фона</Label>
                <span className="text-muted-foreground font-mono">{opacity}%</span>
              </div>
              <Slider
                min={10}
                max={100}
                step={5}
                value={[opacity]}
                onValueChange={(val) => {
                  const num = val[0] ?? 100;
                  setOpacity(num);
                  window.yandexMusicMod.setStorageValue("custom-background/opacity", num);
                }}
              />
            </div>

            {/* Blur slider */}
            <div className="flex flex-col gap-2 pb-1">
              <div className="flex justify-between items-center text-xs">
                <Label className="text-xs font-medium">Размытие фона (Blur)</Label>
                <span className="text-muted-foreground font-mono">{blur} px</span>
              </div>
              <Slider
                min={0}
                max={30}
                step={1}
                value={[blur]}
                onValueChange={(val) => {
                  const num = val[0] ?? 0;
                  setBlur(num);
                  window.yandexMusicMod.setStorageValue("custom-background/blur", num);
                }}
              />
            </div>
          </div>
        </If>
      </div>
    </ExpandableCard>
  );
}

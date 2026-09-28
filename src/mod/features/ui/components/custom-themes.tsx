import { useEffect, useState } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { If } from "@ui/components/ui/if";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ui/components/ui/alert-dialog";

import { Palette } from "lucide-react";

// Predefined accent colors - simple hex array
const ACCENT_COLORS = ["#fed42b", "#4A9EFF", "#34c72c", "#e74343", "#b74bd9", "#f161c4"];

export const MENU_ITEMS = [
  {
    label: "Концерты",
    value: "concerts",
  },
  {
    label: "Подкасты",
    value: "non-music",
  },
  {
    label: "Детям",
    value: "kids",
  },
];

export function CustomThemes() {
  const [forceDarkTheme, setForceDarkTheme] = useState(true);
  const [customColorsEnabled, setCustomColorsEnabled] = useState(false);
  const [selectedAccentColor, setSelectedAccentColor] = useState(ACCENT_COLORS[0]!);
  const [playerColorsReplaceEnabled, setPlayerColorsReplaceEnabled] = useState(false);
  const [disableVibeAnimation, setDisableVibeAnimation] = useState(false);
  const [disableExplicitMark, setDisableExplicitMark] = useState(false);
  const [hideAiFacts, setHideAiFacts] = useState(false);
  const [centerVibePlayer, setCenterVibePlayer] = useState(false);
  const [hiddenMenuItems, setHiddenMenuItems] = useState<Array<string>>([]);
  const [showReloadConfirm, setShowReloadConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      const forceDark = await (window as any).yandexMusicMod.getStorageValue("custom-themes/forceDarkTheme");
      const colorsEnabled = await (window as any).yandexMusicMod.getStorageValue("custom-themes/enabled");
      const accentColor = await (window as any).yandexMusicMod.getStorageValue("custom-themes/accent");
      const playerColorsReplaceEnabled =
        (await (window as any).yandexMusicMod.getStorageValue("custom-themes/playerColorsReplace")) === false
          ? false
          : true;
      const disableVibeAnimation = await (window as any).yandexMusicMod.getStorageValue(
        "custom-themes/disableVibeAnimation",
      );
      const disableExplicitMark =
        (await (window as any).yandexMusicMod.getStorageValue("custom-themes/disableExplicitMark")) === false
          ? false
          : true;
      const aiFacts = (await (window as any).yandexMusicMod.getStorageValue("custom-themes/hideAiFacts")) === true;
      const centerVibe = (await (window as any).yandexMusicMod.getStorageValue("custom-themes/centerVibePlayer")) === true;
      const hiddenMenuItems = await (window as any).yandexMusicMod.getStorageValue("custom-themes/hideMenuItems");

      setForceDarkTheme(forceDark !== false);
      setCustomColorsEnabled(colorsEnabled || false);
      setSelectedAccentColor(accentColor || ACCENT_COLORS[0]!);
      setPlayerColorsReplaceEnabled(playerColorsReplaceEnabled);
      setDisableVibeAnimation(disableVibeAnimation);
      setDisableExplicitMark(disableExplicitMark);
      setHideAiFacts(aiFacts);
      setCenterVibePlayer(centerVibe);
      setHiddenMenuItems(hiddenMenuItems || []);
    })();
  }, []);

  return (
    <ExpandableCard title="Интерфейс и тема" icon={<Palette className="h-4 w-4" />}>
      <div className="flex flex-col gap-4 pt-2 px-3">
        {/* Force Dark Theme Section */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="force-dark-theme-toggle" className="cursor-pointer font-medium text-sm">
              Только тёмная тема
            </Label>
            <span className="text-xs text-muted-foreground">
              Запретить белую тему при светлой теме в системе
            </span>
          </div>
          <Switch
            id="force-dark-theme-toggle"
            checked={forceDarkTheme}
            onCheckedChange={(value) => {
              setForceDarkTheme(value);
              (window as any).yandexMusicMod.setStorageValue("custom-themes/forceDarkTheme", value);
            }}
          />
        </div>

        {/* Hide AI Facts Section */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="hide-ai-facts-toggle" className="cursor-pointer font-medium text-sm">
              Скрыть факты нейросети (AI)
            </Label>
            <span className="text-xs text-muted-foreground">
              Убрать карточки с текстом от AI под обложкой трека и артиста
            </span>
          </div>
          <Switch
            id="hide-ai-facts-toggle"
            checked={hideAiFacts}
            onCheckedChange={(value) => {
              setHideAiFacts(value);
              (window as any).yandexMusicMod.setStorageValue("custom-themes/hideAiFacts", value);
            }}
          />
        </div>

        {/* Center Vibe Player Section (Hide Stations Wheel) */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="center-vibe-player-toggle" className="cursor-pointer font-medium text-sm">
              Скрыть станции (Моя Волна по центру)
            </Label>
            <span className="text-xs text-muted-foreground">
              Полностью убрать колесо станций и выровнять плеер Моей Волны ровно по середине
            </span>
          </div>
          <Switch
            id="center-vibe-player-toggle"
            checked={centerVibePlayer}
            onCheckedChange={(value) => {
              setCenterVibePlayer(value);
              (window as any).yandexMusicMod.setStorageValue("custom-themes/centerVibePlayer", value);
            }}
          />
        </div>

        {/* Custom Colors Section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Switch
              id="custom-colors-toggle"
              checked={customColorsEnabled}
              onCheckedChange={(value) => {
                if (!value) {
                  setShowReloadConfirm(true);
                } else {
                  setCustomColorsEnabled(value);
                  (window as any).yandexMusicMod.setStorageValue("custom-themes/enabled", value);
                }
              }}
            />
            <Label htmlFor="custom-colors-toggle" className="cursor-pointer">
              Собственная тема
            </Label>

            <AlertDialog open={showReloadConfirm} onOpenChange={setShowReloadConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Требуется перезагрузка</AlertDialogTitle>
                  <AlertDialogDescription>
                    Для отключения собственной темы требуется перезагрузка приложения
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction
                    className="text-foreground"
                    onClick={() => {
                      setCustomColorsEnabled(false);
                      (window as any).yandexMusicMod.setStorageValue("custom-themes/enabled", false);
                      setTimeout(() => {
                        location.reload();
                      }, 500);
                    }}
                  >
                    Ок
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <If condition={customColorsEnabled}>
            <div className="grid grid-cols-6 gap-2">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 cursor-pointer ${
                    selectedAccentColor === color
                      ? "border-foreground shadow-md"
                      : "border-transparent hover:border-muted-foreground/50"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setSelectedAccentColor(color);
                    (window as any).yandexMusicMod.setStorageValue("custom-themes/accent", color);
                  }}
                  title={color}
                />
              ))}
              <div
                className={`relative flex items-center justify-center w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 overflow-hidden cursor-pointer ${
                  !ACCENT_COLORS.includes(selectedAccentColor)
                    ? "border-foreground shadow-md"
                    : "border-transparent hover:border-muted-foreground/50"
                }`}
                title="Выбрать свой цвет"
              >
                <Palette className="absolute pointer-events-none w-4 h-4 text-white mix-blend-difference z-10" />
                <input
                  type="color"
                  value={selectedAccentColor}
                  onChange={(e) => {
                    const color = e.target.value;
                    setSelectedAccentColor(color);
                    (window as any).yandexMusicMod.setStorageValue("custom-themes/accent", color);
                  }}
                  className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="player-colors-toggle"
                checked={playerColorsReplaceEnabled}
                onCheckedChange={(value) => {
                  setPlayerColorsReplaceEnabled(value);
                  (window as any).yandexMusicMod.setStorageValue("custom-themes/playerColorsReplace", value);
                }}
              />
              <Label htmlFor="player-colors-toggle" className="cursor-pointer">
                Заменить цвета в плеере
              </Label>
            </div>
          </If>

          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/40">
            <Switch
              id="disable-vibe-animation-toggle"
              checked={disableVibeAnimation}
              onCheckedChange={(value) => {
                setDisableVibeAnimation(value);
                (window as any).yandexMusicMod.setStorageValue("custom-themes/disableVibeAnimation", value);
              }}
            />
            <Label htmlFor="disable-vibe-animation-toggle" className="cursor-pointer">
              Отключить анимацию "Моей Волны"
            </Label>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="disable-explicit-mark-toggle"
              checked={disableExplicitMark}
              onCheckedChange={(value) => {
                setDisableExplicitMark(value);
                (window as any).yandexMusicMod.setStorageValue("custom-themes/disableExplicitMark", value);
              }}
            />
            <Label htmlFor="disable-explicit-mark-toggle" className="cursor-pointer">
              Убрать уведомление 18+
            </Label>
          </div>

          {MENU_ITEMS.map((item) => (
            <div className="flex items-center gap-3" key={item.value}>
              <Switch
                id={`hide-menu-item-${item.value}-toggle`}
                checked={hiddenMenuItems.includes(item.value)}
                onCheckedChange={(value) => {
                  setHiddenMenuItems((prev) => {
                    const filtered = prev.filter((menuItem) => menuItem !== item.value);
                    const newHiddenMenuItems = value ? [...filtered, item.value] : filtered;
                    (window as any).yandexMusicMod.setStorageValue("custom-themes/hideMenuItems", newHiddenMenuItems);
                    return newHiddenMenuItems;
                  });
                }}
              />
              <Label htmlFor={`hide-menu-item-${item.value}-toggle`} className="cursor-pointer">
                Скрыть раздел "{item.label}"
              </Label>
            </div>
          ))}
        </div>
      </div>
    </ExpandableCard>
  );
}

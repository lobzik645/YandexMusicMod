import React, { useState, useEffect } from "react";
import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { Sliders, Wand2 } from "lucide-react";

export function UiCustomization() {
  const [blurEnabled, setBlurEnabled] = useState(true);
  const [blurIntensity, setBlurIntensity] = useState(24);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const bEn = (await window.yandexMusicMod.getStorageValue("ui/blurEnabled")) !== false;
      const bInt = Number((await window.yandexMusicMod.getStorageValue("ui/blurIntensity")) ?? 24);
      const aEn = (await window.yandexMusicMod.getStorageValue("ui/animationsEnabled")) !== false;
      setBlurEnabled(bEn);
      setBlurIntensity(bInt);
      setAnimationsEnabled(aEn);
    })();
  }, []);

  return (
    <ExpandableCard
      title="Эффекты интерфейса и анимации"
      icon={<Wand2 className="h-4 w-4 text-purple-400" />}
      opened={false}
    >
      <div className="flex flex-col gap-4 pt-1 px-1">
        {/* Blur toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="ui-blur-toggle" className="cursor-pointer font-medium text-xs text-foreground">
              Размытие фона (Acrylic / Backdrop Blur)
            </Label>
            <span className="text-[11px] text-muted-foreground">
              Красивый полупрозрачный блюр для окна настроек и элементов интерфейса
            </span>
          </div>
          <Switch
            id="ui-blur-toggle"
            checked={blurEnabled}
            onCheckedChange={(val) => {
              setBlurEnabled(val);
              window.yandexMusicMod.setStorageValue("ui/blurEnabled", val);
            }}
          />
        </div>

        {blurEnabled && (
          <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Sliders className="h-3 w-3 text-purple-400" />
                Интенсивность размытия
              </span>
              <span className="font-bold text-foreground">{blurIntensity}px</span>
            </div>
            <input
              type="range"
              min="4"
              max="40"
              step="2"
              value={blurIntensity}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBlurIntensity(val);
                window.yandexMusicMod.setStorageValue("ui/blurIntensity", val);
              }}
              className="w-full accent-purple-500 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
            />
          </div>
        )}

        {/* Animations toggle */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="ui-anim-toggle" className="cursor-pointer font-medium text-xs text-foreground">
              Плавные анимации интерфейса
            </Label>
            <span className="text-[11px] text-muted-foreground">
              Плавные переходы при смене вкладок, наведении и открытии списков
            </span>
          </div>
          <Switch
            id="ui-anim-toggle"
            checked={animationsEnabled}
            onCheckedChange={(val) => {
              setAnimationsEnabled(val);
              window.yandexMusicMod.setStorageValue("ui/animationsEnabled", val);
            }}
          />
        </div>
      </div>
    </ExpandableCard>
  );
}

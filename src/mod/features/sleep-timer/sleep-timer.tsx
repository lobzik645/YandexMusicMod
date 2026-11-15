import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
import { Timer, Moon } from "lucide-react";

const PRESET_MINUTES = [15, 30, 60];

interface SleepTimerState {
  /** timestamp окончания таймера, null = выключен */
  endsAt: number | null;
  paused: boolean;
}

let state: SleepTimerState = { endsAt: null, paused: false };
let timeoutId: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

// Надёжная пауза: сначала жмём кнопку паузы плеера напрямую, потом фолбэк на диспетчер
function pausePlayback() {
  const pauseBtn = document.querySelector<HTMLButtonElement>(
    'button[data-test-id="PAUSE_BUTTON"], button[data-test-id="MOBILE_PAUSE_BUTTON"]',
  );
  if (pauseBtn) {
    pauseBtn.click();
    return;
  }
  window.yandexMusicMod?.sendPlayerAction?.("PAUSE");
}

function clearTimer() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}

export function startSleepTimer(minutes: number) {
  if (!minutes || minutes <= 0) return;

  clearTimer();
  state = { endsAt: Date.now() + minutes * 60 * 1000, paused: false };
  notify();

  timeoutId = setTimeout(() => {
    pausePlayback();
    state = { endsAt: null, paused: false };
    notify();
    toast("Таймер сна", {
      description: `Время вышло — воспроизведение остановлено`,
      icon: "🌙",
    });
  }, minutes * 60 * 1000);

  toast.success("Таймер сна запущен", {
    description: `Музыка остановится через ${minutes} мин`,
  });
}

export function cancelSleepTimer() {
  clearTimer();
  if (state.endsAt !== null) {
    state = { endsAt: null, paused: false };
    notify();
    toast("Таймер сна отключён", { icon: "⏹" });
  }
}

export function extendSleepTimer(extraMinutes: number) {
  if (state.endsAt === null) return startSleepTimer(extraMinutes);
  clearTimer();
  const newEndsAt = state.endsAt + extraMinutes * 60 * 1000;
  state = { endsAt: newEndsAt, paused: false };
  timeoutId = setTimeout(() => {
    pausePlayback();
    state = { endsAt: null, paused: false };
    notify();
  }, Math.max(0, newEndsAt - Date.now()));
  notify();
}

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function SleepTimerCard() {
  const timer = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [remaining, setRemaining] = useState<number>(0);
  const [customMinutes, setCustomMinutes] = useState("");

  useEffect(() => {
    if (timer.endsAt === null) return;
    const interval = setInterval(() => {
      setRemaining(Math.max(0, timer.endsAt! - Date.now()));
    }, 1000);
    setRemaining(Math.max(0, timer.endsAt - Date.now()));
    return () => clearInterval(interval);
  }, [timer.endsAt]);

  const handleCustomStart = () => {
    const minutes = parseInt(customMinutes, 10);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 720) {
      toast.warning("Введите значение от 1 до 720 минут");
      return;
    }
    startSleepTimer(minutes);
    setCustomMinutes("");
  };

  return (
    <ExpandableCard title="Таймер сна" icon={<Moon className="h-4 w-4" />}>
      <div className="flex flex-col gap-4 pt-2 px-3">
        {timer.endsAt !== null ? (
          <div className="flex flex-col gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Музыка остановится через</span>
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {formatRemaining(remaining)}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs cursor-pointer"
                onClick={() => extendSleepTimer(15)}
              >
                +15 мин
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 h-8 text-xs cursor-pointer"
                onClick={cancelSleepTimer}
              >
                Отключить
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {PRESET_MINUTES.map((minutes) => (
                <Button
                  key={minutes}
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs cursor-pointer transition-all duration-150 hover:scale-[1.03]"
                  onClick={() => startSleepTimer(minutes)}
                >
                  <Timer className="h-3.5 w-3.5 mr-1" />
                  {minutes} мин
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={720}
                placeholder="Своё время (мин)"
                className="flex-1 h-9 text-xs"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomStart()}
              />
              <Button variant="default" size="sm" className="h-9 px-4 text-xs cursor-pointer" onClick={handleCustomStart}>
                Запустить
              </Button>
            </div>
          </div>
        )}
      </div>
    </ExpandableCard>
  );
}

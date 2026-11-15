import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/components/ui/select";

import { Sparkles } from "lucide-react";

export type AmbientMode = "auto" | "snow" | "rain" | "stars" | "fireflies" | "off";

const MODE_STORAGE_KEY = "ambient/mode";
const LEGACY_SNOWFALL_KEY = "snowfall/enabled";

const modeLabels: Record<AmbientMode, string> = {
  auto: "Авто (сезонный снег)",
  snow: "Снег",
  rain: "Дождь",
  stars: "Звёздное небо",
  fireflies: "Светлячки",
  off: "Выключено",
};

const getIsNewYear = () => {
  const date = new Date();
  const month = date.getMonth();
  const day = date.getDate();
  if (month === 11 && day >= 10) return true;
  if (month === 0 && day <= 15) return true;
  return false;
};

// Разрешение текущего режима с учётом старой настройки снегопада
async function resolveMode(): Promise<AmbientMode> {
  let mode = (await window.yandexMusicMod.getStorageValue(MODE_STORAGE_KEY)) as AmbientMode | null;

  if (!mode) {
    // обратная совместимость: если снегопад был выключен — режим "off"
    const legacyEnabled = (await window.yandexMusicMod.getStorageValue(LEGACY_SNOWFALL_KEY)) !== false;
    mode = legacyEnabled ? "auto" : "off";
  }

  if (mode === "auto") return getIsNewYear() ? "snow" : "off";
  return mode;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  color: string;
  life: number;
  maxLife: number;
}

const CONFETTI_COLORS = ["#ff5c5c", "#ffd84d", "#5cff9d", "#5cb8ff", "#c05cff", "#ff9ecb"];

export function AmbientEffectsAnimation() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef<AmbientMode>("off");
  const confettiRef = useRef<Particle[]>([]);

  const [mode, setMode] = useState<AmbientMode>("off");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const resolved = await resolveMode();
      if (!cancelled) setMode(resolved);
    })();

    const onStorageChanged = (key: string) => {
      if (key === MODE_STORAGE_KEY || key.includes(LEGACY_SNOWFALL_KEY)) {
        resolveMode().then((resolved) => !cancelled && setMode(resolved));
      }
    };
    window.yandexMusicMod.onStorageChanged(onStorageChanged);

    // Конфетти по событию вехи статистики (1000-й трек и т.д.)
    const onMilestone = () => {
      if (modeRef.current === "off") return;
      spawnConfetti();
    };
    window.addEventListener("luna-milestone", onMilestone);
    window.addEventListener("luna-confetti", onMilestone);

    return () => {
      cancelled = true;
      window.removeEventListener("luna-milestone", onMilestone);
      window.removeEventListener("luna-confetti", onMilestone);
    };
  }, []);

  function spawnConfetti() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width / (window.devicePixelRatio || 1);

    const batch: Particle[] = [];
    for (let i = 0; i < 140; i++) {
      const maxLife = 180 + Math.random() * 120;
      batch.push({
        x: w / 2 + (Math.random() - 0.5) * w * 0.5,
        y: -20 - Math.random() * 120,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 3,
        size: 4 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ?? "#ffd84d",
        life: maxLife,
        maxLife,
      });
    }
    confettiRef.current.push(...batch);
  }

  useEffect(() => {
    modeRef.current = mode;

    const canvas = canvasRef.current;
    if (!canvas || mode === "off") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let particles: Particle[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const w = () => window.innerWidth;
    const h = () => window.innerHeight;
    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const initParticles = () => {
      particles = [];
      const density = mode === "stars" ? 90 : mode === "rain" ? 120 : 70;
      for (let i = 0; i < density; i++) {
        particles.push({
          x: rand(0, w()),
          y: mode === "stars" ? rand(0, h()) : rand(-h(), 0),
          vx: 0,
          vy: 0,
          size: 0,
          phase: Math.random() * Math.PI * 2,
          color: "white",
          life: 0,
          maxLife: 0,
        });
      }
    };
    initParticles();

    const draw = () => {
      ctx.clearRect(0, 0, w(), h());

      if (mode === "snow") {
        for (const p of particles) {
          if (p.size === 0) {
            p.size = rand(1.2, 3.4);
            p.vx = rand(-0.5, 1.2);
            p.vy = rand(0.5, 1.8);
          }
          p.x += p.vx + Math.sin(p.phase += 0.01) * 0.4;
          p.y += p.vy;
          if (p.y > h() + 5) {
            p.y = -5;
            p.x = rand(0, w());
          }
          if (p.x > w() + 5) p.x = -5;

          ctx.globalAlpha = 0.7;
          ctx.fillStyle = "white";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (mode === "rain") {
        for (const p of particles) {
          if (p.size === 0) {
            p.size = rand(8, 16);
            p.vx = rand(-0.6, -0.2);
            p.vy = rand(9, 15);
          }
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > h() + 20) {
            p.y = rand(-60, -10);
            p.x = rand(0, w() + 40);
          }

          ctx.globalAlpha = 0.32;
          ctx.strokeStyle = "#a8c7ff";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 2, p.y + p.size);
          ctx.stroke();
        }
      } else if (mode === "stars") {
        for (const p of particles) {
          if (p.size === 0) {
            p.size = rand(0.6, 2);
            p.phase = Math.random() * Math.PI * 2;
          }
          const twinkle = 0.35 + Math.sin((p.phase += rand(0.005, 0.02))) * 0.3;

          ctx.globalAlpha = Math.max(0.08, twinkle);
          ctx.fillStyle = "#e8ecff";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (mode === "fireflies") {
        for (const p of particles) {
          if (p.size === 0) {
            p.size = rand(1.5, 3);
            p.x = rand(0, w());
            p.y = rand(0, h());
            p.vx = rand(-0.5, 0.5);
            p.vy = rand(-0.4, 0.4);
            p.maxLife = rand(1, 2);
          }

          // плавное блуждание
          p.vx += rand(-0.04, 0.04);
          p.vy += rand(-0.04, 0.04);
          p.vx = Math.max(-0.8, Math.min(0.8, p.vx));
          p.vy = Math.max(-0.8, Math.min(0.8, p.vy));
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < -10) p.x = w() + 10;
          if (p.x > w() + 10) p.x = -10;
          if (p.y < -10) p.y = h() + 10;
          if (p.y > h() + 10) p.y = -10;

          const pulse = Math.max(0, Math.sin((p.phase += 0.03)));
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
          glow.addColorStop(0, `rgba(255, 235, 130, ${0.85 * pulse})`);
          glow.addColorStop(1, "rgba(255, 235, 130, 0)");
          ctx.globalAlpha = 1;
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Конфетти (вехи)
      if (confettiRef.current.length > 0) {
        confettiRef.current = confettiRef.current.filter((p) => p.life > 0 && p.y < h() + 20);
        for (const p of confettiRef.current) {
          p.life -= 1;
          p.phase += 0.12;
          p.x += p.vx + Math.sin(p.phase) * 1.2;
          p.y += p.vy;
          p.vy = Math.min(p.vy + 0.03, 5);

          ctx.save();
          ctx.globalAlpha = Math.min(1, p.life / 60);
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.sin(p.phase) * 0.6);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        }
      }

      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [mode]);

  if (mode === "off") return null;

  // Портал в body: UI мода живёт внутри сайдбара приложения, у предков которого
  // transform/filter — position:fixed в нём считается от сайдбара, а не от экрана,
  // и канвас оказывается невидимым.
  return createPortal(
    <canvas
      ref={canvasRef}
      data-testid="LunaAmbientCanvas"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 999998,
        pointerEvents: "none",
        opacity: mode === "rain" ? 0.9 : 1,
      }}
    />,
    document.body,
  );
}

export function AmbientEffectsCard() {
  const [mode, setMode] = useState<AmbientMode>("auto");

  useEffect(() => {
    (async () => {
      const stored = (await window.yandexMusicMod.getStorageValue(MODE_STORAGE_KEY)) as AmbientMode | null;
      if (stored) setMode(stored);
      else {
        const legacyEnabled = (await window.yandexMusicMod.getStorageValue(LEGACY_SNOWFALL_KEY)) !== false;
        setMode(legacyEnabled ? "auto" : "off");
      }
    })();
  }, []);

  const changeMode = (value: AmbientMode) => {
    setMode(value);
    window.yandexMusicMod.setStorageValue(MODE_STORAGE_KEY, value);
    // дублируем в старый ключ для совместимости с включённым/выключенным состоянием
    window.yandexMusicMod.setStorageValue(LEGACY_SNOWFALL_KEY, value !== "off");
  };

  return (
    <ExpandableCard title="Ambient-эффекты" icon={<Sparkles className="h-4 w-4" />}>
      <div className="flex flex-col gap-4 pt-2 px-3">
        <Select value={mode} onValueChange={(value) => changeMode(value as AmbientMode)}>
          <SelectTrigger className="text-foreground w-full">
            <SelectValue className="text-foreground" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(modeLabels) as AmbientMode[]).map((m) => (
              <SelectItem key={m} value={m}>
                {modeLabels[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground">
          Эффекты не перекрывают управление: они рисуются поверх приложения с pointer-events: none. Конфетти
          запускается автоматически на вехах статистики (каждые 1000 прослушанных треков).
        </span>
      </div>
    </ExpandableCard>
  );
}

// Публичный триггер конфетти (можно дергать из любого места мода)
export function fireConfetti() {
  window.dispatchEvent(new CustomEvent("luna-confetti"));
}

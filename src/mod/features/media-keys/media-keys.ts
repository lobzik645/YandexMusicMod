/**
 * Модуль обработки медиа-клавиш и локальных хоткеев
 * Предотвращает дублирующие срабатывания (двойной скип) и ложные переключения
 */

let lastLocalActionTime = 0;
const LOCAL_COOLDOWN_MS = 350;

function getPlayerBar(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    'section[data-test-id="PLAYERBAR_DESKTOP"], section[data-test-id="VIBE_PLAYERBAR"]'
  );
}

export function executePlayerAction(action: string): boolean {
  const now = Date.now();
  if (now - lastLocalActionTime < LOCAL_COOLDOWN_MS) {
    return false;
  }
  lastLocalActionTime = now;

  // 1. Отправляем в единый диспетчер бэкенда через IPC (управляет нативным контроллером Яндекс Музыки)
  if (window.yandexMusicMod?.sendPlayerAction) {
    window.yandexMusicMod.sendPlayerAction(action);
    return true;
  }

  // 2. Резервный fallback строго в пределах нижней панели плеера
  // ВНИМАНИЕ: никогда не ищем кнопки вне playerBar, чтобы не сбивать трек на Мою Волну!
  const playerBar = getPlayerBar();
  if (!playerBar) return false;

  if (action === "MOVE_FORWARD") {
    const nextBtn = playerBar.querySelector<HTMLButtonElement>(
      'button[data-test-id="NEXT_TRACK_BUTTON"], button[data-test-id="MOBILE_NEXT_TRACK_BUTTON"]'
    );
    if (nextBtn) {
      nextBtn.click();
      return true;
    }
  } else if (action === "MOVE_BACKWARD") {
    const prevBtn = playerBar.querySelector<HTMLButtonElement>(
      'button[data-test-id="PREVIOUS_TRACK_BUTTON"], button[data-test-id="MOBILE_PREVIOUS_TRACK_BUTTON"]'
    );
    if (prevBtn) {
      prevBtn.click();
      return true;
    }
  } else if (action === "PLAY_PAUSE") {
    const pauseBtn = playerBar.querySelector<HTMLButtonElement>('button[data-test-id="PAUSE_BUTTON"]');
    if (pauseBtn) {
      pauseBtn.click();
      return true;
    }
    const playBtn = playerBar.querySelector<HTMLButtonElement>('button[data-test-id="PLAY_BUTTON"]');
    if (playBtn) {
      playBtn.click();
      return true;
    }
  } else if (action === "PAUSE") {
    const pauseBtn = playerBar.querySelector<HTMLButtonElement>('button[data-test-id="PAUSE_BUTTON"]');
    if (pauseBtn) {
      pauseBtn.click();
      return true;
    }
  }

  return false;
}

export function initMediaKeys() {
  if (typeof window === "undefined") return;

  // Перехват локальных нажатий внутри окна приложения
  window.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      // Игнорируем ввод в текстовые поля и инпуты
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.code === "MediaTrackNext") {
        e.preventDefault();
        executePlayerAction("MOVE_FORWARD");
      } else if (e.code === "MediaTrackPrevious") {
        e.preventDefault();
        executePlayerAction("MOVE_BACKWARD");
      } else if (e.code === "MediaPlayPause") {
        e.preventDefault();
        executePlayerAction("PLAY_PAUSE");
      } else if (e.code === "MediaStop") {
        e.preventDefault();
        executePlayerAction("PAUSE");
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === "ArrowRight") {
        e.preventDefault();
        executePlayerAction("MOVE_FORWARD");
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === "ArrowLeft") {
        e.preventDefault();
        executePlayerAction("MOVE_BACKWARD");
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === "Space") {
        e.preventDefault();
        executePlayerAction("PLAY_PAUSE");
      }
    },
    { capture: true }
  );

  console.log("[MediaKeys] Feature initialized successfully with single-dispatcher & debounce");
}

initMediaKeys();

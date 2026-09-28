const CONTAINER_ID = "ym-custom-background-container";
const STYLES_ID = "ym-custom-background-styles";

export function isVideoFile(path: string): boolean {
  if (!path) return false;
  const clean = path.toLowerCase().split("?")[0].split("#")[0];
  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".webm") ||
    clean.endsWith(".mkv") ||
    clean.endsWith(".mov") ||
    clean.endsWith(".ogv")
  );
}

export async function toMediaUrl(path: string): Promise<string> {
  if (!path) return "";
  const trimmed = path.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  // Для картинок сначала пробуем прямое чтение в Data URL через IPC (100% надежность)
  if (!isVideoFile(trimmed) && window.yandexMusicMod?.readFileAsDataUrl) {
    try {
      const res = await window.yandexMusicMod.readFileAsDataUrl(trimmed);
      if (res && res.success && res.dataUrl) {
        return res.dataUrl;
      }
    } catch (e) {
      console.warn("[CustomBackground] readFileAsDataUrl failed, trying media server:", e);
    }
  }

  // Для видео (и как резерв для картинок) используем встроенный HTTP стрим-сервер
  if (window.yandexMusicMod?.getMediaServerPort) {
    try {
      const port = await window.yandexMusicMod.getMediaServerPort();
      if (port && port > 0) {
        return `http://127.0.0.1:${port}/media?file=${encodeURIComponent(trimmed)}`;
      }
    } catch (e) {
      console.warn("[CustomBackground] getMediaServerPort failed:", e);
    }
  }

  const normalized = trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
  return `file:///${encodeURI(normalized)}`;
}

export async function applyCustomBackground() {
  if (typeof window === "undefined" || !window.yandexMusicMod) return;

  const enabled = (await window.yandexMusicMod.getStorageValue("custom-background/enabled")) === true;
  const rawPath = ((await window.yandexMusicMod.getStorageValue("custom-background/path")) || "").toString().trim();
  const opacity = Number((await window.yandexMusicMod.getStorageValue("custom-background/opacity")) ?? 100);
  const blur = Number((await window.yandexMusicMod.getStorageValue("custom-background/blur")) ?? 0);
  const hideVibeGlow = (await window.yandexMusicMod.getStorageValue("custom-background/hideVibeGlow")) !== false;
  const hideTrackGlow = (await window.yandexMusicMod.getStorageValue("custom-background/hideTrackGlow")) !== false;
  const transparentSidebar =
    (await window.yandexMusicMod.getStorageValue("custom-background/transparentSidebar")) !== false;
  const fitMode = ((await window.yandexMusicMod.getStorageValue("custom-background/fitMode")) || "cover").toString();
  const hideAiFacts = (await window.yandexMusicMod.getStorageValue("custom-themes/hideAiFacts")) === true;

  const existingContainer = document.getElementById(CONTAINER_ID);
  const existingStyles = document.getElementById(STYLES_ID);

  if (!enabled || !rawPath) {
    existingContainer?.remove();
    existingStyles?.remove();
    return;
  }

  const mediaUrl = await toMediaUrl(rawPath);
  const isVideo = isVideoFile(rawPath);

  // 1. Управление стилями прозрачности и скрытия свечения
  let stylesEl = existingStyles as HTMLStyleElement | null;
  if (!stylesEl) {
    stylesEl = document.createElement("style");
    stylesEl.id = STYLES_ID;
    document.head.appendChild(stylesEl);
  }

  let css = `
    /* Контейнер кастомного фона */
    #${CONTAINER_ID} {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 0 !important;
      overflow: hidden !important;
      pointer-events: none !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    #${CONTAINER_ID} video,
    #${CONTAINER_ID} img {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: ${fitMode} !important;
      object-position: center !important;
      image-rendering: -webkit-optimize-contrast !important;
      image-rendering: high-quality !important;
      pointer-events: none !important;
      will-change: transform !important;
      transform-origin: center center !important;
      transition: transform 0.05s ease-out !important;
    }

    /* Прозрачность основных контейнеров страницы */
    html,
    body {
      background: transparent !important;
      background-color: transparent !important;
    }

    #root,
    #__next,
    main,
    div[class*="App_root__"],
    div[class*="MainPage_root__"],
    div[class*="VibePage_root__"],
    div[class*="VibePage_meta__"],
    div[class*="DefaultLayout_root"],
    div[class*="DefaultLayout_content"],
    div[class*="DefaultLayout_barBelow"],
    div[class*="AlbumPage_root"],
    div[class*="ArtistPage_root"],
    div[class*="PlaylistPage_root"],
    div[class*="SearchPage_root"],
    div[class*="LibraryPage_root"],
    div[class*="CommonLayout_root"],
    div[class*="TrackList_"],
    section[class*="VibePage_"],
    div[data-test-id="VIBE_BLOCK"] {
      background: transparent !important;
      background-color: transparent !important;
      position: relative !important;
      z-index: 1 !important;
    }

    /* Прозрачные шапки */
    header,
    div[class*="Header_root__"],
    div[class*="TopBar_"] {
      background: transparent !important;
      background-color: transparent !important;
    }

    /* Полупрозрачное матовое стекло для панели плеера снизу (не меняя его позицию) */
    section[data-test-id="PLAYERBAR_DESKTOP"] {
      background-color: rgba(14, 14, 18, 0.72) !important;
      backdrop-filter: blur(20px) saturate(140%) !important;
      -webkit-backdrop-filter: blur(20px) saturate(140%) !important;
      position: relative !important;
      z-index: 10 !important;
    }
  `;

  // Скрытие фонового градиента и подсветки текущего трека
  if (hideTrackGlow) {
    css += `
      div[class*="DefaultLayout_rootNewVibe"],
      div[class*="MainPage_vibeWidgetContainer"] {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
        --vibe-gradient-stop-0: transparent !important;
        --vibe-gradient-stop-1: transparent !important;
        --vibe-gradient-stop-2: transparent !important;
        --vibe-gradient-stop-3: transparent !important;
        --vibe-gradient-stop-4: transparent !important;
        --vibe-gradient-stop-5: transparent !important;
        --vibe-gradient-stop-6: transparent !important;
        --vibe-gradient-stop-7: transparent !important;
        --vibe-gradient-stop-8: transparent !important;
        --vibe-gradient-stop-9: transparent !important;
        --vibe-gradient-stop-10: transparent !important;
        --vibe-gradient-stop-11: transparent !important;
        --vibe-gradient-stop-12: transparent !important;
        --vibe-gradient-stop-13: transparent !important;
        --vibe-gradient-stop-14: transparent !important;
        --vibe-gradient-stop-15: transparent !important;
      }

      div[class*="_averageColorBackground__"],
      div[class*="averageColorBackground"] {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        background: transparent !important;
      }
    `;
  }

  // Скрытие анимации волны (Canvas), чтобы видео/картинка фона не перекрывалась
  if (hideVibeGlow) {
    css += `
      div[class*="VibePage_vibeAnimation__"],
      div[class*="VibeAnimation_root__"],
      div[class*="VibeBlock_vibeAnimation__"],
      div[data-test-id="VIBE_ANIMATION"],
      canvas[data-test-id="vibe-animation-canvas"],
      div[class*="VibePage_root__"] canvas,
      div[data-test-id="VIBE_BLOCK"] canvas {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
  }

  // Прозрачный фон для боковой панели (только цвет фона, без изменения расположения и структуры)
  if (transparentSidebar) {
    css += `
      aside[data-test-id="NAVBAR"],
      aside[class*="Navbar_root"],
      div[class*="DefaultLayout_navbar"],
      div[class*="NavbarDesktop_root"],
      div[class*="NavbarDesktop_scrollableContainer"],
      div[class*="NavbarDesktop_scrollableContent"],
      div[class*="NavbarDesktopUnauthorizedBar_root"],
      div[class*="NavbarDesktopUserWidget_userProfileContainer"],
      div[class*="CommonLayout_root"] aside {
        background: transparent !important;
        background-color: transparent !important;
        border: none !important;
        box-shadow: none !important;
        --ym-layout-background-color: transparent !important;
        --ym-background-color-primary-enabled-content: transparent !important;
      }
    `;
  }

  // Скрытие фактов нейросети
  if (hideAiFacts) {
    css += `
      div[class*="WordsCard_root__"],
      div[class*="WordsCard_"],
      div[class*="WordsBigCardPanel_root__"],
      div[class*="WordsBigCardPanel_"],
      div[class*="WordsBigCardPanelTextShimmer_"],
      div[class*="AiBadge_"],
      span[class*="AiBadge_"],
      img[class*="AiBadge_"],
      div[class*="EntityFact_"],
      div[class*="TrackFact_"],
      div[class*="ArtistFact_"],
      section[class*="WordsCard"],
      section[class*="WordsBigCardPanel"],
      div[class*="VibePage_words__"],
      div[class*="VibePage_words_"],
      div[class*="VibePage_words"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        min-height: 0 !important;
        max-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        pointer-events: none !important;
      }
    `;
  }

  stylesEl.innerHTML = css;

  // 2. Управление контейнером фона (видео / картинка)
  let container = existingContainer as HTMLDivElement | null;
  if (!container) {
    container = document.createElement("div");
    container.id = CONTAINER_ID;
    document.body.prepend(container);
  }

  // Применяем прозрачность и размытие к контейнеру
  container.style.opacity = (opacity / 100).toString();
  container.style.filter = blur > 0 ? `blur(${blur}px)` : "none";

  // Проверяем текущее медиа
  const currentMedia = container.firstElementChild as (HTMLVideoElement | HTMLImageElement) | null;
  const isCurrentVideo = currentMedia?.tagName === "VIDEO";

  if (isVideo) {
    if (isCurrentVideo && (currentMedia as HTMLVideoElement).src === mediaUrl) {
      return;
    }
    container.innerHTML = "";
    const video = document.createElement("video");
    video.src = mediaUrl;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("loop", "");

    video.onerror = (e) => {
      console.warn("[CustomBackground] Failed to load background video:", mediaUrl, e);
    };

    video.play().catch((err) => {
      console.debug("[CustomBackground] Autoplay waiting:", err);
    });

    container.appendChild(video);
  } else {
    if (!isCurrentVideo && currentMedia && (currentMedia as HTMLImageElement).src === mediaUrl) {
      return;
    }
    container.innerHTML = "";
    const img = document.createElement("img");
    img.src = mediaUrl;
    img.alt = "Custom Background";
    img.onerror = (e) => {
      console.warn("[CustomBackground] Failed to load background image:", mediaUrl, e);
    };
    container.appendChild(img);
  }
}

export function initCustomBackground() {
  if (typeof window === "undefined") return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyCustomBackground();
    });
  } else {
    applyCustomBackground();
  }

  // Слушаем изменения настроек
  if (window.yandexMusicMod?.onStorageChanged) {
    window.yandexMusicMod.onStorageChanged((key: string) => {
      if (key.startsWith("custom-background/") || key.startsWith("custom-themes/")) {
        applyCustomBackground();
      }
    });
  }

  console.log("[CustomBackground] Feature initialized successfully");
}

initCustomBackground();

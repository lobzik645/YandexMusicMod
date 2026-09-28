import customStyles from "./custom-themes.css?inline";

const stylesheetName = "yandex-music-mod-custom-themes-style";

let disableVibeAnimationTimer = setInterval(() => {}, 1000 * 60 * 60);

let customThemeEnabled = false;
let customThemeAccent = "#4A9EFF";
let forceDarkThemeEnabled = true;

// Override matchMedia for prefers-color-scheme so Yandex Music and scripts always see dark theme
if (typeof window !== "undefined" && window.matchMedia) {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = function (query: string) {
    if (forceDarkThemeEnabled && typeof query === "string" && query.includes("prefers-color-scheme")) {
      const isDark = query.includes("dark");
      return {
        matches: isDark,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as any;
    }
    return originalMatchMedia.call(window, query);
  };
}

function enforceDarkTheme() {
  if (!forceDarkThemeEnabled) return;

  if (document.documentElement) {
    if (document.documentElement.classList.contains("ym-light-theme")) {
      document.documentElement.classList.remove("ym-light-theme");
    }
    if (document.documentElement.classList.contains("light")) {
      document.documentElement.classList.remove("light");
    }
    if (!document.documentElement.classList.contains("ym-dark-theme")) {
      document.documentElement.classList.add("ym-dark-theme");
    }
    if (!document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.add("dark");
    }
  }

  if (document.body) {
    if (document.body.classList.contains("ym-light-theme")) {
      document.body.classList.remove("ym-light-theme");
    }
    if (!document.body.classList.contains("ym-dark-theme")) {
      document.body.classList.add("ym-dark-theme");
    }
  }
}

// Observe class changes on html and body to catch any attempts by Yandex Music to apply light theme
if (typeof window !== "undefined" && typeof MutationObserver !== "undefined") {
  const themeObserver = new MutationObserver(() => {
    if (forceDarkThemeEnabled) {
      enforceDarkTheme();
    }
  });

  if (document.documentElement) {
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }
  if (document.body) {
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body) {
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      }
      enforceDarkTheme();
    });
  }
  enforceDarkTheme();
}

async function updateTheme() {
  const forceDark = (await window.yandexMusicMod.getStorageValue("custom-themes/forceDarkTheme")) !== false;
  forceDarkThemeEnabled = forceDark;
  if (forceDarkThemeEnabled) {
    enforceDarkTheme();
  }

  const enabled = (await window.yandexMusicMod.getStorageValue("custom-themes/enabled")) === true ? true : false;
  const accent = await window.yandexMusicMod.getStorageValue("custom-themes/accent");
  const playerColorsReplaceEnabled =
    (await window.yandexMusicMod.getStorageValue("custom-themes/playerColorsReplace")) === false ? false : true;
  const disableVibeAnimation = await window.yandexMusicMod.getStorageValue("custom-themes/disableVibeAnimation");
  const disableExplicitMark = await window.yandexMusicMod.getStorageValue("custom-themes/disableExplicitMark");
  const hiddenMenuItems = (await window.yandexMusicMod.getStorageValue("custom-themes/hideMenuItems")) || [];

  console.log("[custom-themes]", {
    enabled,
    accent,
    playerColorsReplaceEnabled,
    disableVibeAnimation,
    disableExplicitMark,
    hiddenMenuItems,
  });

  customThemeEnabled = enabled;
  customThemeAccent = accent;

  document.getElementById(stylesheetName)?.remove();

  const styleSheet = document.createElement("style");
  styleSheet.id = stylesheetName;

  if (enabled && accent) {
    styleSheet.innerHTML = customStyles;

    styleSheet.innerHTML += `
      :root {
        --yandexMusicModAccent: ${accent};
      }`;

    if (playerColorsReplaceEnabled) {
      styleSheet.innerHTML += `
        .ym-dark-theme 
        section[data-test-id="PLAYERBAR_DESKTOP"]
        {
          --player-average-color-background: var(--yandexMusicModPalette-200) !important;
        }
        .ym-dark-theme 
        div[data-test-id="FULLSCREEN_PLAYER_MODAL"]
        {
          --player-average-color-background: var(--yandexMusicModPalette-200) !important;
        }
        .ym-light-theme
        section[data-test-id="PLAYERBAR_DESKTOP"],
        div[data-test-id="FULLSCREEN_PLAYER_MODAL"]
        {
          --player-average-color-background: var(--yandexMusicModPalette-700) !important;
        }
        .ym-dark-theme div[class*="_averageColorBackground__"] {
          background: linear-gradient(var(--yandexMusicModPalette-200, var(--ym-background-color-secondary-enabled-blur)) 0, transparent 100%); 
        }
        .ym-light-theme div[class*="_averageColorBackground__"] {
          background: linear-gradient(var(--yandexMusicModPalette-light-300, var(--ym-background-color-secondary-enabled-blur)) 0, transparent 100%); 
        }
      `;
    }
  }

  // Переменные ширины левой панели для точного центрирования
  styleSheet.innerHTML += `
    :root {
      --ym-app-navbar-width: 12.75rem;
    }
    :root:has(aside[class*="collapsed"]),
    :root:has(aside[class*="Navbar_root_collapsed"]),
    :root:has(div[class*="NavbarDesktop_root_collapsed"]),
    :root:has([data-test-id="NAVBAR"][class*="collapsed"]) {
      --ym-app-navbar-width: 4.5rem;
    }
  `;

  // Опция скрытия ленты станций (колеса) и центрирования Моей Волны ровно по середине экрана/окна
  const centerVibePlayer = (await window.yandexMusicMod.getStorageValue("custom-themes/centerVibePlayer")) === true;
  if (centerVibePlayer) {
    styleSheet.innerHTML += `
      /* Полное скрытие колеса и станций Моей Волны */
      div[class*="WheelDesktop_root"],
      div[class*="WheelDesktop_wrapper"],
      div[class*="WheelMobile_root"],
      div[class*="WheelItem_root"],
      div[class*="WheelDesktopItem_root"],
      div[class*="VibePage_wheel"],
      section[class*="Wheel"],
      aside[class*="Wheel"] {
        display: none !important;
        width: 0 !important;
        max-width: 0 !important;
        min-width: 0 !important;
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        pointer-events: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
      }

      /* Моя Волна и плеер ровно по центру всего окна приложения (независимо от левого бара) */
      div[class*="VibePage_root"] {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        width: 100% !important;
        height: 100% !important;
        overflow-x: visible !important;
      }

      div[class*="VibePage_meta"] {
        padding-inline-start: var(--ym-spacer-size-xxl) !important;
        padding-inline-end: var(--ym-spacer-size-xxl) !important;
        padding-inline: var(--ym-spacer-size-xxl) !important;
        margin: 0 auto !important;
        justify-content: center !important;
        align-items: center !important;
        width: 100% !important;
        max-width: 100% !important;
        flex: 1 1 100% !important;
        text-align: center !important;
        transform: translateX(calc(-0.5 * var(--ym-app-navbar-width, 12.75rem))) !important;
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }

      @media only screen and (max-width: 767.98px) {
        div[class*="VibePage_meta"] {
          transform: none !important;
        }
      }

      div[class*="VibePage_playerBlock_shifted__"],
      div[class*="VibePage_playerBlock_shifted"] {
        transform: none !important;
      }

      div[class*="VibePage_playerBlock"] {
        margin: 0 auto !important;
        align-items: center !important;
        justify-content: center !important;
      }

      div[class*="VibePage_vibeAnimation"] {
        inset-inline-start: 50% !important;
        transform: translate(-50%, -50%) !important;
      }
    `;
  }

  // Скрытие фактов нейросети
  const hideAiFacts = (await window.yandexMusicMod.getStorageValue("custom-themes/hideAiFacts")) === true;
  if (hideAiFacts) {
    styleSheet.innerHTML += `
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

  clearInterval(disableVibeAnimationTimer);

  if (disableVibeAnimation) {
    styleSheet.innerHTML += `
      div[data-test-id="VIBE_BLOCK"] {
          height: 32vh !important;
          min-height: unset !important;
      }
      div[data-test-id="VIBE_ANIMATION"] {
        display: none!important;
      }
    `;

    disableVibeAnimationTimer = setInterval(() => {
      sendMessageToWorkers("vibe-animation-worker-disable", undefined);
    }, 2000);
  } else {
    sendMessageToWorkers("vibe-animation-worker-enable", undefined);
  }

  if (disableExplicitMark) {
    styleSheet.innerHTML += `
      span[class*="Meta_explicitMarkContainer__"], svg[class*="ExplicitMarkIcon_"], svg[class*="explicitMark__"] {
        display: none!important;
      }
    `;
  }

  if (hiddenMenuItems && hiddenMenuItems.length > 0) {
    for (const menuItem of hiddenMenuItems) {
      styleSheet.innerHTML += `
        aside[data-test-id="NAVBAR"] li:has(a[href="/${menuItem}"]) {
          display: none!important;
        }
      `;
    }
  }

  if (styleSheet.innerHTML.trim().length > 0) {
    document.head.appendChild(styleSheet);
  }

  if (enabled && accent) {
    updateVibeBackgroundColor();
  }
}

function updateVibeBackgroundColor() {
  function hexToHue(hex: string, offset = 0) {
    // убрать #
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }

    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h = 0;
    if (d !== 0) {
      switch (max) {
        case r:
          h = ((g - b) / d) % 6;
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h *= 60;
      if (h < 0) h += 360;
    }

    // применяем смещение
    h = (h + offset) % 360;
    if (h < 0) h += 360;

    return h;
  }

  function getCssVarNormalizedRgb<T extends string | number>(varName: T): { r: number; g: number; b: number } | null {
    const el = document.createElement("div");
    el.style.display = "none";
    el.style.color = `var(${varName})`;
    document.body.appendChild(el);

    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);

    // Парсим color(srgb ...) или rgb(...)
    let match;
    if (computed.startsWith("color(srgb")) {
      match = computed.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)\)/);
      if (!match) return null;
      return { r: parseFloat(match[1]), g: parseFloat(match[2]), b: parseFloat(match[3]) };
    } else if (computed.startsWith("rgb")) {
      match = computed.match(/rgb\((\d+), (\d+), (\d+)\)/);
      if (!match) return null;
      return {
        r: parseInt(match[1], 10) / 255,
        g: parseInt(match[2], 10) / 255,
        b: parseInt(match[3], 10) / 255,
      };
    }

    return null;
  }

  const backgroundColor = getCssVarNormalizedRgb("--ym-background-color-primary-enabled-content");

  console.log("[custom-themes] updateVibeBackgroundColor", backgroundColor);

  if (!backgroundColor) return;

  sendMessageToWorkers("vibe-animation-worker-apply-settings", {
    isYandexMusicMod: true,
    backgroundColor: [backgroundColor.r, backgroundColor.g, backgroundColor.b],
  });

  if (customThemeEnabled) {
    sendMessageToWorkers("vibe-animation-worker-apply-settings", {
      isYandexMusicMod: true,
      collectionHue: hexToHue(customThemeAccent, 50),
      hue: hexToHue(customThemeAccent, 50),
      useDefaultHue: false,
    });
  }
}

window.yandexMusicMod.onStorageChanged((key: string, value: any) => {
  if (key.includes("custom-themes")) updateTheme();
});

updateTheme();

// Перехват запросов к backgroundWorker
(function () {
  window.__workers = [];
  const OrigWorker = window.Worker as any;
  window.Worker = function (...args: any[]) {
    const worker = new OrigWorker(...args);
    const origPostMessage = worker.postMessage;
    window.__workers.push(worker);
    worker.postMessage = function (message, transfer) {
      if (message?.payload?.backgroundColor || message?.payload?.collectionHue) {
        if (!message?.payload?.isYandexMusicMod)
          setTimeout(() => {
            updateVibeBackgroundColor();
          }, 500);
      }

      return origPostMessage.call(worker, message, transfer);
    };
    return worker;
  };

  const _atob = atob;

  // Патч offscreen canvas который управляет vibe анимацией
  window.atob = function (str) {
    const decoded = _atob(str);
    if (decoded.includes("updateBackgroundColor(t){this.background=new c(t,t,t)}")) {
      const modified = decoded.replace(
        "updateBackgroundColor(t){this.background=new c(t,t,t)}",
        `
        updateBackgroundColor(t)
        {
            if(Array.isArray(t))
              this.background=new c(t[0],t[1],t[2]);
            else
              this.background=new c(t,t,t);
         }
        `,
      );
      console.log("[custom-themes] Modified vibe animation worker code");
      return modified;
    }
    return decoded;
  };
})();

function sendMessageToWorkers(type: string, message: any) {
  for (const worker of window.__workers.filter((worker) => !worker.objectURL))
    worker.postMessage({
      source: "vibe",
      type: type,
      payload: message,
    });
}

function initNavbarObserver() {
  function updateWidth() {
    const navbar =
      document.querySelector('aside[data-test-id="NAVBAR"]') ||
      document.querySelector('aside[class*="Navbar_root"]') ||
      document.querySelector('.DefaultLayout_navbar__LIQWG') ||
      document.querySelector('aside[class*="Navbar"]');
    if (navbar) {
      const rect = navbar.getBoundingClientRect();
      if (rect.width > 0) {
        document.documentElement.style.setProperty("--ym-app-navbar-width", `${rect.width}px`);
      }
    }
  }

  if (typeof window !== "undefined") {
    updateWidth();
    window.addEventListener("resize", updateWidth);

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        updateWidth();
      });

      const checkNavbar = () => {
        const navbar =
          document.querySelector('aside[data-test-id="NAVBAR"]') ||
          document.querySelector('aside[class*="Navbar_root"]') ||
          document.querySelector('.DefaultLayout_navbar__LIQWG') ||
          document.querySelector('aside[class*="Navbar"]');
        if (navbar) {
          ro.observe(navbar);
          updateWidth();
        }
      };

      checkNavbar();

      const mo = new MutationObserver(() => {
        checkNavbar();
      });
      if (document.body) {
        mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
      } else {
        document.addEventListener("DOMContentLoaded", () => {
          if (document.body) {
            mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
          }
          checkNavbar();
        });
      }
    }
  }
}

initNavbarObserver();


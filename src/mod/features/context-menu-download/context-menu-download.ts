import { toast } from "sonner";

import { getTracksInfo, QualityEnum } from "~/mod/features/utils/api";
import { enqueueTracks } from "~/mod/features/downloader/download-queue";
import { getCurrentNumericTrackId } from "~/mod/features/utils/player";

const ADDON_NAME = "ContextMenuDownload";

const MENU_MARKER = "CONTEXT_MENU_LUNA_DOWNLOAD_BUTTON";

// Меню трека в списках (трек-строки, плейлисты, альбомы и т.д.)
const TRACK_MENU_SELECTOR = "[data-test-id='TRACK_CONTEXT_MENU']";

// Меню «…» плеера, полноэкранного плеера и «Моя волна» — трек там всегда текущий играющий
const PLAYER_MENU_SELECTORS = ["VIBE_CONTEXT_MENU", "VIBE_PAGE_CONTEXT_MENU", "VIBE_AGENT_CONTEXT_MENU"].map(
  (id) => `[data-test-id='${id}']`,
);

const WATCHED_MENU_SELECTOR = [TRACK_MENU_SELECTOR, ...PLAYER_MENU_SELECTORS].join(", ");

// То же, но без меню, в которое мы уже добавили кнопку
const WATCHED_MENU_QUERY = [TRACK_MENU_SELECTOR, ...PLAYER_MENU_SELECTORS]
  .map((sel) => `${sel}:not(:has([data-test-id='${MENU_MARKER}']))`)
  .join(", ");

const PLAYER_MENU_TRIGGERS =
  "[data-test-id='PLAYERBAR_DESKTOP_CONTEXT_MENU_BUTTON'], [data-test-id='FULLSCREEN_PLAYER_CONTEXT_MENU_BUTTON'], [data-test-id='VIBE_CONTEXT_MENU_BUTTON'], [data-test-id='VIBE_PAGE_CONTEXT_MENU_BUTTON'], [data-test-id='VIBE_AGENT_CONTEXT_MENU_BUTTON']";

function log(...args: any[]) {
  console.debug("[" + ADDON_NAME + "]", ...args);
}

let contextMenuDownloadInitialized = false;

export async function initContextMenuDownload() {
  if (contextMenuDownloadInitialized) return;
  contextMenuDownloadInitialized = true;

  // бандл мода исполняется в <head> — document.body ещё не существует,
  // наблюдать за ним можно только после DOMContentLoaded
  if (!document.body) {
    await new Promise<void>((resolve) => {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
      } else {
        resolve();
      }
    });
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;

        // появилось ли меню, в которое мы ещё не добавляли кнопку?
        const watchedMenu =
          (node.matches(WATCHED_MENU_SELECTOR) ? node : null) ||
          node.querySelector(WATCHED_MENU_QUERY);
        if (!watchedMenu) {
          // диагностика: какие меню вообще появились в этом узле?
          const menuIds = Array.from(node.querySelectorAll("[data-test-id]"))
            .map((el) => el.getAttribute("data-test-id"))
            .filter((id) => id && id.toUpperCase().includes("MENU"));
          if (menuIds.length) {
            log("menu-like nodes appeared:", [...new Set(menuIds)].join(", "));
          }
          return;
        }

        createDownloadItem(watchedMenu as HTMLElement);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  log("initialized");
}

// id трека для меню плеера / вайба — текущий играющий трек
function resolveCurrentTrackId(): string | null {
  return getCurrentNumericTrackId();
}

// Триггер-кнопка, которая открыла меню (по ней ищем id трека в fiber-дереве)
function findMenuTrigger(menu: HTMLElement): HTMLElement | null {
  // 1. aria-labelledby element reflection ( Radix-стиль )
  const labelled = (menu as any).ariaLabelledByElements?.[0] ?? (menu.parentElement as any)?.ariaLabelledByElements?.[0];
  if (labelled instanceof HTMLElement) return labelled;

  // 2. примитив дропдауна приложения: у открытого триггера aria-controls указывает на id контента
  if (menu.id) {
    const byControls = document.querySelector(`[aria-controls="${CSS.escape(menu.id)}"]`);
    if (byControls instanceof HTMLElement) return byControls;
  }

  // 3. просто текущий открытый триггер меню
  const expanded = document.querySelector("[aria-haspopup='menu'][aria-expanded='true']");
  if (expanded instanceof HTMLElement) return expanded;

  return null;
}

// Поиск id трека в React fiber-дереве узла (как у треков в списках)
function findTrackIdInFiber(node: any): string | null {
  const fiberKey = Object.keys(node || {}).find((key) => key.startsWith("__reactFiber"));
  if (!fiberKey) return null;

  let fiber = node[fiberKey];
  for (let depth = 0; fiber && depth < 8; depth++) {
    const props = fiber.memoizedProps;
    if (props?.track?.id) return String(props.track.id);
    if (props?.children && Array.isArray(props.children)) {
      for (const child of props.children) {
        const trackId = child?.props?.track?.id;
        if (trackId) return String(trackId);
      }
    }
    if (props?.entityData?.meta?.id) return String(props.entityData.meta.id);
    fiber = fiber.return;
  }
  return null;
}

// Определить id трека для контекстного меню: вайб/плеер -> fiber-обход списка -> текущий трек
function resolveMenuTrackId(menu: HTMLElement, trigger: HTMLElement | null): string | null {
  // меню «…» плеера (плеер-бар, фуллскрин, «Моя волна») — всегда текущий играющий трек
  if (PLAYER_MENU_SELECTORS.some((sel) => menu.matches(sel))) {
    return resolveCurrentTrackId();
  }

  if (trigger?.matches(PLAYER_MENU_TRIGGERS)) {
    return resolveCurrentTrackId();
  }

  // не нашли триггер у меню строки трека — не рискуем скачать не тот трек
  if (!trigger) return null;

  // меню трека из списка: поднимаемся от кнопки и ищем track.id в fiber
  let el: HTMLElement | null = trigger;
  for (let i = 0; el && i < 6; i++) {
    const trackId = findTrackIdInFiber(el);
    if (trackId && /^\d+$/.test(trackId)) return trackId;
    el = el.parentElement;
  }

  // data-атрибут виртуализированного списка
  const virtualNode = trigger?.closest("[data-intersection-property-id]") as HTMLElement | null;
  const virtualId = virtualNode?.dataset?.intersectionPropertyId?.match(/track_(\d+)/)?.[1];
  if (virtualId) return virtualId;

  // Триггер НЕ внутри строки трека из списка => это меню плеера (фуллскрин и т.п.),
  // у которых у кнопки «...» другой data-test-id — берём текущий играющий трек
  const inTrackRow =
    trigger?.closest("[data-intersection-property-id]") || trigger?.closest('[class*="CommonTrack"]');
  if (!inTrackRow) {
    return resolveCurrentTrackId();
  }

  return null;
}

function fetchSavedQuality(): Promise<string> {
  return window.yandexMusicMod
    .getStorageValue("downloadQuality")
    .then((saved: any) => (saved && Object.values(QualityEnum).includes(saved) ? saved : QualityEnum.LOSSLESS))
    .catch((e: unknown) => {
      log("Failed to read downloadQuality", e);
      return QualityEnum.LOSSLESS;
    });
}

// Клонируем последний пункт меню, чтобы унаследовать стили приложения, и превращаем его в «Скачать трек».
// Возвращаем также узел-родитель, к которому надо добавить пункт (в вайб-меню пункты лежат во вложенном списке).
function buildItemFromSource(
  menu: HTMLElement,
): { item: HTMLElement; label: Text | null; parent: HTMLElement } | null {
  // пункты меню приложения помечены role="menuitem" (floating-ui useRole)
  const roleItems = Array.from(menu.querySelectorAll<HTMLElement>("[role='menuitem']")).filter((el) =>
    el.querySelector("span"),
  );
  const menuItems = Array.from(menu.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && !!child.querySelector("span"),
  );
  const sourceItem =
    roleItems[roleItems.length - 1] ??
    menuItems[menuItems.length - 1] ??
    (menu.lastElementChild instanceof HTMLElement ? menu.lastElementChild : null);
  if (!sourceItem) return null;

  const parent = roleItems.length ? (sourceItem.parentElement ?? menu) : menu;

  const item = sourceItem.cloneNode(true) as HTMLElement;
  item.setAttribute("data-test-id", MENU_MARKER);

  // иконка пункта -> «скачать» (иконки приложения — svg use со спрайтом)
  try {
    item.querySelectorAll("use").forEach((use) => {
      use.setAttribute("xlink:href", "/icons/sprite.svg#download_xxs");
      use.setAttribute("href", "/icons/sprite.svg#download_xxs");
    });
  } catch {}

  // текст: заменяем последний непустой текстовый узел внутри span, иначе весь текст пункта
  const span = item.querySelector("span");
  let label: Text | null = null;
  if (span) {
    const textNodes = Array.from(span.childNodes).filter(
      (n): n is Text => n.nodeType === Node.TEXT_NODE && !!n.nodeValue && !!n.nodeValue.trim(),
    );
    label = textNodes[textNodes.length - 1] ?? null;
    if (label) {
      label.nodeValue = "Скачать трек";
    } else {
      span.textContent = "";
      label = document.createTextNode("Скачать трек");
      span.appendChild(label);
    }
  } else {
    item.textContent = "Скачать трек";
  }

  return { item, label, parent };
}

function createDownloadItem(menu: HTMLElement, attempt = 0) {
  if (menu.querySelector(`[data-test-id='${MENU_MARKER}']`)) return;

  const trigger = findMenuTrigger(menu);
  const trackId = resolveMenuTrackId(menu, trigger);
  log(
    `${menu.getAttribute("data-test-id")} appeared | triggerTestId=`,
    trigger?.getAttribute("data-test-id") || "(none)",
    "| resolved track id:",
    trackId || "(FAILED)",
  );
  if (!trackId) return;

  // пункты меню могут рендериться чуть позже контейнера — пробуем ещё несколько кадров
  const built = buildItemFromSource(menu);
  if (!built) {
    if (attempt < 5 && menu.isConnected) {
      setTimeout(() => createDownloadItem(menu, attempt + 1), 100);
    }
    return;
  }

  const { item, label, parent } = built;
  const setLabel = (text: string) => {
    if (label) label.nodeValue = text;
  };

  item.addEventListener("click", async () => {
    try {
      // закрываем меню (оно не закроется само — у клона нет обработчиков приложения)
      menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      setLabel("Скачивание…");

      const quality = await fetchSavedQuality();
      const info = await getTracksInfo([trackId], true);
      const track = info.isOk() && Array.isArray(info.value) && info.value[0] ? info.value[0] : null;

      if (!track) {
        toast.error("Не удалось получить информацию о треке", {
          description: info.isErr() ? String(info.error) : "Трек недоступен",
        });
        return;
      }

      const folderPath = (await window.yandexMusicMod.getStorageValue("downloadFolderPath")) || "";
      const { added, duplicates } = enqueueTracks([track], quality as QualityEnum, folderPath);

      if (duplicates > 0 && added === 0) {
        toast.info("Трек уже в очереди загрузки", {
          description: `${(track.artists || []).map((a: any) => a.name).join(", ")} — ${track.title}`,
        });
      } else if (added > 0) {
        const artistsText = (track.artists || []).map((a: any) => a.name).join(", ");
        toast.success("Добавлено в очередь загрузки", {
          description: `${artistsText} — ${track.title}`,
          action: {
            label: "Папка",
            onClick: () => window.yandexMusicMod.openFolder(folderPath),
          },
        });
      } else {
        toast.warning("Трек недоступен для скачивания");
      }
    } catch (error) {
      console.error(`[${ADDON_NAME}] download failed`, error);
      toast.error("Не удалось скачать трек", {
        description: String(error),
      });
    } finally {
      setLabel("Скачать трек");
    }
  });

  parent.appendChild(item);
}

initContextMenuDownload().catch((e) => console.error("[ContextMenuDownload] init failed", e));

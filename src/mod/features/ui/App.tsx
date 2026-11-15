import { ThemeProvider } from "./contexts/ThemeContext";
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui/components/ui/dialog";
import { ScrollArea } from "@ui/components/ui/scroll-area";
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Toaster } from "@ui/components/ui/sonner";

import { IPChecker } from "@ui/components/ip-checker";
import { FontChanger } from "@ui/components/font-changer";
import { Devtools } from "@ui/components/devtools";
import { Downloader } from "@ui/components/downloader";
import { AutoBestQuality } from "@ui/components/auto-best-quality";
import { DiscordRPC } from "@ui/components/discord-rpc";
import { Settings } from "@ui/components/settings";
import { AutoLiker } from "@ui/components/auto-liker";
import { ExperimentsToggle } from "@ui/components/experiments-toggle";
import { ScaleChanger } from "@ui/components/scale-changer";
import { CustomThemes } from "@ui/components/custom-themes";
import { BackgroundTab } from "@ui/components/background-tab";
import { UiCustomization } from "@ui/components/ui-customization";
import { StatsPanel } from "@ui/components/stats-panel";
import { BackupExportCard } from "@ui/components/backup-export-card";
import { AmbientEffectsAnimation, AmbientEffectsCard } from "@ui/components/ambient-effects";
import { OsdOverlay, OsdSettingsCard } from "@ui/components/osd-overlay";

import { SleepTimerCard } from "~/mod/features/sleep-timer";

import "~/mod/features/stats/stats-tracker";
// Discord RPC: определяет window.__getPlayerState для main процесса
import "~/mod/features/discord-RPC/discordRPC";

import { Button } from "./components/ui/button";

import logo from "@ui/assets/logo.webp?inline";

import { FaGithub, FaTelegramPlane } from "react-icons/fa";
import { RxUpdate } from "react-icons/rx";
import {
  Paintbrush,
  Film,
  Zap,
  X,
  BarChart3,
  Search,
  Type,
  Maximize,
  Image as ImageIcon,
  Download,
  Ghost,
  Gauge,
  Heart,
  Sparkles,
  Moon,
  MonitorPlay,
  Settings as SettingsIcon,
  TerminalSquare,
  FlaskConical,
  Database,
} from "lucide-react";

const IS_DEV = false;
const GITHUB_REPO_SLUG = "lobzik645/YandexMusicMod";
const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO_SLUG}`;

type TabType = "appearance" | "background" | "modules" | "stats";

interface SectionEntry {
  tab: TabType;
  title: string;
  icon: React.ReactNode;
  keywords: string;
  render: () => React.ReactNode;
}

export default function App() {
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(IS_DEV);
  const [devtoolsEnabled, setDevtoolsEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("appearance");
  const [searchQuery, setSearchQuery] = useState("");
  const [statsSkeleton, setStatsSkeleton] = useState(true);
  const [blurEnabled, setBlurEnabled] = useState(true);
  const [blurIntensity, setBlurIntensity] = useState(24);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  const appMetaQuery = useQuery({
    queryKey: ["appMeta"],
    queryFn: async () => {
      const data = await fetch(
        `https://raw.githubusercontent.com/${GITHUB_REPO_SLUG}/refs/heads/main/.meta/meta.json`,
      );
      if (data.status !== 200) {
        throw new Error("Failed to fetch app meta");
      }
      return data.json();
    },
    enabled: true,
    retry: true,
  });

  useEffect(() => {
    (async () => {
      setDevtoolsEnabled((await window.yandexMusicMod.getStorageValue("devtools/enabled")) || false);
      const bEn = (await window.yandexMusicMod.getStorageValue("ui/blurEnabled")) !== false;
      const bInt = Number((await window.yandexMusicMod.getStorageValue("ui/blurIntensity")) ?? 24);
      const aEn = (await window.yandexMusicMod.getStorageValue("ui/animationsEnabled")) !== false;
      setBlurEnabled(bEn);
      setBlurIntensity(bInt);
      setAnimationsEnabled(aEn);
    })();

    window.yandexMusicMod.onStorageChanged((key: string, value: any) => {
      if (key.includes("devtools/enabled")) setDevtoolsEnabled(value);
      if (key === "ui/blurEnabled") setBlurEnabled(value !== false);
      if (key === "ui/blurIntensity") setBlurIntensity(Number(value));
      if (key === "ui/animationsEnabled") setAnimationsEnabled(value !== false);
    });
  }, []);

  useEffect(() => {
    const containerId = "mod-sheet-container";

    const checkAndPlaceButton = () => {
      if (IS_DEV) {
        let container = document.getElementById(containerId) as HTMLDivElement | null;
        if (!container) {
          container = document.createElement("div");
          container.id = containerId;
          document.body.appendChild(container);
        }
        setMountNode(container);
        return;
      }

      // Ищем строго боковое меню (NAVBAR)
      const sidebar =
        document.querySelector('aside[data-test-id="NAVBAR"]') ||
        document.querySelector('aside[class*="Navbar_root"]') ||
        document.querySelector('div[class*="NavbarDesktop_root"]');

      if (!sidebar) {
        return;
      }

      // Внутри сайдбара ищем виджет профиля или блок авторизации
      const profileWidget =
        sidebar.querySelector('div[class*="NavbarDesktopUserWidget_userProfileContainer"]') ||
        sidebar.querySelector('div[class*="NavbarDesktopUnauthorizedBar_root"]') ||
        sidebar.querySelector('div[class*="UserProfile_root"]') ||
        sidebar.querySelector('div[class*="userProfile"]');

      let container = document.getElementById(containerId) as HTMLDivElement | null;
      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
      }

      if (profileWidget && profileWidget.parentNode) {
        // Устанавливаем ровно перед блоком профиля/авторизации в сайдбаре
        if (container.parentNode !== profileWidget.parentNode || container.nextSibling !== profileWidget) {
          profileWidget.parentNode.insertBefore(container, profileWidget);
        }
      } else {
        // Резервное размещение: внутри сайдбара
        if (container.parentNode !== sidebar) {
          sidebar.appendChild(container);
        }
      }

      setMountNode(container);
    };

    checkAndPlaceButton();

    const observer = new MutationObserver(checkAndPlaceButton);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      const container = document.getElementById(containerId);
      if (container) {
        container.remove();
      }
    };
  }, []);

  useEffect(() => {
    // Глобальная функция и хоткей для открытия настроек (Ctrl+Alt+S или Alt+M)
    (window as any).__openLunaModSettings = () => setIsDialogOpen(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.altKey && e.code === "KeyS") || (e.altKey && e.code === "KeyM")) {
        e.preventDefault();
        setIsDialogOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Скелетон статистики на первый рендер таба
  useEffect(() => {
    if (activeTab === "stats") {
      setStatsSkeleton(true);
      const timer = setTimeout(() => setStatsSkeleton(false), 350);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  const dialogTrigger = (
    <DialogTrigger asChild>
      <button
        className="mod-trigger-button flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 text-[var(--ym-controls-color-primary-text-enabled_variant)] transition-all duration-150 ease-in-out hover:bg-white/12 hover:border-white/35 backdrop-blur-sm shadow-none cursor-pointer"
        title="Luna mod (Alt+M)"
        onClick={(e) => {
          e.stopPropagation();
          setIsDialogOpen(true);
        }}
      >
        <div
          className="mod-trigger-icon h-[22px] w-[22px] bg-contain bg-no-repeat bg-center shrink-0"
          style={{
            backgroundImage: `url(${logo})`,
          }}
        ></div>
        <span className="trigger-text font-medium text-xs">Luna mod</span>
      </button>
    </DialogTrigger>
  );

  // Реестр секций: используется и для сайдбара, и для поиска по настройкам
  const sections = useMemo<SectionEntry[]>(() => {
    const list: SectionEntry[] = [
      { tab: "appearance", title: "Интерфейс", icon: <Paintbrush className="h-3.5 w-3.5" />, keywords: "интерфейс кастомизация кнопки blur анимации", render: () => <UiCustomization /> },
      { tab: "appearance", title: "Темы", icon: <Sparkles className="h-3.5 w-3.5" />, keywords: "темы тема цвета акцент градиент неон", render: () => <CustomThemes /> },
      { tab: "appearance", title: "Шрифты", icon: <Type className="h-3.5 w-3.5" />, keywords: "шрифты font текст", render: () => <FontChanger /> },
      { tab: "appearance", title: "Масштаб", icon: <Maximize className="h-3.5 w-3.5" />, keywords: "масштаб размер интерфейс zoom", render: () => <ScaleChanger /> },
      { tab: "background", title: "Фон", icon: <ImageIcon className="h-3.5 w-3.5" />, keywords: "фон видео гиф картинка размытие пресеты", render: () => <BackgroundTab /> },
      { tab: "modules", title: "Скачивание музыки", icon: <Download className="h-3.5 w-3.5" />, keywords: "скачать загрузка трек треки плейлист альбом артист очередь качество папка", render: () => <Downloader /> },
      { tab: "modules", title: "Discord RPC", icon: <Ghost className="h-3.5 w-3.5" />, keywords: "discord rpc статус профиль", render: () => <DiscordRPC /> },
      { tab: "modules", title: "Авто-качество", icon: <Gauge className="h-3.5 w-3.5" />, keywords: "качество flac lossless авто лучший звук", render: () => <AutoBestQuality /> },
      { tab: "modules", title: "Авто-лайкер", icon: <Heart className="h-3.5 w-3.5" />, keywords: "лайк нравится перенос треки", render: () => <AutoLiker /> },
      { tab: "modules", title: "Ambient-эффекты", icon: <Sparkles className="h-3.5 w-3.5" />, keywords: "снег снежок дождь звёзды светлячки конфетти эффекты ambient", render: () => <AmbientEffectsCard /> },
      { tab: "modules", title: "Таймер сна", icon: <Moon className="h-3.5 w-3.5" />, keywords: "сон таймер sleep остановить музыка", render: () => <SleepTimerCard /> },
      { tab: "modules", title: "OSD трека", icon: <MonitorPlay className="h-3.5 w-3.5" />, keywords: "osd оверлей всплывающее окно смена трека", render: () => <OsdSettingsCard /> },
      { tab: "modules", title: "Настройки", icon: <SettingsIcon className="h-3.5 w-3.5" />, keywords: "настройки телеметрия аналитика sentry", render: () => <Settings /> },
      { tab: "modules", title: "DevTools", icon: <TerminalSquare className="h-3.5 w-3.5" />, keywords: "devtools консоль разработчик отладка", render: () => <Devtools /> },
      { tab: "stats", title: "Статистика", icon: <BarChart3 className="h-3.5 w-3.5" />, keywords: "статистика прослушивания время треки артисты", render: () => <StatsPanel /> },
      { tab: "stats", title: "Экспорт и бэкап", icon: <Database className="h-3.5 w-3.5" />, keywords: "экспорт csv json бэкап восстановление резервная копия", render: () => <BackupExportCard /> },
    ];

    if (devtoolsEnabled) {
      list.push({
        tab: "modules",
        title: "Эксперименты",
        icon: <FlaskConical className="h-3.5 w-3.5" />,
        keywords: "эксперименты experiment флаги",
        render: () => <ExperimentsToggle />,
      });
    }

    return list;
  }, [devtoolsEnabled]);

  const tabs: Array<{ id: TabType; title: string; icon: React.ReactNode }> = [
    { id: "appearance", title: "Внешний вид", icon: <Paintbrush className="h-4 w-4" /> },
    { id: "background", title: "Фон", icon: <Film className="h-4 w-4" /> },
    { id: "modules", title: "Модули", icon: <Zap className="h-4 w-4" /> },
    { id: "stats", title: "Статистика", icon: <BarChart3 className="h-4 w-4" /> },
  ];

  const query = searchQuery.trim().toLowerCase();
  const isSearching = query.length > 0;

  const visibleSections = isSearching
    ? sections.filter((s) => (s.title + " " + s.keywords).toLowerCase().includes(query))
    : sections.filter((s) => s.tab === activeTab);

  return (
    <ThemeProvider>
      <Toaster position="bottom-right" />
      <AmbientEffectsAnimation />
      <OsdOverlay />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {mountNode && createPortal(dialogTrigger, mountNode)}

        <DialogContent
          className={`fixed top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 z-[999999] w-[940px] max-w-[94vw] h-[640px] max-h-[88vh] flex flex-col p-0 overflow-hidden border border-white/10 rounded-xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] ${
            blurEnabled ? "bg-neutral-950/85" : "bg-[#0e0e14]"
          } ${
            animationsEnabled
              ? "data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in-0 duration-200"
              : ""
          }`}
          style={
            blurEnabled
              ? {
                  backdropFilter: `blur(${blurIntensity}px)`,
                  WebkitBackdropFilter: `blur(${blurIntensity}px)`,
                }
              : {}
          }
          showCloseButton={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div
                className="h-7 w-7 bg-contain bg-no-repeat bg-center shrink-0"
                style={{
                  backgroundImage: `url(${logo})`,
                }}
              />
              <div className="flex items-baseline gap-2">
                <DialogTitle className="text-foreground text-lg font-bold tracking-tight">
                  Luna mod
                </DialogTitle>
                <span className="text-muted-foreground text-xs font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                  v{import.meta.env.VITE_MOD_VERSION}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 cursor-pointer"
                onClick={() => setIsDialogOpen(false)}
                title="Закрыть"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Body: sidebar + content */}
          <div className="flex flex-1 min-h-0">
            {/* Sidebar */}
            <div className="flex w-[210px] shrink-0 flex-col gap-2 border-r border-white/5 bg-white/[0.01] px-3 py-3">
              {/* Поиск по настройкам */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск настроек…"
                  className="h-8 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground/70 outline-none transition-all duration-150 focus:border-white/25 focus:bg-white/10"
                />
              </div>

              {/* Навигация */}
              <nav className="mt-1 flex flex-col gap-1">
                {tabs.map((tab) => {
                  const active = activeTab === tab.id && !isSearching;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setSearchQuery("");
                      }}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 cursor-pointer ${
                        active
                          ? "bg-white/10 text-foreground shadow-sm border border-white/10"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
                      }`}
                    >
                      {tab.icon}
                      {tab.title}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-auto flex flex-col gap-1 px-1">
                {isSearching && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-left"
                  >
                    ← Сбросить поиск ({visibleSections.length})
                  </button>
                )}
                <span className="text-[10px] text-muted-foreground/70">Alt+M — открыть панель</span>
              </div>
            </div>

            {/* Modal Content Scroll Area */}
            <ScrollArea className="flex-1 overflow-hidden" viewportClassName="gap-3">
              <div className="p-5">
                <IPChecker />

                {appMetaQuery.isSuccess &&
                  appMetaQuery.data &&
                  appMetaQuery.data.modStable !== import.meta.env.VITE_MOD_VERSION && (
                    <div
                      className="mb-4 py-3.5 px-4 flex flex-row justify-center items-center gap-3 bg-secondary/80 border border-border rounded-xl hover:scale-[1.01] transition-all cursor-pointer"
                      onClick={() => window.open(appMetaQuery.data.downloadUrl, "_blank", "noreferrer")}
                    >
                      <RxUpdate className="text-foreground h-6 w-6 shrink-0" fill="currentColor" />
                      <div className="flex flex-col gap-0.5 justify-center items-start">
                        <span className="text-foreground text-sm font-semibold">
                          Доступно обновление v{appMetaQuery.data.modStable}
                        </span>
                        <span className="text-muted-foreground text-xs">Нажмите, чтобы скачать новую версию</span>
                      </div>
                    </div>
                  )}

                <div
                  key={isSearching ? "search" : activeTab}
                  className={animationsEnabled ? "animate-in fade-in-0 slide-in-from-bottom-1 duration-200" : ""}
                >
                  {isSearching && (
                    <div className="mb-2 text-xs text-muted-foreground">
                      Найдено секций: <span className="text-foreground font-semibold">{visibleSections.length}</span>
                    </div>
                  )}

                  {/* Скелетон статистики */}
                  {!isSearching && activeTab === "stats" && statsSkeleton && (
                    <div className="flex flex-col gap-3.5">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-28 animate-pulse rounded-xl bg-white/[0.04]" />
                      ))}
                    </div>
                  )}

                  {!(!isSearching && activeTab === "stats" && statsSkeleton) && (
                    <div className="flex flex-col gap-3.5">
                      {visibleSections.map((section) => (
                        <div
                          key={section.tab + section.title}
                          className="transition-transform duration-200 ease-out hover:scale-[1.005]"
                        >
                          {isSearching && (
                            <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                              {tabs.find((t) => t.id === section.tab)?.title}
                            </span>
                          )}
                          {section.render()}
                        </div>
                      ))}

                      {visibleSections.length === 0 && (
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-muted-foreground">
                          Ничего не найдено по запросу «{searchQuery}»
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                Luna mod • Сделано с душой
              </span>
              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md text-muted-foreground hover:text-[#229ED9] hover:bg-[#229ED9]/10 cursor-pointer"
                  title="Мой Telegram"
                  onClick={() => window.open("https://t.me/+IcRgeI5RJqs2NDdi", "_blank", "noreferrer")}
                >
                  <FaTelegramPlane className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 cursor-pointer"
                  title="GitHub репозиторий"
                  onClick={() => window.open("https://github.com/lobzik645/YandexMusicMod", "_blank", "noreferrer")}
                >
                  <FaGithub className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-4 text-xs font-medium cursor-pointer"
              onClick={() => setIsDialogOpen(false)}
            >
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ThemeProvider>
  );
}

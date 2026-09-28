import { ThemeProvider } from "./contexts/ThemeContext";
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { ScrollArea } from "@ui/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toaster } from "@ui/components/ui/sonner";

import { Playground } from "@ui/components/playground";
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
import { NewYearSnowfall, NewYearSnowfallAnimation } from "@ui/components/snowfall-animation";
import { StatsPanel } from "@ui/components/stats-panel";

import "~/mod/features/stats/stats-tracker";
// Discord RPC: определяет window.__getPlayerState для main процесса
import "~/mod/features/discord-RPC/discordRPC";

import { Button } from "./components/ui/button";

import logo from "@ui/assets/logo.webp?inline";

import { FaGithub, FaTelegramPlane } from "react-icons/fa";
import { RxUpdate } from "react-icons/rx";
import { Paintbrush, Film, Zap, X, BarChart3 } from "lucide-react";

const IS_DEV = false;
const GITHUB_REPO_SLUG = "gagayhhad-tech/YandexMusicBetaMod-FckCensor";
const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO_SLUG}`;

type TabType = "appearance" | "background" | "modules" | "stats";

export default function App() {
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(IS_DEV);
  const [devtoolsEnabled, setDevtoolsEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("appearance");
  const [blurEnabled, setBlurEnabled] = useState(true);
  const [blurIntensity, setBlurIntensity] = useState(24);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  const appMetaQuery = useQuery({
    queryKey: ["appMeta"],
    queryFn: async () => {
      const data = await fetch(
        `https://raw.githubusercontent.com/${GITHUB_REPO_SLUG}/refs/heads/master/.meta/meta.json`,
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

  return (
    <ThemeProvider>
      <Toaster position="bottom-right" />
      <NewYearSnowfallAnimation />
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

          {/* Navigation Tabs (5 Tabs) */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-white/5 bg-white/[0.01] overflow-x-auto scrollbar-none">
            <Button
              variant={activeTab === "appearance" ? "default" : "ghost"}
              size="sm"
              className={`h-8 gap-1.5 text-xs font-medium rounded-lg cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === "appearance"
                  ? "bg-white/10 text-white border border-white/15 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("appearance")}
            >
              <Paintbrush className="h-3.5 w-3.5" />
              Внешний вид
            </Button>

            <Button
              variant={activeTab === "background" ? "default" : "ghost"}
              size="sm"
              className={`h-8 gap-1.5 text-xs font-medium rounded-lg cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === "background"
                  ? "bg-white/10 text-white border border-white/15 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("background")}
            >
              <Film className="h-3.5 w-3.5" />
              Фон
            </Button>

            <Button
              variant={activeTab === "modules" ? "default" : "ghost"}
              size="sm"
              className={`h-8 gap-1.5 text-xs font-medium rounded-lg cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === "modules"
                  ? "bg-white/10 text-white border border-white/15 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("modules")}
            >
              <Zap className="h-3.5 w-3.5" />
              Функции и модули
            </Button>

            <Button
              variant={activeTab === "stats" ? "default" : "ghost"}
              size="sm"
              className={`h-8 gap-1.5 text-xs font-medium rounded-lg cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === "stats"
                  ? "bg-white/10 text-white border border-white/15 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("stats")}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Статистика
            </Button>
          </div>

          {/* Modal Content Scroll Area */}
          <ScrollArea
            className="flex-1 overflow-hidden"
            style={{ maxHeight: 'calc(88vh - 120px)' }}
            viewportClassName="gap-3"
          >
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

              <div key={activeTab} className={animationsEnabled ? "animate-in fade-in-0 duration-200" : ""}>
                {activeTab === "appearance" && (
                  <div className="flex flex-col gap-3.5">
                    <UiCustomization />
                    <CustomThemes />
                    <FontChanger />
                    <ScaleChanger />
                  </div>
                )}

                {activeTab === "background" && (
                  <div className="flex flex-col gap-3.5">
                    <BackgroundTab />
                  </div>
                )}

                {activeTab === "modules" && (
                  <div className="flex flex-col gap-3.5">
                    <DiscordRPC />
                    <Downloader />
                    <AutoBestQuality />
                    <AutoLiker />
                    <NewYearSnowfall />
                    <Settings />
                    <Devtools />

                    {devtoolsEnabled && (
                      <>
                        <ExperimentsToggle />
                        {/* <Playground /> */}
                      </>
                    )}
                  </div>
                )}

                {activeTab === "stats" && (
                  <div className="flex flex-col gap-3.5">
                    <StatsPanel />
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

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

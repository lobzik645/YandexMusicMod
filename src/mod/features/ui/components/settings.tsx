import { useEffect, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { getAccountSettings, updateAccountSettings } from "~/mod/features/utils/api";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Label } from "@ui/components/ui/label";
import { Button } from "@ui/components/ui/button";
import { Switch } from "@ui/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { toast } from "sonner";

import { AiOutlineExperiment } from "react-icons/ai";
import { FaGithub, FaTelegramPlane } from "react-icons/fa";
import { Settings as SettingsIcon, ExternalLink } from "lucide-react";

export function Settings() {
  const [exeptionsCaptureEnabled, setExeptionsCaptureEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      setExeptionsCaptureEnabled(
        (await window.yandexMusicMod.getStorageValue("settings/exeptionsCaptureEnabled")) === false ? false : true,
      );
    })();
  }, []);

  async function handleCopyAuthData() {
    try {
      let accessToken = null;
      try {
        if (localStorage.oauth) {
          accessToken = "OAuth " + JSON.parse(localStorage.oauth).value;
        }
      } catch (e) {}

      const experimentsResponse = await axios.get("https://api.music.yandex.net/account/experiments/details", {
        method: "GET",
        headers: {
          "x-yandex-music-client": "YandexMusicDesktopAppWindows/" + (window.VERSION || "5.121.2"),
          "x-yandex-music-without-invocation-info": "1",
          Authorization: accessToken,
        },
      });

      if (experimentsResponse.status !== 200) {
        toast.error("Не удалось получить данные экспериментов");
        return;
      }

      const data = {
        accessToken,
        experiments: experimentsResponse.data,
      };

      await navigator.clipboard.writeText(JSON.stringify(data));
      toast.success("Данные авторизации скопированы");
    } catch (err) {
      toast.error("Ошибка при копировании данных авторизации");
    }
  }

  return (
    <ExpandableCard title="Настройки" icon={<SettingsIcon className="h-4 w-4" />}>
      <div className="flex flex-col gap-5 pt-2 px-3">
        <div className="flex items-center gap-3">
          <Switch
            id="settings-exeptions-capture-toggle"
            checked={exeptionsCaptureEnabled}
            onCheckedChange={(enabled) => {
              setExeptionsCaptureEnabled(enabled);
              window.yandexMusicMod.setStorageValue("settings/exeptionsCaptureEnabled", enabled);
            }}
          />
          <Label htmlFor="settings-exeptions-capture-toggle" className="cursor-pointer">
            Делиться анонимной статистикой ошибок в приложении
          </Label>
        </div>

        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleCopyAuthData} className="w-full">
                Скопировать данные авторизации
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Если разработчик попросит вас дать доступ к своему аккаунту, вы можете поделиться этими данными.</p>
              <p>Не передавайте их кому-либо еще.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Контакты и ссылки
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 text-xs font-medium justify-center bg-[#229ED9]/10 hover:bg-[#229ED9]/20 text-[#229ED9] border-[#229ED9]/30 transition-all cursor-pointer"
              onClick={() => window.open("https://t.me/+IcRgeI5RJqs2NDdi", "_blank", "noreferrer")}
            >
              <FaTelegramPlane className="h-4 w-4 shrink-0 text-[#229ED9]" />
              <span>Telegram канал</span>
              <ExternalLink className="h-3 w-3 opacity-60 ml-auto" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 text-xs font-medium justify-center bg-white/5 hover:bg-white/10 text-foreground border-white/10 transition-all cursor-pointer"
              onClick={() => window.open("https://github.com/lobzik645/YandexMusicMod", "_blank", "noreferrer")}
            >
              <FaGithub className="h-4 w-4 shrink-0" />
              <span>GitHub</span>
              <ExternalLink className="h-3 w-3 opacity-60 ml-auto" />
            </Button>
          </div>
        </div>
      </div>
    </ExpandableCard>
  );
}

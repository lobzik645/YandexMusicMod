import { toast } from "sonner";

import { getRawStats } from "~/mod/features/stats/stats-tracker";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Button } from "@ui/components/ui/button";
import { Database, FileDown, FileUp, FileJson, FileSpreadsheet } from "lucide-react";

function buildStatsCsv(stats: any): string {
  const rows = [["date", "tracks_played", "listening_time_sec", "artists"]];
  for (const [date, day] of Object.entries<any>(stats.dailyStats || {})) {
    const artists = Object.entries(day.artists || {})
      .sort((a: any, b: any) => b[1] - a[1])
      .map(([name, count]) => `${name} (${count})`)
      .join("; ");
    rows.push([date, String(day.tracksPlayed), String(day.listeningTimeSec), `"${artists}"`]);
  }
  // Excel-совместимый CSV с BOM
  return "\uFEFF" + rows.map((r) => r.join(";")).join("\n");
}

async function saveFile(defaultFileName: string, content: string, description: string) {
  const result = await window.yandexMusicMod.saveFileWithDialog({
    title: "Сохранить файл",
    defaultFileName,
    content,
  });

  if (result.success) {
    toast.success(description, { description: result.path });
  } else if (!result.cancelled) {
    toast.error("Не удалось сохранить файл", { description: result.error });
  }
}

export function BackupExportCard() {
  const exportStatsCsv = async () => {
    const stats = getRawStats();
    const hasData = stats.dailyStats && Object.keys(stats.dailyStats).length > 0;
    if (!hasData) {
      toast.warning("Статистика пока пуста");
      return;
    }
    await saveFile(`luna-stats-${new Date().toISOString().slice(0, 10)}.csv`, buildStatsCsv(stats), "Статистика экспортирована (CSV)");
  };

  const exportStatsJson = async () => {
    const stats = getRawStats();
    const hasData = stats.dailyStats && Object.keys(stats.dailyStats).length > 0;
    if (!hasData) {
      toast.warning("Статистика пока пуста");
      return;
    }
    await saveFile(
      `luna-stats-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(stats, null, 2),
      "Статистика экспортирована (JSON)",
    );
  };

  const exportSettings = async () => {
    const result = await window.yandexMusicMod.exportModSettings();
    if (result.success) {
      toast.success("Резервная копия настроек сохранена", { description: result.path });
    } else if (!result.cancelled) {
      toast.error("Не удалось сохранить бэкап", { description: result.error });
    }
  };

  const importSettings = async () => {
    const result = await window.yandexMusicMod.importModSettings();
    if (result.success) {
      toast.success("Настройки восстановлены", {
        description: "Часть настроек применится после перезапуска приложения",
      });
    } else if (!result.cancelled) {
      toast.error("Не удалось восстановить настройки", { description: result.error });
    }
  };

  return (
    <ExpandableCard title="Экспорт и резервные копии" icon={<Database className="h-4 w-4" />}>
      <div className="flex flex-col gap-4 pt-2 px-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Статистика</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-9 text-xs cursor-pointer" onClick={exportStatsCsv}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-9 text-xs cursor-pointer" onClick={exportStatsJson}>
              <FileJson className="h-3.5 w-3.5 mr-1" />
              JSON
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Настройки мода</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-9 text-xs cursor-pointer" onClick={exportSettings}>
              <FileDown className="h-3.5 w-3.5 mr-1" />
              Бэкап
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-9 text-xs cursor-pointer" onClick={importSettings}>
              <FileUp className="h-3.5 w-3.5 mr-1" />
              Восстановить
            </Button>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Бэкап содержит все настройки мода: фон, тему, качество загрузок и др.
          </span>
        </div>
      </div>
    </ExpandableCard>
  );
}

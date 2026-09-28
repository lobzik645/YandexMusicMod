import React, { useState, useEffect } from "react";
import { getStats, formatTime, resetStats, loadStats } from "~/mod/features/stats/stats-tracker";
import { BarChart3, Clock, Music2, User, TrendingUp, Trash2, Calendar, Award } from "lucide-react";
import { Button } from "@ui/components/ui/button";

export function StatsPanel() {
  const [stats, setStats] = useState(getStats());
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  useEffect(() => {
    (async () => {
      await loadStats();
      setStats(getStats());
    })();

    const interval = setInterval(() => {
      setStats(getStats());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = () => {
    resetStats();
    setStats(getStats());
    setShowConfirmReset(false);
  };

  const maxArtistTracks = stats.topArtists.length > 0 ? stats.topArtists[0].count : 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Time Period Cards Grid */}
      <div className="grid grid-cols-4 gap-2.5">
        {/* Today */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Сегодня</span>
            <Calendar className="h-3 w-3 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-foreground">{stats.today.tracks}</span>
            <span className="text-[11px] text-muted-foreground">треков</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 text-purple-400/80" />
            <span>{formatTime(stats.today.timeSec)}</span>
          </div>
        </div>

        {/* This week */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Неделя</span>
            <Calendar className="h-3 w-3 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-foreground">{stats.week.tracks}</span>
            <span className="text-[11px] text-muted-foreground">треков</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 text-emerald-400/80" />
            <span>{formatTime(stats.week.timeSec)}</span>
          </div>
        </div>

        {/* This month */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Месяц</span>
            <Calendar className="h-3 w-3 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-foreground">{stats.month.tracks}</span>
            <span className="text-[11px] text-muted-foreground">треков</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 text-amber-400/80" />
            <span>{formatTime(stats.month.timeSec)}</span>
          </div>
        </div>

        {/* All time */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Всего</span>
            <Award className="h-3 w-3 text-pink-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-foreground">{stats.allTime.tracks}</span>
            <span className="text-[11px] text-muted-foreground">треков</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 text-pink-400/80" />
            <span>{formatTime(stats.allTime.timeSec)}</span>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5 px-1">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400/80"></span>
        <span>В статистике учитываются только полностью прослушанные треки (пропущенные не засчитываются)</span>
      </div>

      {/* Top Artists List */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-400" />
            <span className="font-semibold text-sm text-foreground">Любимые исполнители</span>
            <span className="text-xs text-muted-foreground">({stats.topArtists.length})</span>
          </div>

          {!showConfirmReset ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-red-400 gap-1.5 px-2"
              onClick={() => setShowConfirmReset(true)}
            >
              <Trash2 className="h-3 w-3" />
              Сбросить историю
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400 font-medium">Точно очистить?</span>
              <Button
                variant="destructive"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={handleReset}
              >
                Да
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setShowConfirmReset(false)}
              >
                Отмена
              </Button>
            </div>
          )}
        </div>

        {stats.topArtists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground text-xs gap-1.5">
            <Music2 className="h-6 w-6 opacity-40 text-purple-400" />
            <span>Пока нет данных о прослушиваниях</span>
            <span className="text-[11px] opacity-70">Слушайте треки, и они появятся в статистике!</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 pt-1">
            {stats.topArtists.map((artist, i) => {
              const percentage = Math.round((artist.count / maxArtistTracks) * 100);
              return (
                <div
                  key={artist.name}
                  className="group relative flex items-center justify-between py-2 px-3 rounded-lg border border-white/5 bg-white/[0.015] hover:bg-white/[0.04] transition-colors overflow-hidden"
                >
                  {/* Background progress bar indicator */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-purple-500/[0.08] group-hover:bg-purple-500/[0.14] transition-all rounded-lg pointer-events-none"
                    style={{ width: `${percentage}%` }}
                  />

                  <div className="relative flex items-center gap-2.5 min-w-0 flex-1 z-1">
                    <span className={`text-[11px] font-bold w-5 shrink-0 text-center ${
                      i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-muted-foreground"
                    }`}>
                      #{i + 1}
                    </span>
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate">{artist.name}</span>
                  </div>

                  <div className="relative flex items-center gap-2 shrink-0 z-1 pl-2">
                    <span className="text-xs font-bold text-foreground">{artist.count}</span>
                    <span className="text-[10px] text-muted-foreground">треков</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

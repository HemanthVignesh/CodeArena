"use client";

import React from "react";
import { formatUtcDate, getUtcDateOffset } from "@/lib/statistics";
import { Calendar, Flame } from "lucide-react";

interface ActivityCalendarProps {
  activityMap: Record<string, number>;
  currentStreak: number;
  longestStreak: number;
}

export function ActivityCalendar({
  activityMap,
  currentStreak,
  longestStreak,
}: ActivityCalendarProps) {
  // Generate 16 weeks (112 days) ending today
  const totalDays = 112;
  const days: { dateStr: string; count: number; dayOfWeek: number }[] = [];

  for (let i = totalDays - 1; i >= 0; i--) {
    const dateStr = getUtcDateOffset(i);
    const dateObj = new Date(dateStr + "T00:00:00Z");
    const count = activityMap[dateStr] || 0;
    days.push({
      dateStr,
      count,
      dayOfWeek: dateObj.getUTCDay(), // 0 = Sun, 6 = Sat
    });
  }

  // Split into weeks of 7 days
  const weeks: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const getColorClass = (count: number) => {
    if (count === 0) return "bg-slate-900 border-slate-800/80";
    if (count === 1)
      return "bg-emerald-950/90 border-emerald-800/60 text-emerald-300";
    if (count <= 3) return "bg-emerald-700 border-emerald-600 text-white";
    return "bg-emerald-400 border-emerald-300 text-black shadow-sm shadow-emerald-400/20";
  };

  const totalActiveDays = Object.values(activityMap).filter(
    (c) => c > 0,
  ).length;
  const totalSubmissionsInPeriod = Object.values(activityMap).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <div className="p-6 rounded-2xl bg-[#0e1320] border border-slate-800/80 space-y-4 shadow-xl shadow-black/20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Submission Activity
            </h3>
            <p className="text-[11px] text-slate-400">
              Past 16 weeks ({totalSubmissionsInPeriod} submissions across{" "}
              {totalActiveDays} active days)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Current Streak:</span>
            <span className="font-bold text-amber-400">
              {currentStreak} {currentStreak === 1 ? "day" : "days"}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-slate-400">
            <span>Max Streak:</span>
            <span className="font-bold text-slate-200">{longestStreak}d</span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-1.5 min-w-full justify-between sm:justify-start">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-1.5">
              {week.map((day) => (
                <div
                  key={day.dateStr}
                  title={`${day.count} submissions on ${day.dateStr}`}
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[4px] border transition-transform hover:scale-125 cursor-pointer ${getColorClass(
                    day.count,
                  )}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-mono">
        <span>UTC Activity Calendar</span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <div className="w-3 h-3 rounded-[3px] bg-slate-900 border border-slate-800" />
          <div className="w-3 h-3 rounded-[3px] bg-emerald-950 border border-emerald-800" />
          <div className="w-3 h-3 rounded-[3px] bg-emerald-700 border border-emerald-600" />
          <div className="w-3 h-3 rounded-[3px] bg-emerald-400 border border-emerald-300" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

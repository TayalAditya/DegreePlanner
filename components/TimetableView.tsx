"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, Plus, Edit, Trash2 } from "lucide-react";

interface TimetableViewProps {
  userId: string;
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", 
  "14:00", "15:00", "16:00", "17:00", "18:00"
];

export function TimetableView({ userId }: TimetableViewProps) {
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [view, setView] = useState<"week" | "list">("week");

  const { data: timetable, isLoading } = useQuery({
    queryKey: ["timetable", userId, selectedSemester],
    queryFn: async () => {
      const res = await fetch(`/api/timetable?semester=${selectedSemester}`);
      if (!res.ok) throw new Error("Failed to fetch timetable");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-96 bg-background-secondary dark:bg-surface rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-foreground">Semester:</label>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(Number(e.target.value))}
            className="px-3 py-2 border border-border rounded-md bg-surface text-foreground focus:ring-2 focus:ring-primary"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === "week" ? "list" : "week")}
            className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground-secondary hover:bg-background-secondary"
          >
            {view === "week" ? "List View" : "Week View"}
          </button>
          <button className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Class
          </button>
        </div>
      </div>

      {view === "week" ? (
        <WeekView timetable={timetable || []} />
      ) : (
        <ListView timetable={timetable || []} />
      )}
    </div>
  );
}

function WeekView({ timetable }: { timetable: any[] }) {
  return (
    <div className="bg-surface dark:bg-surface rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-background-secondary dark:bg-background">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider w-24">
                Time
              </th>
              {DAYS.map((day) => (
                <th
                  key={day}
                  className="px-4 py-3 text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider"
                >
                  {day.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border">
            {TIME_SLOTS.map((time, idx) => (
              <tr key={time}>
                <td className="px-4 py-3 text-sm text-foreground-secondary font-medium">
                  {time}
                </td>
                {DAYS.map((day) => {
                  const entry = timetable.find(
                    (e) => e.dayOfWeek === day && e.startTime === time
                  );
                  return (
                    <td
                      key={day}
                      className="px-2 py-2 text-sm border-l border-border"
                    >
                      {entry && (
                        <div className="bg-primary bg-opacity-10 dark:bg-opacity-20 border-l-4 border-primary rounded p-2">
                          <p className="font-medium text-foreground text-xs truncate">
                            {entry.course?.code}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-foreground-secondary mt-1">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{entry.venue || "TBA"}</span>
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ListView({ timetable }: { timetable: any[] }) {
  const groupedByDay = DAYS.map((day) => ({
    day,
    classes: timetable.filter((e) => e.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));

  return (
    <div className="space-y-6">
      {groupedByDay.map(({ day, classes }) => (
        <div key={day} className="bg-surface dark:bg-surface rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">{day}</h3>
          {classes.length === 0 ? (
            <p className="text-foreground-secondary text-sm">No classes scheduled</p>
          ) : (
            <div className="space-y-3">
              {classes.map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between p-4 bg-background-secondary dark:bg-background rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{entry.course?.name}</h4>
                    <p className="text-sm text-foreground-secondary mt-1">{entry.course?.code}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-foreground-secondary">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {entry.startTime} - {entry.endTime}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {entry.venue || "TBA"}
                      </div>
                      {entry.classType && (
                        <span className="px-2 py-1 bg-primary bg-opacity-10 dark:bg-opacity-20 text-primary rounded text-xs">
                          {entry.classType}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button className="p-2 text-foreground-secondary hover:text-foreground hover:bg-background-secondary rounded">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 dark:hover:bg-opacity-20 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

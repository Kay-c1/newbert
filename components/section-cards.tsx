"use client";

import { useEffect, useState } from "react";
import DigitalClockComponent from "./digital-clock";
import { ref, onValue } from "firebase/database";
import { useAuth } from "@/app/context/auth-context";
import { rtdb } from "@/lib/firebase/firebase";

type ScheduleItem = {
  id: string;
  subject: string;
  day: string;
  time: string; // "HH:MM–HH:MM"
  createdAt: string;
};

type ExpandedScheduleItem = ScheduleItem & {
  dayOfWeek: number;
  startTime: number; // minutes from midnight
  endTime: number; // minutes from midnight
};

export function SectionCards() {
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [expandedSchedules, setExpandedSchedules] = useState<ExpandedScheduleItem[]>([]);
  const [currentSubject, setCurrentSubject] = useState<string>("None");
  const [nextSubject, setNextSubject] = useState<string>("N/A");
  const [dateTime, setDateTime] = useState(new Date());

  const daysLabel = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const formattedDate = dateTime.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Helper function to convert day abbreviations to day numbers
  const getDayNumbers = (dayString: string): number[] => {
    const dayMap: { [key: string]: number[] } = {
      MWF: [1, 3, 5],
      TuTh: [2, 4],
      MW: [1, 3],
      M: [1],
      Tu: [2],
      W: [3],
      Th: [4],
      F: [5],
      Sa: [6],
      Su: [0],
    };

    if (dayMap[dayString]) return dayMap[dayString];

    const parsed: number[] = [];
    let remaining = dayString;

    const dayPatterns = [
      { pattern: "Su", day: 0 },
      { pattern: "Sa", day: 6 },
      { pattern: "Th", day: 4 },
      { pattern: "Tu", day: 2 },
      { pattern: "M", day: 1 },
      { pattern: "W", day: 3 },
      { pattern: "F", day: 5 },
    ];

    for (const { pattern, day } of dayPatterns) {
      if (remaining.includes(pattern)) {
        parsed.push(day);
        remaining = remaining.replace(pattern, "");
      }
    }

    return parsed.sort();
  };

  const timeToMinutes = (timeString: string): number => {
    const [hours, minutes] = timeString.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const expandSchedules = (items: ScheduleItem[]): ExpandedScheduleItem[] => {
    const expanded: ExpandedScheduleItem[] = [];

    items.forEach((schedule) => {
      const dayNumbers = getDayNumbers(schedule.day);
      const [startTime, endTime] = schedule.time.split("–");

      dayNumbers.forEach((dayOfWeek) => {
        expanded.push({
          ...schedule,
          dayOfWeek,
          startTime: timeToMinutes(startTime),
          endTime: timeToMinutes(endTime),
        });
      });
    });

    return expanded.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.startTime - b.startTime;
    });
  };

  const findCurrentAndNextSubjects = (
    expanded: ExpandedScheduleItem[],
    now: Date
  ) => {
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const currentClass = expanded.find(
      (s) =>
        s.dayOfWeek === currentDay &&
        currentMinutes >= s.startTime &&
        currentMinutes < s.endTime
    );

    let nextClass: ExpandedScheduleItem | undefined;

    const laterToday = expanded.filter(
      (s) => s.dayOfWeek === currentDay && s.startTime > currentMinutes
    );

    if (laterToday.length > 0) {
      nextClass = laterToday[0];
    } else {
      // find next class in upcoming days (wrap-around)
      for (let offset = 1; offset <= 7; offset++) {
        const dayToCheck = (currentDay + offset) % 7;
        const classesThatDay = expanded.filter((s) => s.dayOfWeek === dayToCheck);
        if (classesThatDay.length > 0) {
          nextClass = classesThatDay[0];
          break;
        }
      }
    }

    setCurrentSubject(currentClass ? currentClass.subject : "None");
    setNextSubject(nextClass ? nextClass.subject : "N/A");
  };

  // ✅ Load schedules from Realtime Database
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    const scheduleRef = ref(rtdb, `users/${user.uid}/schedule`);
    const unsubscribe = onValue(scheduleRef, (snapshot) => {
      const data = snapshot.val() || {};
      const list: ScheduleItem[] = Object.entries(data).map(([id, value]) => ({
        id,
        ...(value as Omit<ScheduleItem, "id">),
      }));
      setSchedules(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  // Update expanded schedules when schedules change
  useEffect(() => {
    setExpandedSchedules(expandSchedules(schedules));
  }, [schedules]);

  // Update current/next subjects every minute
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setDateTime(now);
      findCurrentAndNextSubjects(expandedSchedules, now);
    };

    update();
    const interval = setInterval(update, 60000);

    return () => clearInterval(interval);
  }, [expandedSchedules]);

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <div data-slot="card" className="@container/card rounded-xl border bg-card text-card-foreground">
        <div className="p-6">
          <div className="text-sm text-muted-foreground">Total Subjects</div>
          <div className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? "…" : schedules.length}
          </div>
        </div>
      </div>

      <div data-slot="card" className="@container/card rounded-xl border bg-card text-card-foreground">
        <div className="p-6">
          <div className="text-sm text-muted-foreground">Current Subject</div>
          <div className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? "…" : currentSubject}
          </div>
        </div>
      </div>

      <div data-slot="card" className="@container/card rounded-xl border bg-card text-card-foreground">
        <div className="p-6">
          <div className="text-sm text-muted-foreground">Next Subject</div>
          <div className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? "…" : nextSubject}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-2 rounded-lg p-4 text-center">
        <span className="text-xl font-semibold tracking-wide">
          {daysLabel[dateTime.getDay()]}, <DigitalClockComponent />
        </span>
        <span className="text-lg text-gray-600 dark:text-gray-300">
          {formattedDate}
        </span>
      </div>
    </div>
  );
}
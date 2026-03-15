"use client";

import { useEffect, useMemo, useState } from "react";
import { ref, onValue } from "firebase/database";
import { rtdb } from "@/lib/firebase/firebase";
import { useAuth } from "@/app/context/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SubjectData = {
  subject: string;
  day: string;
  time: string; // "HH:MM–HH:MM"
};

type QuizData = {
  subjectId: string;
  subject: string;
  lesson: string;
  day: string;
  dueAt?: string;
  createdAt: string;
  completed: boolean;
  rating: number | null;
};

type ClassSession = {
  subject: string;
  dayLabel: string;
  timeLabel: string;
  startMinutes: number;
  endMinutes: number;
};

/** ---------- Helpers ---------- */
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayTokens = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];

function formatTimeTo12Hour(time24: string): string {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function formatTimeRange(timeRange: string): string {
  const [startTime, endTime] = timeRange.split("–");
  return `${formatTimeTo12Hour(startTime)} – ${formatTimeTo12Hour(endTime)}`;
}

function timeToMinutes(timeString: string): number {
  const [h, m] = timeString.split(":").map(Number);
  return h * 60 + m;
}

function expandDayString(dayString: string): string[] {
  const map: Record<string, string[]> = {
    MWF: ["M", "W", "F"],
    TuTh: ["Tu", "Th"],
    MW: ["M", "W"],
    M: ["M"],
    Tu: ["Tu"],
    W: ["W"],
    Th: ["Th"],
    F: ["F"],
    Sa: ["Sa"],
    Su: ["Su"],
  };
  if (map[dayString]) return map[dayString];

  const out: string[] = [];
  let remaining = dayString;

  const patterns = ["Su", "Sa", "Th", "Tu", "M", "W", "F"];
  for (const p of patterns) {
    if (remaining.includes(p)) {
      out.push(p);
      remaining = remaining.replace(p, "");
    }
  }
  return out;
}

function getTodayToken(): string {
  const now = new Date();
  return dayTokens[now.getDay()];
}

function getNowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatDue(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** ---------- Component ---------- */
export default function TodayPanel() {
  const { user, loading } = useAuth();
  const uid = user?.uid ?? "";

  const [schedule, setSchedule] = useState<Record<string, SubjectData>>({});
  const [quizzes, setQuizzes] = useState<Record<string, QuizData>>({});

  // Load schedule
  useEffect(() => {
    if (loading) return;
    if (!uid) return;

    const schedRef = ref(rtdb, `users/${uid}/schedule`);
    const unsub = onValue(schedRef, (snap) => {
      setSchedule((snap.val() || {}) as Record<string, SubjectData>);
    });

    return () => unsub();
  }, [uid, loading]);

  // Load quizzes
  useEffect(() => {
    if (loading) return;
    if (!uid) return;

    const quizRef = ref(rtdb, `users/${uid}/quizzes`);
    const unsub = onValue(quizRef, (snap) => {
      setQuizzes((snap.val() || {}) as Record<string, QuizData>);
    });

    return () => unsub();
  }, [uid, loading]);

  const todaysClasses = useMemo(() => {
    const today = getTodayToken();

    const list: ClassSession[] = Object.values(schedule).flatMap((s) => {
      const days = expandDayString(s.day);
      if (!days.includes(today)) return [];

      const [start, end] = s.time.split("–");
      return [
        {
          subject: s.subject,
          dayLabel: s.day,
          timeLabel: formatTimeRange(s.time),
          startMinutes: timeToMinutes(start),
          endMinutes: timeToMinutes(end),
        },
      ];
    });

    // Sort by time
    list.sort((a, b) => a.startMinutes - b.startMinutes);
    return list;
  }, [schedule]);

  const nextClassText = useMemo(() => {
    const nowMin = getNowMinutes();
    const upcoming = todaysClasses.find((c) => c.startMinutes > nowMin);
    return upcoming ? `${upcoming.subject} (${upcoming.timeLabel})` : "None";
  }, [todaysClasses]);

  const nextQuiz = useMemo(() => {
    const now = Date.now();
    const upcoming = Object.values(quizzes)
      .filter((q) => q.dueAt && !q.completed && new Date(q.dueAt).getTime() > now)
      .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());

    return upcoming[0] ?? null;
  }, [quizzes]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Today's Classes */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-lg font-semibold">Today&apos;s Classes</h3>
            <p className="text-sm text-muted-foreground">{dayNames[new Date().getDay()]}</p>
          </div>
          <Badge variant="secondary">{dayNames[new Date().getDay()]}</Badge>
        </div>

        {todaysClasses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No classes today.</p>
        ) : (
          <div className="space-y-3">
            {todaysClasses.map((c, idx) => (
              <div
                key={`${c.subject}-${idx}`}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{c.subject}</p>
                  <p className="text-sm text-muted-foreground">{c.timeLabel}</p>
                </div>
                <Badge variant="outline">{c.dayLabel}</Badge>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 text-sm">
          <span className="font-medium">Next class:</span>{" "}
          <span className="text-muted-foreground">{nextClassText}</span>
        </div>
      </Card>

      {/* Next Quiz Due */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-lg font-semibold">Next Quiz Due</h3>
            <p className="text-sm text-muted-foreground">
              Soonest quiz that isn&apos;t completed
            </p>
          </div>
          <Badge variant="secondary">{nextQuiz ? "Upcoming" : "None"}</Badge>
        </div>

        {nextQuiz ? (
          <div className="space-y-1">
            <p className="font-medium">{nextQuiz.subject}</p>
            <p className="text-sm text-muted-foreground">{nextQuiz.lesson}</p>
            <p className="text-sm">{formatDue(nextQuiz.dueAt!)}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No upcoming quizzes with due dates.
          </p>
        )}
      </Card>
    </div>
  );
}
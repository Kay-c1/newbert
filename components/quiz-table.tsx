"use client";

import { useEffect, useState } from "react";
import { ref, onValue, push, set, remove, update } from "firebase/database";
import { rtdb } from "@/lib/firebase/firebase";
import { useAuth } from "@/app/context/auth-context";
import NoQuiz from "@/public/no-quiz.svg";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Image from "next/image";
import { Trash, Star } from "lucide-react";

/** ---------------- Types ---------------- */
type DayCode = "Su" | "M" | "Tu" | "W" | "Th" | "F" | "Sa";

type SubjectData = {
  subject: string;
  day: string; // "MWF" | "TuTh" | "MW" | "TuF" | etc.
  time: string; // "HH:MM–HH:MM"
};

type QuizData = {
  subjectId: string;
  subject: string;
  lesson: string;
  day: DayCode;
  dueAt: string; // ISO
  createdAt: string; // ISO
  completed: boolean;
  rating: number | null;
};

type Quiz = QuizData & { id: string };

/** ---------------- Helpers ---------------- */
const dayTokens: DayCode[] = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];

function dayCodeToIndex(d: DayCode): number {
  return dayTokens.indexOf(d);
}

function expandDayString(dayString: string): DayCode[] {
  const map: Record<string, DayCode[]> = {
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

  const out: DayCode[] = [];
  let remaining = dayString;

  const patterns: { p: DayCode; str: string }[] = [
    { p: "Su", str: "Su" },
    { p: "Sa", str: "Sa" },
    { p: "Th", str: "Th" },
    { p: "Tu", str: "Tu" },
    { p: "M", str: "M" },
    { p: "W", str: "W" },
    { p: "F", str: "F" },
  ];

  for (const { p, str } of patterns) {
    if (remaining.includes(str)) {
      out.push(p);
      remaining = remaining.replace(str, "");
    }
  }

  return out.sort((a, b) => dayTokens.indexOf(a) - dayTokens.indexOf(b));
}

function parseTimeRange(timeRange: string) {
  const [start, end] = timeRange.split("–").map((t) => t.trim());
  return { start, end };
}

function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

function nextOccurrenceISO(targetDowIndex: number, minutesFromMidnight: number): string {
  const now = new Date();
  const candidate = new Date(now);

  const hh = Math.floor(minutesFromMidnight / 60);
  const mm = minutesFromMidnight % 60;
  candidate.setHours(hh, mm, 0, 0);

  const nowDow = now.getDay();
  let addDays = (targetDowIndex - nowDow + 7) % 7;

  if (addDays === 0 && candidate <= now) addDays = 7;

  candidate.setDate(candidate.getDate() + addDays);
  return candidate.toISOString();
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

/** ---------------- Star Rating ---------------- */
function StarRating({
  rating,
  onRate,
}: {
  rating: number;
  onRate: (rating: number) => void;
}) {
  const [hoveredRating, setHoveredRating] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRate(star)}
          onMouseEnter={() => setHoveredRating(star)}
          onMouseLeave={() => setHoveredRating(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-6 h-6 ${
              star <= (hoveredRating || rating)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

/** ---------------- Component ---------------- */
export function QuizTable() {
  const { user, loading } = useAuth();
  const uid = user?.uid ?? "";

  const [subjects, setSubjects] = useState<
    { id: string; subject: string; day: string; time: string }[]
  >([]);

  const [upcomingQuizzes, setUpcomingQuizzes] = useState<Quiz[]>([]);
  const [completedQuizzes, setCompletedQuizzes] = useState<Quiz[]>([]);

  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedDay, setSelectedDay] = useState<DayCode | "">("");
  const [lesson, setLesson] = useState("");

  const [allowedDays, setAllowedDays] = useState<DayCode[]>(dayTokens);
  const [duePreview, setDuePreview] = useState("");

  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [selectedQuizForRating, setSelectedQuizForRating] = useState<Quiz | null>(
    null
  );

  /** Load subjects */
  useEffect(() => {
    if (loading) return;
    if (!uid) return;

    const schedRef = ref(rtdb, `users/${uid}/schedule`);
    const unsub = onValue(schedRef, (snap) => {
      const data = (snap.val() || {}) as Record<string, SubjectData>;
      const subs = Object.entries(data).map(([id, value]) => ({
        id,
        subject: value.subject,
        day: value.day,
        time: value.time,
      }));
      setSubjects(subs);
    });

    return () => unsub();
  }, [uid, loading]);

  /** Load quizzes */
  useEffect(() => {
    if (loading) return;
    if (!uid) return;

    const quizzesRef = ref(rtdb, `users/${uid}/quizzes`);
    const unsub = onValue(quizzesRef, (snap) => {
      const data = (snap.val() || {}) as Record<string, QuizData>;
      const all: Quiz[] = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));

      const upcoming = all.filter((q) => !q.completed);
      const completed = all.filter((q) => q.completed);

      upcoming.sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      );
      completed.sort(
        (a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime()
      );

      setUpcomingQuizzes(upcoming);
      setCompletedQuizzes(completed);
    });

    return () => unsub();
  }, [uid, loading]);

  /** Restrict allowed days based on chosen subject schedule */
  useEffect(() => {
    if (!selectedSubject) {
      setAllowedDays(dayTokens);
      setSelectedDay("");
      return;
    }

    const subj = subjects.find((s) => s.id === selectedSubject);
    if (!subj) return;

    const expanded = expandDayString(subj.day);
    setAllowedDays(expanded);

    if (selectedDay && !expanded.includes(selectedDay as DayCode)) {
      setSelectedDay("");
    }
  }, [selectedSubject, subjects, selectedDay]);

  /** Due preview: next occurrence(selectedDay) at endTime+30min (fallback 9:00) */
  useEffect(() => {
    if (!selectedSubject || !selectedDay) {
      setDuePreview("");
      return;
    }

    const subj = subjects.find((s) => s.id === selectedSubject);
    if (!subj) return;

    let minutes = 9 * 60;
    if (subj.time?.includes("–")) {
      const { end } = parseTimeRange(subj.time);
      minutes = Math.min(timeToMinutes(end) + 30, 23 * 60 + 59);
    }

    const iso = nextOccurrenceISO(dayCodeToIndex(selectedDay as DayCode), minutes);
    setDuePreview(formatDue(iso));
  }, [selectedSubject, selectedDay, subjects]);

  /** Add quiz */
  const handleAddQuiz = async () => {
    if (loading) return;
    if (!uid) return;

    if (!selectedSubject || !selectedDay || !lesson.trim()) return;

    const subj = subjects.find((s) => s.id === selectedSubject);
    if (!subj) return;

    let minutes = 9 * 60;
    if (subj.time?.includes("–")) {
      const { end } = parseTimeRange(subj.time);
      minutes = Math.min(timeToMinutes(end) + 30, 23 * 60 + 59);
    }

    const dueAt = nextOccurrenceISO(dayCodeToIndex(selectedDay), minutes);

    const newRef = push(ref(rtdb, `users/${uid}/quizzes`));
    const payload: QuizData = {
      subjectId: subj.id,
      subject: subj.subject,
      lesson: lesson.trim(),
      day: selectedDay,
      dueAt,
      createdAt: new Date().toISOString(),
      completed: false,
      rating: null,
    };

    await set(newRef, payload);

    setLesson("");
    setSelectedSubject("");
    setSelectedDay("");
    setDuePreview("");
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!uid) return;
    await remove(ref(rtdb, `users/${uid}/quizzes/${quizId}`));
  };

  const handleMarkComplete = async (quizId: string) => {
    if (!uid) return;
    await update(ref(rtdb, `users/${uid}/quizzes/${quizId}`), { completed: true });
  };

  const handleRateQuiz = async (quiz: Quiz, rating: number) => {
    if (!uid) return;
    await update(ref(rtdb, `users/${uid}/quizzes/${quiz.id}`), { rating });
    setRatingDialogOpen(false);
    setSelectedQuizForRating(null);
  };

  /** Auto-complete if now > dueAt */
  useEffect(() => {
    if (!uid) return;
    if (upcomingQuizzes.length === 0) return;

    const now = Date.now();
    upcomingQuizzes.forEach((q) => {
      const due = new Date(q.dueAt).getTime();
      if (now > due && !q.completed) {
        update(ref(rtdb, `users/${uid}/quizzes/${q.id}`), { completed: true });
      }
    });
  }, [uid, upcomingQuizzes]);

  return (
    <div className="space-y-10">
      {/* Upcoming Quizzes */}
      <div>
        <div className="flex justify-between items-start gap-4 flex-wrap mb-4">
          <Label className="scroll-m-20 text-2xl font-semibold tracking-tight">
            Upcoming Quizzes
          </Label>

          <div className="flex gap-2 flex-wrap items-center">
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedDay}
              onValueChange={(v) => setSelectedDay(v as DayCode)}
              disabled={!selectedSubject}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                {allowedDays.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Lesson"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              className="w-[220px]"
            />

            <Button
              onClick={handleAddQuiz}
              disabled={!selectedSubject || !selectedDay || !lesson.trim() || loading}
            >
              Add
            </Button>
          </div>
        </div>

        {duePreview && (
          <p className="text-sm text-muted-foreground mb-3">
            Due preview: <span className="font-medium">{duePreview}</span>
          </p>
        )}

        {upcomingQuizzes.length === 0 ? (
          <div className="flex flex-col justify-center items-center min-h-[200px] py-8">
            <Image src={NoQuiz} alt="No upcoming quiz" width={200} />
            <p>No upcoming quiz...</p>
          </div>
        ) : (
          <Table>
            <TableCaption>Quizzes that are coming up</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Lesson</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingQuizzes.map((quiz) => (
                <TableRow key={quiz.id}>
                  <TableCell>{quiz.subject}</TableCell>
                  <TableCell>{quiz.lesson}</TableCell>
                  <TableCell>{formatDue(quiz.dueAt)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkComplete(quiz.id)}
                    >
                      Mark Done
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteQuiz(quiz.id)}
                    >
                      <Trash />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Completed Quizzes */}
      <div>
        <Label className="scroll-m-20 text-2xl font-semibold tracking-tight mb-4 block">
          Completed Quizzes
        </Label>

        {completedQuizzes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed quizzes yet.</p>
        ) : (
          <Table>
            <TableCaption>Quizzes ready to rate</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Lesson</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {completedQuizzes.map((quiz) => (
                <TableRow key={quiz.id}>
                  <TableCell>{quiz.subject}</TableCell>
                  <TableCell>{quiz.lesson}</TableCell>
                  <TableCell>{formatDue(quiz.dueAt)}</TableCell>

                  <TableCell>
                    {quiz.rating ? (
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= (quiz.rating ?? 0)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Not rated</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right space-x-2">
                    <Dialog
                      open={ratingDialogOpen && selectedQuizForRating?.id === quiz.id}
                      onOpenChange={(open) => {
                        setRatingDialogOpen(open);
                        if (!open) setSelectedQuizForRating(null);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedQuizForRating(quiz)}
                        >
                          <Star className="mr-1 w-4 h-4" />
                          {quiz.rating ? "Change Rating" : "Rate"}
                        </Button>
                      </DialogTrigger>

                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Rate Your Quiz</DialogTitle>
                          <DialogDescription>
                            How difficult was {quiz.subject} - {quiz.lesson}?
                          </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-col items-center gap-4 py-4">
                          <StarRating
                            rating={quiz.rating || 0}
                            onRate={(rating) => handleRateQuiz(quiz, rating)}
                          />
                          <p className="text-sm text-muted-foreground">
                            1 = Very Easy, 5 = Very Hard
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteQuiz(quiz.id)}
                    >
                      <Trash />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
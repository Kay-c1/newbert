"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/firebase";

const API_BASE = "http://127.0.0.1:8000";
const DEVICE_ID = "sleepwell-device-1";

type SignupReadingStatus = {
  session_id: string;
  device_id: string;
  samples_buffered: number;
  valid_samples: number;
  latest?: {
    ts: string;
    hr_bpm: number | null;
    signal: number | null;
  } | null;
  ready_to_read: boolean;
  claimed: boolean;
};

function makeSessionId() {
  return `signup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function SignupPage() {
  const router = useRouter();

  const [sessionId, setSessionId] = useState("");
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("18");
  const [sex, setSex] = useState("Male");
  const [sleepGoal, setSleepGoal] = useState("8");
  const [bedtime, setBedtime] = useState("22:00");
  const [wakeTime, setWakeTime] = useState("06:00");
  const [height, setHeight] = useState("170");
  const [weight, setWeight] = useState("65");
  const [caffeine, setCaffeine] = useState("0");
  const [exercise, setExercise] = useState("0");
  const [alcohol, setAlcohol] = useState("0");
  const [stress, setStress] = useState("5");
  const [napHabit, setNapHabit] = useState("No naps");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [readingStatus, setReadingStatus] = useState<SignupReadingStatus | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSessionId(makeSessionId());
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startSession = async () => {
      try {
        const startRes = await fetch(`${API_BASE}/start-signup-reading`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            device_id: DEVICE_ID,
          }),
        });

        if (!startRes.ok) {
          const startJson = await startRes.json().catch(() => null);
          throw new Error(startJson?.detail || "Failed to start signup reading session");
        }

        const poll = async () => {
          try {
            const res = await fetch(`${API_BASE}/signup-reading-status/${sessionId}`, {
              cache: "no-store",
            });
            const json = await res.json();
            if (res.ok) {
              setReadingStatus(json);
            }
          } catch {
            // ignore
          } finally {
            setPageLoading(false);
          }
        };

        await poll();
        intervalId = setInterval(poll, 1000);
      } catch (err: any) {
        setError(err.message || "Failed to start sensor session");
        setPageLoading(false);
      }
    };

    startSession();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!sessionId) {
      setError("Sensor session is still starting. Please wait.");
      return;
    }

    if (!readingStatus?.ready_to_read) {
      setError("Please wait until 5 sensor readings are collected before creating the account.");
      return;
    }

    setCreating(true);

    try {
      await createUserWithEmailAndPassword(auth, email, password);

      const profile = {
        name: fullName,
        age: Number(age),
        sex: sex.toLowerCase(),
        sleep_goal_hours: Number(sleepGoal),
        bedtime,
        wake_time: wakeTime,
        height_cm: Number(height),
        weight_kg: Number(weight),
        caffeine_per_day: Number(caffeine),
        exercise_per_week: Number(exercise),
        alcohol_per_week: Number(alcohol),
        stress_level: Number(stress),
        nap_habit: napHabit,
      };

      const signupRes = await fetch(`${API_BASE}/signup-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, profile }),
      });

      const signupJson = await signupRes.json();
      if (!signupRes.ok) {
        throw new Error(signupJson.detail || "Failed to create backend profile");
      }

      const finalizeRes = await fetch(`${API_BASE}/finalize-signup-reading`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          email,
        }),
      });

      const finalizeJson = await finalizeRes.json();
      if (!finalizeRes.ok) {
        throw new Error(finalizeJson.detail || "Failed to attach signup readings");
      }

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 rounded-2xl border p-4">
        <div className="text-lg font-semibold">Live sensor reading for signup</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Each new signup gets a fresh unique reading session.
        </div>

        <div className="mt-4 space-y-1 text-sm">
          <div><strong>Session:</strong> {sessionId || "Starting..."}</div>
          <div><strong>Device:</strong> {DEVICE_ID}</div>
          <div><strong>Samples collected:</strong> {readingStatus?.valid_samples ?? 0} / 5</div>
          <div>
            <strong>Status:</strong>{" "}
            {pageLoading
              ? "Starting sensor session..."
              : readingStatus?.ready_to_read
              ? "Ready to create account"
              : "Collecting live readings..."}
          </div>
          <div><strong>Latest BPM:</strong> {readingStatus?.latest?.hr_bpm ?? "—"}</div>
          <div><strong>Latest Signal:</strong> {readingStatus?.latest?.signal ?? "—"}</div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-400 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border p-6">
        <div>
          <label className="mb-1 block text-sm font-medium">Full name *</label>
          <input
            className="w-full rounded-xl border px-4 py-3"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Age *</label>
            <input
              className="w-full rounded-xl border px-4 py-3"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Sex *</label>
            <select
              className="w-full rounded-xl border px-4 py-3"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
            >
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Sleep goal (hours) *</label>
            <input
              className="w-full rounded-xl border px-4 py-3"
              type="number"
              value={sleepGoal}
              onChange={(e) => setSleepGoal(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Bedtime *</label>
            <input
              className="w-full rounded-xl border px-4 py-3"
              type="time"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Wake time *</label>
            <input
              className="w-full rounded-xl border px-4 py-3"
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Height (cm)</label>
            <input
              className="w-full rounded-xl border px-4 py-3"
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Weight (kg)</label>
            <input
              className="w-full rounded-xl border px-4 py-3"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Caffeine / day</label>
            <input
              className="w-full rounded-xl border px-4 py-3"
              type="number"
              value={caffeine}
              onChange={(e) => setCaffeine(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Exercise / week</label>
            <input
              className="w-full rounded-xl border px-4 py-3"
              type="number"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Alcohol / week</label>
            <input
              className="w-full rounded-xl border px-4 py-3"
              type="number"
              value={alcohol}
              onChange={(e) => setAlcohol(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Stress level (1-10)</label>
            <input
              className="w-full rounded-xl border px-4 py-3"
              type="number"
              value={stress}
              onChange={(e) => setStress(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Nap habit</label>
          <select
            className="w-full rounded-xl border px-4 py-3"
            value={napHabit}
            onChange={(e) => setNapHabit(e.target.value)}
          >
            <option>No naps</option>
            <option>Short naps</option>
            <option>Frequent naps</option>
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Email *</label>
            <input
              className="w-full rounded-xl border px-4 py-3"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password *</label>
            <input
              className="w-full rounded-xl border px-4 py-3"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={creating || !readingStatus?.ready_to_read}
          className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
        >
          {creating ? "Creating account..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
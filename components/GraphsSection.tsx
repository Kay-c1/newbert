"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from "recharts";

type RawPoint = {
  ts: string;
  hr_bpm: number;
  signal: number | null;
};

type MinutePoint = {
  minute: number;
  bucket_ts: string;
  samples: number;
  hr_mean: number;
  hr_std: number;
  hr_min: number;
  hr_max: number;
  hr_med: number;
  pred: number;
  prob: number;
};

type LiveGraphResponse = {
  email: string;
  samples_used: number;
  minutes_analyzed: number;
  avg_hr_minute_mean: number;
  pred_event_minutes: number;
  event_rate_pred: number;
  sleep_score: number;
  raw_series: RawPoint[];
  minute_series: MinutePoint[];
};

const API_BASE = "http://127.0.0.1:8000";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "Failed to fetch";
}

export default function GraphsSection({ email }: { email: string }) {
  const [data, setData] = useState<LiveGraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyze = async () => {
    setError("");
    setData(null);

    if (!email) {
      setError("No user email yet. Please wait for sign-in.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/analyze-live-graph/${encodeURIComponent(email)}`,
        { cache: "no-store" }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.detail || "Failed to analyze live data");
      }

      setData(json as LiveGraphResponse);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const rawChartData = useMemo(() => {
    if (!data) return [];
    return data.raw_series.map((item, index) => ({
      index,
      hr_bpm: item.hr_bpm,
      signal: item.signal ?? 0,
      ts: new Date(item.ts).toLocaleTimeString(),
    }));
  }, [data]);

  const minuteChartData = useMemo(() => {
    if (!data) return [];
    return data.minute_series.map((item) => ({
      minute: item.minute,
      hr_mean: item.hr_mean,
      hr_std: item.hr_std,
      hr_min: item.hr_min,
      hr_max: item.hr_max,
      hr_med: item.hr_med,
      prob: item.prob,
      pred: item.pred,
      bucket_ts: new Date(item.bucket_ts).toLocaleTimeString(),
      samples: item.samples,
    }));
  }, [data]);

  const predictedEventPoints = useMemo(() => {
    return minuteChartData
      .filter((x) => x.pred === 1)
      .map((x) => ({
        minute: x.minute,
        hr_mean: x.hr_mean,
      }));
  }, [minuteChartData]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sleep Analytics (Live Sensor)</h2>
          <p className="text-sm text-muted-foreground">
            Signed-in user: {email || "(loading...)"}
          </p>
        </div>

        <Button onClick={analyze} disabled={loading || !email}>
          {loading ? "Analyzing..." : "Analyze my data"}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-xs text-destructive/90">
              {error}
            </pre>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Stat label="Samples Used" value={`${data.samples_used}`} />
            <Stat label="Minutes" value={`${data.minutes_analyzed}`} />
            <Stat
              label="Avg HR"
              value={`${data.avg_hr_minute_mean.toFixed(2)} bpm`}
            />
            <Stat
              label="Pred Events"
              value={`${data.pred_event_minutes}`}
            />
            <Stat
              label="Event Rate"
              value={`${(data.event_rate_pred * 100).toFixed(1)}%`}
            />
            <Stat
              label="Sleep Score"
              value={`${data.sleep_score.toFixed(1)}/100`}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Raw Sensor Heart Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rawChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="index" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="hr_bpm"
                      name="HR BPM"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Minute Heart Rate Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={minuteChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="minute" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="hr_mean" name="HR Mean" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="hr_min" name="HR Min" dot={false} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="hr_max" name="HR Max" dot={false} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="hr_med" name="HR Median" dot={false} strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Apnea Probability Per Minute</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={minuteChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="minute" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="prob"
                      name="P(apnea event)"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Predicted Apnea Event Minutes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="minute" type="number" name="Minute" />
                    <YAxis dataKey="hr_mean" type="number" name="HR Mean" />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                    <Legend />
                    <Scatter
                      name="Predicted Event Minute"
                      data={predictedEventPoints}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
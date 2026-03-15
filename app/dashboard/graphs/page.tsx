"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function GraphsPage() {
  const [email, setEmail] = useState("test6@gmail.com");
  const [data, setData] = useState<LiveGraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchGraphs = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/analyze-live-graph/${encodeURIComponent(email)}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.detail || "Failed to analyze live sensor data");
      }

      setData(json);
    } catch (err: any) {
      setData(null);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphs();
  }, []);

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
      label: item.pred === 1 ? item.hr_mean : null,
      bucket_ts: new Date(item.bucket_ts).toLocaleTimeString(),
      samples: item.samples,
    }));
  }, [data]);

  const predictedEventPoints = useMemo(() => {
    return minuteChartData.filter((x) => x.pred === 1).map((x) => ({
      minute: x.minute,
      hr_mean: x.hr_mean,
    }));
  }, [minuteChartData]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Live Sleep Graphs</h1>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <label>Email:</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: "10px 12px",
            border: "1px solid #ccc",
            borderRadius: 8,
            minWidth: 280,
          }}
        />
        <button
          onClick={fetchGraphs}
          disabled={loading}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: "#111827",
            color: "white",
            fontWeight: 600,
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 20,
            padding: 16,
            border: "1px solid #ef4444",
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: 10,
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {data && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <StatCard title="Samples Used" value={String(data.samples_used)} />
            <StatCard title="Minutes Analyzed" value={String(data.minutes_analyzed)} />
            <StatCard title="Avg HR (minute mean)" value={`${data.avg_hr_minute_mean.toFixed(2)} bpm`} />
            <StatCard title="Predicted Event Minutes" value={String(data.pred_event_minutes)} />
            <StatCard title="Event Rate" value={`${(data.event_rate_pred * 100).toFixed(1)}%`} />
            <StatCard title="Sleep Score" value={`${data.sleep_score.toFixed(1)} / 100`} />
          </div>

          <ChartCard title="Raw Sensor Heart Rate">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={rawChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="hr_bpm" name="HR BPM" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Minute Heart Rate Features">
            <ResponsiveContainer width="100%" height={320}>
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
          </ChartCard>

          <ChartCard title="Apnea Probability Per Minute">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={minuteChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="minute" />
                <YAxis domain={[0, 1]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="prob" name="P(apnea event)" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Predicted Apnea Event Minutes">
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="minute" type="number" name="Minute" />
                <YAxis dataKey="hr_mean" type="number" name="HR Mean" />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Legend />
                <Scatter name="Predicted Event Minute" data={predictedEventPoints} />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "white",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginBottom: 24,
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "white",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  );
}
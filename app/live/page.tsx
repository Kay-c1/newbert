"use client";

import { useEffect, useState } from "react";

type LiveResponse = {
  status: string;
  email: string;
  latest: {
    ts: string;
    hr_bpm: number | null;
    signal: number | null;
  } | null;
  history: {
    ts: string;
    hr_bpm: number | null;
    signal: number | null;
  }[];
};

const API_BASE = "http://127.0.0.1:8000";

export default function LivePage() {
  const [email, setEmail] = useState("test6@gmail.com");
  const [data, setData] = useState<LiveResponse | null>(null);
  const [error, setError] = useState("");

  const loadLive = async () => {
    try {
      setError("");
      const res = await fetch(`${API_BASE}/live/${encodeURIComponent(email)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to fetch live data");
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to fetch live data");
    }
  };

  useEffect(() => {
    loadLive();
    const id = setInterval(loadLive, 2000);
    return () => clearInterval(id);
  }, [email]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Live Sensor Monitor</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
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
          onClick={loadLive}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: "#111827",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {data?.latest && (
        <div
          style={{
            padding: 16,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "white",
            marginBottom: 20,
          }}
        >
          <h2 style={{ marginBottom: 10 }}>Latest Reading</h2>
          <p><strong>BPM:</strong> {data.latest.hr_bpm ?? "—"}</p>
          <p><strong>Signal:</strong> {data.latest.signal ?? "—"}</p>
          <p><strong>Timestamp:</strong> {new Date(data.latest.ts).toLocaleString()}</p>
        </div>
      )}

      <div
        style={{
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "white",
        }}
      >
        <h2 style={{ marginBottom: 10 }}>Recent History</h2>
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Time</th>
                <th style={thStyle}>BPM</th>
                <th style={thStyle}>Signal</th>
              </tr>
            </thead>
            <tbody>
              {(data?.history ?? []).slice().reverse().map((item, idx) => (
                <tr key={idx}>
                  <td style={tdStyle}>{new Date(item.ts).toLocaleTimeString()}</td>
                  <td style={tdStyle}>{item.hr_bpm ?? "—"}</td>
                  <td style={tdStyle}>{item.signal ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #ddd",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #f1f1f1",
};
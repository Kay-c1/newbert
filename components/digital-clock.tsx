"use client";

import { useState, useEffect, useMemo } from "react";

export default function DigitalClockComponent() {
  const [time, setTime] = useState(new Date());
  const [is24Hour, setIs24Hour] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedTime = useMemo(() => {
    if (!mounted) return "";

    const hours = is24Hour
      ? time.getHours().toString().padStart(2, "0")
      : (time.getHours() % 12 || 12).toString().padStart(2, "0");

    const minutes = time.getMinutes().toString().padStart(2, "0");
    const seconds = time.getSeconds().toString().padStart(2, "0");

    // Add AM/PM only for 12-hour format
    const ampm = is24Hour ? "" : time.getHours() >= 12 ? "PM" : "AM";

    return `${hours}:${minutes}:${seconds} ${ampm}`;
  }, [time, is24Hour, mounted]);

  return formattedTime;
}

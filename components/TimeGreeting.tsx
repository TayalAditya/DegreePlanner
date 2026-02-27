"use client";

import { useEffect, useState } from "react";

function getGreetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

export function TimeGreeting({ fallback = "Welcome back" }: { fallback?: string }) {
  const [greeting, setGreeting] = useState(fallback);

  useEffect(() => {
    const update = () => setGreeting(getGreetingForHour(new Date().getHours()));
    update();

    const interval = setInterval(update, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return <>{greeting}</>;
}


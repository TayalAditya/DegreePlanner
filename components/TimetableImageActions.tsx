"use client";

import { useState } from "react";
import { Check, Copy, ImageDown, Loader2 } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

export interface TimetableImageEntry {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slot?: string | null;
  venue?: string | null;
  roomNumber?: string | null;
  building?: string | null;
  classType: string;
  instructor?: string | null;
  course?: {
    code: string;
    name: string;
  } | null;
}

interface TimetableImageActionsProps {
  semester: number;
  term: string;
  year: number;
  entries: TimetableImageEntry[];
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
const CANVAS_WIDTH = 1440;
const MARGIN = 72;
const MAX_ENTRIES_PER_IMAGE = 80;

const CLASS_LABELS: Record<string, string> = {
  LECTURE: "Lecture",
  LAB: "Lab",
  TUTORIAL: "Tutorial",
  SEMINAR: "Seminar",
  WORKSHOP: "Workshop",
  TA_DUTY: "TA Duty",
};

function readTheme() {
  const root = document.documentElement;
  const styles = window.getComputedStyle(root);
  const dark = root.classList.contains("dark");
  const value = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

  return {
    background: value("--background", dark ? "#0a0e17" : "#fafbfc"),
    backgroundSecondary: value("--background-secondary", dark ? "#10141f" : "#f3f4f7"),
    surface: value("--surface", dark ? "#131821" : "#ffffff"),
    foreground: value("--foreground", dark ? "#f5f8fc" : "#0a1117"),
    muted: value("--foreground-secondary", dark ? "#9eafc0" : "#636e7b"),
    border: value("--border", dark ? "#253349" : "#e5e7eb"),
    primary: value("--primary", "#5550ff"),
    primaryForeground: value("--primary-foreground", "#ffffff"),
  };
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ["—"];

  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function formatDay(day: string) {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

function durationLabel(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function sortedEntries(entries: TimetableImageEntry[]) {
  return [...entries].sort((first, second) =>
    DAYS.indexOf(first.dayOfWeek) - DAYS.indexOf(second.dayOfWeek)
    || first.startTime.localeCompare(second.startTime)
    || (first.course?.code ?? "").localeCompare(second.course?.code ?? ""),
  );
}

function entryDetails(entry: TimetableImageEntry) {
  return [
    CLASS_LABELS[entry.classType] ?? entry.classType,
    entry.slot ? `Slot ${entry.slot}` : null,
    entry.venue ?? entry.roomNumber ?? entry.building ?? null,
    entry.instructor ?? null,
  ].filter(Boolean).join("  ·  ");
}

export async function createTimetableImageBlob({ semester, term, year, entries }: TimetableImageActionsProps): Promise<Blob> {
  const sessions = sortedEntries(entries).slice(0, MAX_ENTRIES_PER_IMAGE);
  const scratch = document.createElement("canvas").getContext("2d");
  if (!scratch) throw new Error("Canvas is unavailable");
  scratch.font = "600 28px Inter, Arial, sans-serif";

  const grouped = DAYS.map((day) => ({
    day,
    entries: sessions.filter((entry) => entry.dayOfWeek === day).map((entry) => {
      const nameLines = wrapText(scratch, entry.course?.name ?? "Teaching Assistant Duty", CANVAS_WIDTH - MARGIN * 2 - 300);
      return { entry, nameLines, height: Math.max(112, 64 + nameLines.length * 34) };
    }),
  })).filter((group) => group.entries.length > 0);

  const headerHeight = 260;
  const dayHeaderHeight = 64;
  const dayGap = 30;
  const footerHeight = 116;
  const cardHeight = grouped.reduce(
    (total, group) => total + dayHeaderHeight + group.entries.reduce((sum, item) => sum + item.height, 0) + dayGap,
    0,
  );
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = headerHeight + cardHeight + footerHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  const theme = readTheme();

  context.fillStyle = theme.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = theme.primary;
  context.fillRect(0, 0, canvas.width, 18);

  context.fillStyle = theme.primary;
  context.beginPath();
  context.arc(MARGIN + 28, 86, 28, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = theme.primaryForeground;
  context.font = "700 25px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("DP", MARGIN + 28, 95);

  context.textAlign = "left";
  context.fillStyle = theme.foreground;
  context.font = "700 35px Inter, Arial, sans-serif";
  context.fillText("Degree Planner", MARGIN + 78, 83);
  context.fillStyle = theme.muted;
  context.font = "500 21px Inter, Arial, sans-serif";
  context.fillText("PlanMyDegree.app", MARGIN + 78, 116);

  context.fillStyle = theme.foreground;
  context.font = "700 48px Inter, Arial, sans-serif";
  context.fillText(`Semester ${semester} Timetable`, MARGIN, 183);
  context.fillStyle = theme.muted;
  context.font = "500 24px Inter, Arial, sans-serif";
  context.fillText(`${term} ${year}  ·  ${sessions.length} scheduled sessions`, MARGIN, 222);

  let y = headerHeight;
  for (const group of grouped) {
    context.fillStyle = theme.primary;
    context.fillRect(MARGIN, y, CANVAS_WIDTH - MARGIN * 2, dayHeaderHeight);
    context.fillStyle = theme.primaryForeground;
    context.font = "700 25px Inter, Arial, sans-serif";
    context.textAlign = "left";
    context.fillText(formatDay(group.day).toUpperCase(), MARGIN + 24, y + 40);
    y += dayHeaderHeight;

    group.entries.forEach(({ entry, nameLines, height }, index) => {
      context.fillStyle = index % 2 === 0 ? theme.surface : theme.backgroundSecondary;
      context.fillRect(MARGIN, y, CANVAS_WIDTH - MARGIN * 2, height);
      context.strokeStyle = theme.border;
      context.lineWidth = 1;
      context.strokeRect(MARGIN, y, CANVAS_WIDTH - MARGIN * 2, height);

      const duration = durationLabel(entry.startTime, entry.endTime);
      context.textAlign = "left";
      context.fillStyle = theme.primary;
      context.font = "700 25px ui-monospace, SFMono-Regular, Consolas, monospace";
      context.fillText(entry.course?.code ?? "TA", MARGIN + 24, y + 39);
      context.fillStyle = theme.foreground;
      context.font = "600 28px Inter, Arial, sans-serif";
      nameLines.forEach((line, lineIndex) => context.fillText(line, MARGIN + 24, y + 77 + lineIndex * 34));

      context.textAlign = "right";
      context.fillStyle = theme.foreground;
      context.font = "700 26px Inter, Arial, sans-serif";
      context.fillText(`${entry.startTime} – ${entry.endTime}`, CANVAS_WIDTH - MARGIN - 24, y + 40);
      context.fillStyle = theme.muted;
      context.font = "500 21px Inter, Arial, sans-serif";
      context.fillText([duration, entryDetails(entry)].filter(Boolean).join("  ·  "), CANVAS_WIDTH - MARGIN - 24, y + 75);
      y += height;
    });
    y += dayGap;
  }

  const footerY = canvas.height - footerHeight;
  context.fillStyle = theme.surface;
  context.fillRect(0, footerY, canvas.width, footerHeight);
  context.strokeStyle = theme.border;
  context.beginPath();
  context.moveTo(MARGIN, footerY);
  context.lineTo(CANVAS_WIDTH - MARGIN, footerY);
  context.stroke();
  context.fillStyle = theme.muted;
  context.font = "500 20px Inter, Arial, sans-serif";
  context.textAlign = "left";
  context.fillText("Save this image to your gallery or pin it for quick access.", MARGIN, footerY + 47);
  context.textAlign = "right";
  context.fillText(`Generated ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`, CANVAS_WIDTH - MARGIN, footerY + 47);
  if (entries.length > MAX_ENTRIES_PER_IMAGE) {
    context.textAlign = "left";
    context.fillStyle = theme.muted;
    context.fillText(`Showing the first ${MAX_ENTRIES_PER_IMAGE} sessions.`, MARGIN, footerY + 80);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create image"))), "image/png");
  });
}

export function TimetableImageActions(props: TimetableImageActionsProps) {
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();
  const hasEntries = props.entries.length > 0;

  const makeImage = async () => {
    if (!hasEntries) throw new Error("No timetable entries");
    return createTimetableImageBlob(props);
  };

  const handleDownload = async () => {
    setCreating(true);
    try {
      const image = await makeImage();
      const url = URL.createObjectURL(image);
      const link = document.createElement("a");
      link.href = url;
      link.download = `planmydegree-sem-${props.semester}-timetable.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast("success", "Timetable image downloaded — save it to your gallery or pin it.");
    } catch {
      showToast("error", "Could not create your timetable image");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      showToast("warning", "Your browser cannot copy images. Use Get as Photo to save it instead.");
      return;
    }
    setCreating(true);
    try {
      const image = await makeImage();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
      setCopied(true);
      showToast("success", "Timetable image copied — paste it anywhere to save or share.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast("error", "Could not copy the timetable image");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex w-full gap-2 sm:w-auto">
      <button
        type="button"
        onClick={handleDownload}
        disabled={creating || !hasEntries}
        className="flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
      >
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
        {creating ? "Preparing..." : "Get as Photo"}
      </button>
      <button
        type="button"
        onClick={handleCopy}
        disabled={creating || !hasEntries}
        className="flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy Image"}
      </button>
    </div>
  );
}

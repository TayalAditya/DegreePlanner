"use client";

import { useState } from "react";
import { ImageDown } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

type RegistrationType = "REGULAR" | "PASS_FAIL" | "AUDIT";

interface PlanImageCourse {
  code: string;
  name: string;
  credits: number;
  instructor: string | null;
  slots: string | null;
  category: string;
  registrationType: RegistrationType;
}

interface PlanImageDownloadButtonProps {
  semester: number;
  term: string;
  year: number;
  studentName?: string | null;
  branch?: string | null;
  courses: PlanImageCourse[];
  categoryLabels: Record<string, string>;
}

const CANVAS_WIDTH = 1800;
const MARGIN = 92;
const TABLE_WIDTH = CANVAS_WIDTH - MARGIN * 2;
const COLUMNS = [
  { label: "Code", width: 210 },
  { label: "Course", width: 645 },
  { label: "Credits", width: 130 },
  { label: "Faculty", width: 310 },
  { label: "Slot", width: 150 },
  { label: "Type", width: 171 },
] as const;

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["—"];

  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  centerY: number,
  lineHeight: number,
  align: CanvasTextAlign = "left"
) {
  context.textAlign = align;
  const firstBaseline = centerY - ((lines.length - 1) * lineHeight) / 2 + 8;
  lines.forEach((line, index) => context.fillText(line, x, firstBaseline + index * lineHeight));
}

function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = "/logo.jpg";
  });
}

function registrationLabel(course: PlanImageCourse, categoryLabels: Record<string, string>) {
  if (course.registrationType === "PASS_FAIL") return "P/F -> FE";
  if (course.registrationType === "AUDIT") return "Audit - not in degree";
  return `Regular - ${categoryLabels[course.category] ?? course.category}`;
}

async function renderPlanImage({
  semester,
  term,
  year,
  studentName,
  branch,
  courses,
  categoryLabels,
}: PlanImageDownloadButtonProps): Promise<Blob> {
  const scratch = document.createElement("canvas");
  const scratchContext = scratch.getContext("2d");
  if (!scratchContext) throw new Error("Canvas is unavailable");

  scratchContext.font = "500 26px Inter, Arial, sans-serif";
  const rows = courses.map((course) => {
    const cells = [
      [course.code],
      wrapText(scratchContext, course.name, COLUMNS[1].width - 30),
      [`${course.credits % 1 === 0 ? course.credits.toFixed(0) : course.credits.toFixed(2).replace(/0+$/, "")} cr`],
      wrapText(scratchContext, course.instructor ?? "—", COLUMNS[3].width - 30),
      wrapText(scratchContext, course.slots ?? "—", COLUMNS[4].width - 30),
      wrapText(scratchContext, registrationLabel(course, categoryLabels), COLUMNS[5].width - 30),
    ];
    const maxLines = Math.max(...cells.map((cell) => cell.length));
    return { cells, height: Math.max(70, maxLines * 34 + 30) };
  });

  const headerHeight = 270;
  const tableHeaderHeight = 62;
  const footerHeight = 174;
  const tableHeight = tableHeaderHeight + rows.reduce((total, row) => total + row.height, 0);
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = headerHeight + tableHeight + footerHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");

  const logo = await loadLogo();
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0b78b5";
  context.fillRect(0, 0, canvas.width, 18);

  if (logo) {
    context.drawImage(logo, MARGIN, 56, 84, 84);
  }
  context.fillStyle = "#102a43";
  context.font = "700 36px Inter, Arial, sans-serif";
  context.fillText("Degree Planner", MARGIN + 106, 92);
  context.fillStyle = "#486581";
  context.font = "500 22px Inter, Arial, sans-serif";
  context.fillText("PlanMyDegree.app", MARGIN + 106, 126);

  context.fillStyle = "#102a43";
  context.font = "700 48px Inter, Arial, sans-serif";
  context.fillText(`Semester ${semester} Pre-Registration Plan`, MARGIN, 198);
  context.fillStyle = "#486581";
  context.font = "500 24px Inter, Arial, sans-serif";
  const studentDetail = [studentName, branch].filter(Boolean).join("  |  ");
  context.fillText(`${term} ${year}${studentDetail ? `  |  ${studentDetail}` : ""}`, MARGIN, 235);

  const degreeCredits = courses
    .filter((course) => course.registrationType !== "AUDIT")
    .reduce((total, course) => total + course.credits, 0);
  const auditCredits = courses
    .filter((course) => course.registrationType === "AUDIT")
    .reduce((total, course) => total + course.credits, 0);
  context.textAlign = "right";
  context.fillStyle = "#0b78b5";
  context.font = "700 28px Inter, Arial, sans-serif";
  context.fillText(`${degreeCredits % 1 === 0 ? degreeCredits.toFixed(0) : degreeCredits.toFixed(2).replace(/0+$/, "")} degree credits`, CANVAS_WIDTH - MARGIN, 198);
  context.fillStyle = "#486581";
  context.font = "500 22px Inter, Arial, sans-serif";
  const auditDetail = auditCredits > 0 ? `  |  ${auditCredits} audit credits excluded` : "";
  context.fillText(`${courses.length} courses${auditDetail}`, CANVAS_WIDTH - MARGIN, 235);

  let y = headerHeight;
  context.fillStyle = "#0b78b5";
  context.fillRect(MARGIN, y, TABLE_WIDTH, tableHeaderHeight);
  context.fillStyle = "#ffffff";
  context.font = "700 21px Inter, Arial, sans-serif";
  let columnX = MARGIN;
  COLUMNS.forEach((column, index) => {
    const textX = index === 2 ? columnX + column.width / 2 : columnX + 15;
    context.textAlign = index === 2 ? "center" : "left";
    context.fillText(column.label.toUpperCase(), textX, y + 39);
    columnX += column.width;
  });
  y += tableHeaderHeight;

  rows.forEach((row, rowIndex) => {
    context.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#f1f5f9";
    context.fillRect(MARGIN, y, TABLE_WIDTH, row.height);
    context.strokeStyle = "#d9e2ec";
    context.lineWidth = 1;
    context.strokeRect(MARGIN, y, TABLE_WIDTH, row.height);

    let x = MARGIN;
    context.fillStyle = "#243b53";
    context.font = "500 26px Inter, Arial, sans-serif";
    row.cells.forEach((lines, index) => {
      if (index === 0) {
        context.fillStyle = "#0b78b5";
        context.font = "700 24px ui-monospace, SFMono-Regular, Consolas, monospace";
      } else if (index === 1) {
        context.fillStyle = "#102a43";
        context.font = "600 26px Inter, Arial, sans-serif";
      } else if (index === 5) {
        context.fillStyle = row.cells[5][0].startsWith("Audit") ? "#9c5d00" : "#334e68";
        context.font = "600 22px Inter, Arial, sans-serif";
      } else {
        context.fillStyle = "#334e68";
        context.font = "500 24px Inter, Arial, sans-serif";
      }
      const textX = index === 2 ? x + COLUMNS[index].width / 2 : x + 15;
      drawLines(context, lines, textX, y + row.height / 2, 34, index === 2 ? "center" : "left");
      x += COLUMNS[index].width;
    });
    y += row.height;
  });

  if (logo) {
    context.save();
    context.globalAlpha = 0.035;
    const watermarkSize = Math.min(520, canvas.height * 0.28);
    context.drawImage(logo, (CANVAS_WIDTH - watermarkSize) / 2, headerHeight + (tableHeight - watermarkSize) / 2, watermarkSize, watermarkSize);
    context.restore();
  }

  const footerY = headerHeight + tableHeight;
  context.fillStyle = "#ffffff";
  context.fillRect(0, footerY, CANVAS_WIDTH, footerHeight);
  context.strokeStyle = "#d9e2ec";
  context.beginPath();
  context.moveTo(MARGIN, footerY);
  context.lineTo(CANVAS_WIDTH - MARGIN, footerY);
  context.stroke();

  context.strokeStyle = "#829ab1";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(MARGIN, footerY + 98);
  context.lineTo(MARGIN + 440, footerY + 98);
  context.stroke();
  context.fillStyle = "#486581";
  context.font = "500 20px Inter, Arial, sans-serif";
  context.textAlign = "left";
  context.fillText("Student signature", MARGIN, footerY + 130);

  context.textAlign = "right";
  context.fillStyle = "#102a43";
  context.font = "700 23px Inter, Arial, sans-serif";
  context.fillText("Generated via PlanMyDegree.app", CANVAS_WIDTH - MARGIN, footerY + 84);
  context.fillStyle = "#486581";
  context.font = "500 20px Inter, Arial, sans-serif";
  context.fillText(`Created by Aditya Tayal  |  ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`, CANVAS_WIDTH - MARGIN, footerY + 118);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create image"))), "image/png");
  });
}

export function PlanImageDownloadButton(props: PlanImageDownloadButtonProps) {
  const [creatingImage, setCreatingImage] = useState(false);
  const { showToast } = useToast();

  const handleDownload = async () => {
    setCreatingImage(true);
    try {
      const image = await renderPlanImage(props);
      const url = URL.createObjectURL(image);
      const link = document.createElement("a");
      link.href = url;
      link.download = `planmydegree-sem-${props.semester}-plan.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("success", "Plan image downloaded");
    } catch {
      showToast("error", "Could not create your plan image");
    } finally {
      setCreatingImage(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={creatingImage}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      <ImageDown className="h-4 w-4" />
      {creatingImage ? "Preparing..." : "Get as Photo"}
    </button>
  );
}

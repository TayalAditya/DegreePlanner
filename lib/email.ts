import nodemailer from "nodemailer";

/**
 * Gmail SMTP transport backed by an app password.
 * GMAIL_USER + GMAIL_APP_PASSWORD must be set (app password stored with spaces stripped).
 * Created lazily so a missing config doesn't crash the app on import.
 */
let cachedTransport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter {
  if (cachedTransport) return cachedTransport;

  const user = process.env.GMAIL_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!user || !pass) {
    throw new Error(
      "Email not configured — set GMAIL_USER and GMAIL_APP_PASSWORD environment variables."
    );
  }

  cachedTransport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  return cachedTransport;
}

export interface SamarthReportRow {
  rollNumber: string;
  studentName: string;
  batchYear: number;
  branch: string;
  courseCode: string;
  courseName: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Send a digest of "not on Samarth" course reports to the academic secretary.
 * Body is a tab-separated table so rows paste straight into Excel columns.
 */
export async function sendSamarthDigest(rows: SamarthReportRow[]): Promise<void> {
  if (rows.length === 0) return;

  const to = process.env.SAMARTH_DIGEST_TO || "b23243@students.iitmandi.ac.in";
  const from = process.env.GMAIL_USER!;

  // HTML grid (top): full detail incl. Roll + Name.
  const htmlHeader = ["Roll", "Name", "Year", "Branch", "Course"];
  const htmlDataRows = rows.map((r) => [
    r.rollNumber,
    r.studentName,
    String(r.batchYear),
    r.branch,
    `${r.courseCode} ${r.courseName}`.trim(),
  ]);

  // Excel-paste block (bottom): only Year / Branch / Course.
  const pasteHeader = ["Year", "Branch", "Course"];
  const pasteRows = rows.map((r) => [
    String(r.batchYear),
    r.branch,
    `${r.courseCode} ${r.courseName}`.trim(),
  ]);
  const text =
    [pasteHeader, ...pasteRows].map((cols) => cols.join("\t")).join("\n") + "\n";

  const htmlRows = htmlDataRows
    .map(
      (cols) =>
        "<tr>" +
        cols.map((c) => `<td style="padding:4px 10px;border:1px solid #ddd">${escapeHtml(c)}</td>`).join("") +
        "</tr>"
    )
    .join("");
  const html = `
    <p>Courses students report as <strong>not visible on Samarth</strong> (${rows.length}):</p>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px">
      <thead>
        <tr>${htmlHeader.map((h) => `<th style="padding:4px 10px;border:1px solid #ddd;background:#f4f4f4;text-align:left">${h}</th>`).join("")}</tr>
      </thead>
      <tbody>${htmlRows}</tbody>
    </table>
    <p style="color:#888;font-size:12px">Tip: copy the plain-text version below to paste directly into Excel columns (Year / Branch / Course).</p>
    <pre style="font-family:monospace;font-size:12px;background:#f8f8f8;padding:10px;border:1px solid #eee;white-space:pre">${escapeHtml(text)}</pre>
  `;

  await getTransport().sendMail({
    from: `Degree Planner <${from}>`,
    to,
    subject: `Samarth pre-reg gaps — ${rows.length} course${rows.length !== 1 ? "s" : ""}`,
    text,
    html,
  });
}

export interface FeedbackRow {
  userName: string;
  rollNumber: string;
  branch: string;
  rating: number;
  emoji: string | null;
  message: string | null;
  createdAt: Date;
}

function renderStars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export async function sendFeedbackDigest(rows: FeedbackRow[]): Promise<void> {
  if (rows.length === 0) return;

  const to = process.env.FEEDBACK_DIGEST_TO || "b23243@students.iitmandi.ac.in";
  const from = process.env.GMAIL_USER!;

  const avgRating = (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1);

  const htmlHeader = ["Name", "Roll", "Branch", "Rating", "Reaction", "Message", "Date"];
  const htmlDataRows = rows.map((r) => [
    r.userName,
    r.rollNumber,
    r.branch,
    renderStars(r.rating),
    r.emoji || "—",
    r.message ? escapeHtml(r.message.slice(0, 200)) : "—",
    r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
  ]);

  const text = rows
    .map((r) => `${r.userName} (${r.rollNumber}, ${r.branch}): ${renderStars(r.rating)} ${r.emoji || ""} — ${r.message || "No message"}`)
    .join("\n");

  const tableRows = htmlDataRows
    .map(
      (cols) =>
        "<tr>" +
        cols.map((c) => `<td style="padding:6px 10px;border:1px solid #ddd">${c}</td>`).join("") +
        "</tr>"
    )
    .join("");

  const html = `
    <h2 style="font-family:sans-serif;color:#333">PlanMyDegree Feedback</h2>
    <p style="font-family:sans-serif;font-size:14px;color:#555">
      <strong>${rows.length}</strong> new response${rows.length !== 1 ? "s" : ""} · Average rating: <strong>${avgRating}/5</strong>
    </p>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;width:100%">
      <thead>
        <tr>${htmlHeader.map((h) => `<th style="padding:6px 10px;border:1px solid #ddd;background:#f4f4f4;text-align:left">${h}</th>`).join("")}</tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <p style="color:#888;font-size:12px;margin-top:16px">— Degree Planner Feedback System</p>
  `;

  await getTransport().sendMail({
    from: `PlanMyDegree Feedback <${from}>`,
    to,
    subject: `PlanMyDegree Feedback — ${rows.length} new response${rows.length !== 1 ? "s" : ""} (avg ${avgRating}★)`,
    text,
    html,
  });
}

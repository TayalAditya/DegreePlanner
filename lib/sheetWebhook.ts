/**
 * Thin helper to append a row to a Google Sheet via a Google Apps Script
 * web-app webhook. The Apps Script's doPost(e) parses the JSON body and does
 * sheet.getSheetByName(payload.tab).appendRow([...]).
 *
 * Env-gated: if GOOGLE_SHEET_WEBHOOK_URL isn't set, this is a no-op so local
 * dev / preview never fails on a missing webhook. Failures are swallowed and
 * logged — the caller's DB write is the source of truth, the sheet is a mirror.
 */
export async function postToSheet(payload: Record<string, unknown>): Promise<boolean> {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!url) {
    console.warn("[sheet-webhook] GOOGLE_SHEET_WEBHOOK_URL not set — skipping sheet append");
    return false;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Apps Script web apps redirect to a googleusercontent.com URL on success;
      // fetch follows it by default. Guard with a timeout so a hung webhook
      // never blocks the request for long.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[sheet-webhook] append failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[sheet-webhook] append error:", e);
    return false;
  }
}

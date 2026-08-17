/**
 * Thin helper to append a row to a Google Sheet via a Google Apps Script
 * web-app webhook. The Apps Script's doPost(e) parses the JSON body and appends
 * `payload.row` (or the legacy flat fields) to `payload.tab`. The script itself
 * lives at scripts/apps-script/sheet-webhook.gs.
 *
 * AUTH — the webhook is deployed with "Who has access: Anyone", which it must be
 * for this app to reach it. That means the URL is the only thing gating writes,
 * so it is NOT hardcoded here: a previous version shipped it as a fallback
 * constant, and since this repo is public that handed anyone the ability to
 * append fake rows to the Academic Secretary's sheet. It is now env-only, and
 * every request carries DP_SHEET_WEBHOOK_SECRET, which the script verifies.
 *
 * Env-gated: with no GOOGLE_SHEET_WEBHOOK_URL this is a no-op, so local dev and
 * previews never fail on a missing webhook. Failures are logged and swallowed —
 * the caller's DB write is the source of truth, the sheet is a mirror — but the
 * boolean return says whether the mirror actually happened, so callers can tell
 * the user their row may lag instead of claiming success.
 */
export async function postToSheet(payload: Record<string, unknown>): Promise<boolean> {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!url) {
    console.warn("[sheet-webhook] GOOGLE_SHEET_WEBHOOK_URL is not set — skipping sheet mirror");
    return false;
  }

  const secret = process.env.DP_SHEET_WEBHOOK_SECRET;
  if (!secret) {
    // Not fatal: the script accepts unauthenticated writes until its own secret
    // property is set, so this still works — but it means the endpoint is open.
    console.warn("[sheet-webhook] DP_SHEET_WEBHOOK_SECRET is not set — posting unauthenticated");
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(secret ? { ...payload, secret } : payload),
      // Apps Script web apps redirect to a googleusercontent.com URL on success;
      // fetch follows it by default. Guard with a timeout so a hung webhook
      // never blocks the request for long.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error("[sheet-webhook] append failed:", res.status, await res.text().catch(() => ""));
      return false;
    }

    // Apps Script ALWAYS replies 200 — a rejected secret, an unbound
    // spreadsheet or a thrown error all arrive as `200 {"ok":false,...}`. So the
    // HTTP status proves nothing and the body has to be checked, otherwise a
    // silently-dropped row looks like a clean success.
    const bodyText = await res.text().catch(() => "");
    let ok: boolean | undefined;
    try {
      ok = (JSON.parse(bodyText) as { ok?: boolean }).ok;
    } catch {
      ok = undefined;
    }

    if (ok === false) {
      console.error("[sheet-webhook] script rejected the append:", bodyText.slice(0, 300));
      return false;
    }
    if (ok === undefined) {
      // Not JSON — usually a Google sign-in interstitial, i.e. the deployment's
      // access is no longer "Anyone".
      console.error("[sheet-webhook] unexpected non-JSON response:", bodyText.slice(0, 200));
      return false;
    }

    return true;
  } catch (e) {
    console.error("[sheet-webhook] append error:", e);
    return false;
  }
}

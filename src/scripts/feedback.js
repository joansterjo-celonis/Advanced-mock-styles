// ============================================================
//  Feedback seam — INFRASTRUCTURE ONLY (no feature yet).
//
//  The real feedback widget/collection lands here later. For now this
//  reads its config from Vite env vars and stays dormant unless an
//  endpoint is configured, so it can never affect the prototype today.
//
//  Config (see .env.example):
//    VITE_FEEDBACK_ENDPOINT  – POST target that collects submissions
//    VITE_FEEDBACK_PROJECT   – optional project / board id
//
//  Local dev : put these in .env.local (gitignored).
//  CI / Pages: set them as GitHub Actions secrets — already wired into
//              .github/workflows/deploy.yml as build-time env.
// ============================================================

const ENDPOINT = import.meta.env.VITE_FEEDBACK_ENDPOINT || '';
const PROJECT = import.meta.env.VITE_FEEDBACK_PROJECT || '';

export function isEnabled() { return !!ENDPOINT; }

/** Submit a feedback payload. No-op (resolves false) until an endpoint is configured. */
export async function sendFeedback(payload) {
  if (!ENDPOINT) {
    if (import.meta.env.DEV) console.info('[feedback] disabled — set VITE_FEEDBACK_ENDPOINT to enable.');
    return false;
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: PROJECT, ts: Date.now(), ...payload }),
    });
    return res.ok;
  } catch (err) {
    console.error('[feedback] send failed', err);
    return false;
  }
}

/** Mount point for the future feedback UI. Dormant until the feature is built. */
export function initFeedback() {
  if (import.meta.env.DEV) console.info('[feedback] seam ready · enabled =', isEnabled());
  // TODO(feedback feature): build + mount the feedback widget here, calling sendFeedback().
}

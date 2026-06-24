// ============================================================
//  Cloud store — shared JSONBin.io backend for the feedback
//  feature and the synced theme/preset library.
//
//  Two bins (a "feedback" bin and a "themes" bin), each holding a
//  single JSON document of the shape { items: [...], updatedAt }.
//  Writes are read-modify-write (last-write-wins) — fine for the
//  small group using this access-gated prototype.
//
//  Config (see .env.example):
//    VITE_JSONBIN_KEY           – JSONBin Access Key (read+write to both bins)
//    VITE_JSONBIN_FEEDBACK_BIN  – feedback bin id  (defaulted below)
//    VITE_JSONBIN_THEMES_BIN    – themes bin id    (defaulted below)
//
//  The bin ids are safe to default in source; the KEY must NOT be —
//  put it in .env.local (dev) or a GitHub Actions secret (deploy).
//  When no key is configured the store transparently falls back to
//  localStorage, so dev works offline and the feature never throws.
// ============================================================

const API = 'https://api.jsonbin.io/v3/b';

const KEY = (import.meta.env.VITE_JSONBIN_KEY || '').trim();
export const FEEDBACK_BIN = (import.meta.env.VITE_JSONBIN_FEEDBACK_BIN || '6a3a29afda38895dfeefd1c8').trim();
export const THEMES_BIN = (import.meta.env.VITE_JSONBIN_THEMES_BIN || '6a3a2d92da38895dfeefdfb6').trim();

export function isCloudEnabled() { return !!KEY; }

/* ---------- low-level bin IO ---------- */

function lsKey(bin) { return 'cloud-bin-' + bin; }

function lsRead(bin) {
  try { const r = JSON.parse(localStorage.getItem(lsKey(bin))); return r && typeof r === 'object' ? r : { items: [] }; }
  catch (e) { return { items: [] }; }
}
function lsWrite(bin, doc) {
  try { localStorage.setItem(lsKey(bin), JSON.stringify(doc)); return true; } catch (e) { return false; }
}

/* ---------- pending (unsynced) write queue ----------
   When the cloud is enabled but a write fails (offline, transient error),
   the entry is parked here so it survives reloads and is retried on the
   next read — instead of silently vanishing. */
function pendKey(bin) { return 'cloud-pending-' + bin; }
function pendRead(bin) {
  try { const r = JSON.parse(localStorage.getItem(pendKey(bin))); return Array.isArray(r) ? r : []; }
  catch (e) { return []; }
}
function pendWrite(bin, arr) {
  try { localStorage.setItem(pendKey(bin), JSON.stringify(arr || [])); } catch (e) { /* noop */ }
}
function pendAdd(bin, entry) {
  const arr = pendRead(bin);
  if (!arr.some(e => e && e.id === entry.id)) arr.push(entry);
  pendWrite(bin, arr);
}
function pendRemove(bin, ids) {
  const set = new Set(ids);
  pendWrite(bin, pendRead(bin).filter(e => e && !set.has(e.id)));
}

/** Read a bin's document ({ items, updatedAt }). Falls back to localStorage. */
export async function getBin(bin) {
  if (!KEY) return lsRead(bin);
  try {
    const res = await fetch(API + '/' + bin + '/latest', {
      method: 'GET',
      headers: { 'X-Access-Key': KEY, 'X-Bin-Meta': 'false' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('GET ' + res.status);
    const data = await res.json();
    // With X-Bin-Meta:false JSONBin returns the raw record; older shapes wrap it in {record}.
    const rec = (data && data.record !== undefined) ? data.record : data;
    if (Array.isArray(rec)) return { items: rec };
    return rec && typeof rec === 'object' ? rec : { items: [] };
  } catch (err) {
    console.warn('[cloud] read failed for bin', bin, '— using local cache', err);
    return lsRead(bin);
  }
}

/** Overwrite a bin's document. Mirrors to localStorage as a cache. */
export async function putBin(bin, doc) {
  const payload = { ...doc, updatedAt: Date.now() };
  lsWrite(bin, payload); // keep the local cache warm regardless
  if (!KEY) return true;
  try {
    const res = await fetch(API + '/' + bin, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Access-Key': KEY },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('PUT ' + res.status);
    return true;
  } catch (err) {
    console.error('[cloud] write failed for bin', bin, err);
    return false;
  }
}

/* ---------- feedback collection ---------- */

/** Read a collection's items, retrying any unsynced local writes and
 *  unioning ones not yet on the server so nothing is lost on reload. */
async function readItemsResilient(bin) {
  const doc = await getBin(bin);
  const cloudItems = Array.isArray(doc.items) ? doc.items : [];
  // Local-only mode: getBin already returned the local cache, which holds everything.
  if (!KEY) return cloudItems;

  const pending = pendRead(bin);
  if (!pending.length) return cloudItems;

  const cloudIds = new Set(cloudItems.map(e => e && e.id));
  const missing = pending.filter(e => e && !cloudIds.has(e.id));
  if (!missing.length) { pendRemove(bin, pending.map(e => e.id)); return cloudItems; }

  // Retry flushing the unsynced entries onto the server.
  const merged = [...cloudItems, ...missing];
  const ok = await putBin(bin, { items: merged });
  if (ok) pendRemove(bin, pending.map(e => e.id));
  // Either way, surface them so the author never sees their note disappear.
  return merged;
}

export async function getFeedback() {
  return readItemsResilient(FEEDBACK_BIN);
}

/** Append one feedback entry (read-modify-write to avoid clobbering peers).
 *  If the cloud write fails, the entry is queued for retry on next read. */
export async function addFeedback(entry) {
  const doc = await getBin(FEEDBACK_BIN);
  const items = Array.isArray(doc.items) ? doc.items : [];
  items.push(entry);
  const ok = await putBin(FEEDBACK_BIN, { items });
  if (!ok && KEY) pendAdd(FEEDBACK_BIN, entry);
  return ok;
}

export async function deleteFeedback(id) {
  pendRemove(FEEDBACK_BIN, [id]); // never resurrect an explicitly deleted note
  const doc = await getBin(FEEDBACK_BIN);
  const items = (Array.isArray(doc.items) ? doc.items : []).filter(e => e && e.id !== id);
  return putBin(FEEDBACK_BIN, { items });
}

/* ---------- themes collection ---------- */

export async function getThemes() {
  const doc = await getBin(THEMES_BIN);
  return Array.isArray(doc.items) ? doc.items : [];
}

/** Merge this owner's presets into the shared library by id (upsert). Never drops a
 *  preset merely because it's absent from `ownerPresets` (other device, partial cache,
 *  or a name collision) — only ids in `deletedIds`, and only when this owner owns them,
 *  are removed. This makes save/add non-destructive to peers and to your own devices. */
export async function syncThemes(owner, ownerPresets, deletedIds = []) {
  const doc = await getBin(THEMES_BIN);
  const items = Array.isArray(doc.items) ? doc.items : [];
  const byId = new Map(items.filter(p => p && p.id).map(p => [p.id, p]));
  (deletedIds || []).forEach(id => {
    const ex = byId.get(id);
    if (ex && ex.owner === owner) byId.delete(id);   // honor explicit deletes of my own only
  });
  (ownerPresets || []).forEach(p => { if (p && p.id) byId.set(p.id, { ...p, owner }); });
  return putBin(THEMES_BIN, { items: [...byId.values()] });
}

/** Back-compat alias for the previous owner-bucket API (no explicit deletions). */
export async function syncOwnerThemes(owner, ownerPresets) {
  return syncThemes(owner, ownerPresets, []);
}

/* ---------- author identity (asked once, reused everywhere) ---------- */

const AUTHOR_KEY = 'fb-author';

export function getAuthor() {
  try { return (localStorage.getItem(AUTHOR_KEY) || '').trim() || null; } catch (e) { return null; }
}
export function setAuthor(name) {
  try { localStorage.setItem(AUTHOR_KEY, (name || '').trim()); } catch (e) { /* noop */ }
}

// Best-effort default suggestion from the access gate's Google profile.
function suggestedName() {
  try {
    const meta = JSON.parse(localStorage.getItem('proto-access-meta') || 'null');
    if (meta && meta.detail && meta.detail.name) return String(meta.detail.name);
  } catch (e) { /* noop */ }
  return '';
}

/** Resolve the author name, prompting once with a small modal if unknown. */
export async function ensureAuthor() {
  const existing = getAuthor();
  if (existing) return existing;
  const name = await promptAuthor(suggestedName());
  if (name) setAuthor(name);
  return name;
}

function promptAuthor(initial) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fb-author-overlay';
    overlay.innerHTML = `
      <div class="fb-author-card" role="dialog" aria-modal="true" aria-label="Your name">
        <div class="fb-author-title">What's your name?</div>
        <div class="fb-author-sub">Shown next to the feedback and themes you share. You'll only be asked once.</div>
        <input type="text" class="fb-author-input" maxlength="40" placeholder="Name or initials" spellcheck="false" autocomplete="name" />
        <div class="fb-author-actions">
          <button type="button" class="fb-btn fb-btn-primary fb-author-ok">Continue</button>
        </div>
      </div>`;
    const input = overlay.querySelector('.fb-author-input');
    const ok = overlay.querySelector('.fb-author-ok');
    input.value = initial || '';

    function done() {
      const v = (input.value || '').trim();
      if (!v) { input.focus(); return; }
      overlay.remove();
      resolve(v);
    }
    ok.addEventListener('click', done);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { input.focus(); input.select(); });
  });
}

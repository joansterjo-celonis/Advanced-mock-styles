/* ============================================================
   ACCESS GATE — a separate authentication layer that sits on top
   of the prototype without touching any of its functionality.

   How it works:
   - On load, an inline script in index.html adds `auth-locked` to
     <html> when access hasn't been granted yet (so the proto never
     flashes). This module then mounts the gate overlay.
   - Access is granted by EITHER typing the shared password OR
     signing in with a Google account.
   - Once granted, a flag is saved to localStorage so the gate is
     only shown once per browser/computer.

   To reset for testing, run `__resetProtoAccess()` in the console.
   ============================================================ */

const ACCESS_PASSWORD = 'iamfullofemotions';
const STORAGE_KEY = 'proto-access-granted';
const STORAGE_META = 'proto-access-meta';

function getGoogleClientId() {
  // Priority: window override → <meta name="google-client-id"> → none.
  if (typeof window !== 'undefined' && window.__GOOGLE_CLIENT_ID__) {
    return String(window.__GOOGLE_CLIENT_ID__).trim();
  }
  const meta = document.querySelector('meta[name="google-client-id"]');
  return meta && meta.content ? meta.content.trim() : '';
}

function hasAccess() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'yes';
  } catch (e) {
    return false;
  }
}

function grantAccess(method, detail) {
  try {
    localStorage.setItem(STORAGE_KEY, 'yes');
    localStorage.setItem(
      STORAGE_META,
      JSON.stringify({ method, detail: detail || null, at: new Date().toISOString() })
    );
  } catch (e) {
    /* storage unavailable — gate will simply show again next visit */
  }
}

// Decodes a Google ID token (JWT) payload so we can record who signed in.
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch (e) {
    return null;
  }
}

const CELONIS_MARK = `
  <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M7.76303 21.5235C9.40026 23.0245 11.734 23.9163 14.3839 23.9163H14.4891C15.6996 23.9191 16.8989 23.6748 18.0161 23.1973C19.1333 22.7197 20.1463 22.0182 20.9941 21.1331L20.9961 21.1311C22.6762 19.3827 23.6222 17.0325 23.625 14.5795C23.6304 11.3504 22.2514 7.872 20.2174 5.80739L20.2161 5.80607C19.013 4.58226 17.8047 4.08301 16.7439 4.08301C16.1935 4.08301 16.0004 4.21116 15.8868 4.30318C15.6822 4.46897 15.4977 4.72645 15.0997 5.34351C14.1049 6.99018 12.7792 8.40843 11.2071 9.50511C10.3269 10.1528 9.47026 10.6601 8.77092 11.0743C8.72333 11.1025 8.67647 11.1302 8.63038 11.1576C7.33548 11.9295 6.56217 12.4114 6.03832 13.0375C5.6011 13.56 5.25008 14.3029 5.25008 15.7854V15.7927C5.24561 16.875 5.46744 17.9452 5.90013 18.9324C6.33279 19.9196 6.96598 20.8003 7.75632 21.5174L7.76303 21.5235ZM7.73591 9.65344C7.77967 9.62749 7.82378 9.60135 7.8682 9.57503C8.57983 9.15339 9.37437 8.68264 10.1879 8.08233C11.5725 7.12025 12.7404 5.87117 13.6146 4.41745L13.6229 4.40446C14.3608 3.25933 14.9577 2.33301 16.7439 2.33301C18.3868 2.33301 20.0204 3.11078 21.464 4.57923C23.8486 6.99967 25.3811 10.9321 25.375 14.5814C25.3717 17.4822 24.2534 20.2672 22.2579 22.3437C21.2479 23.3981 20.0393 24.2356 18.704 24.8064C17.3687 25.3772 15.9339 25.6696 14.485 25.6663H14.3839C11.3465 25.6663 8.57572 24.6428 6.58041 22.8134C5.60647 21.9298 4.82831 20.8464 4.29732 19.6349C3.76634 18.4234 3.49461 17.1114 3.50008 15.7854C3.50008 12.1785 5.27283 11.1217 7.72563 9.65957L7.73591 9.65344Z" fill="currentColor"/>
    <path d="M17.403 11.8093C18.0383 12.3379 18.4568 13.0877 18.5769 13.9124H16.9433C16.8701 13.4699 16.6361 13.0714 16.2874 12.7956C15.9097 12.5171 15.4512 12.3747 14.9848 12.3911C14.7066 12.3847 14.4304 12.4383 14.1741 12.5482C13.9179 12.6581 13.6875 12.822 13.4982 13.0289C13.1028 13.4551 12.9036 14.0773 12.9036 14.8955C12.8593 15.5721 13.0721 16.2401 13.4982 16.7622C13.6864 16.9711 13.9164 17.1366 14.1728 17.2477C14.4292 17.3588 14.706 17.4128 14.9848 17.4062C15.4523 17.4237 15.9118 17.2789 16.2874 16.9955C16.6362 16.7172 16.8701 16.3167 16.9433 15.8724H18.5769C18.4562 16.7003 18.0367 17.4532 17.4 17.9849C16.718 18.5218 15.8718 18.7983 15.0093 18.7658C14.3439 18.7791 13.6863 18.6184 13.0998 18.2991C12.5459 17.9895 12.0931 17.5223 11.7972 16.9551C11.4686 16.3175 11.3051 15.6056 11.3221 14.8862C11.3058 14.1709 11.4693 13.4632 11.7972 12.8298C12.094 12.2632 12.5465 11.7963 13.0998 11.4858C13.6897 11.1751 14.3481 11.023 15.0123 11.044C15.8741 11.0097 16.7203 11.2839 17.403 11.8187" fill="currentColor"/>
  </svg>`;

const EYE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 11s3.5 7 10 7a9.05 9.05 0 0 0 5.39-1.61"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;
const LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;

function buildGate(onUnlock) {
  const gate = document.createElement('div');
  gate.className = 'auth-gate';
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('aria-label', 'Access required');

  gate.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">${CELONIS_MARK}</div>
      <div class="auth-title">Enter the prototype</div>
      <div class="auth-sub">This preview is access-protected. Enter the password or sign in with Google. You'll only need to do this once on this device.</div>

      <form class="auth-form" novalidate>
        <div class="auth-field">
          ${LOCK}
          <input type="password" id="auth-password" autocomplete="current-password"
                 placeholder="Password" aria-label="Password" spellcheck="false" />
          <button type="button" class="auth-reveal" aria-label="Show password">${EYE}</button>
        </div>
        <div class="auth-error" id="auth-error" role="alert"></div>
        <button type="submit" class="auth-btn">Unlock</button>
      </form>

      <div class="auth-divider">or</div>
      <div class="auth-google" id="auth-google"></div>

      <div class="auth-foot">Protected preview — internal use only.</div>
    </div>`;

  const form = gate.querySelector('.auth-form');
  const input = gate.querySelector('#auth-password');
  const errorEl = gate.querySelector('#auth-error');
  const reveal = gate.querySelector('.auth-reveal');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('show');
  }
  function clearError() {
    errorEl.classList.remove('show');
  }

  reveal.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    reveal.innerHTML = showing ? EYE : EYE_OFF;
    reveal.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    input.focus();
  });

  input.addEventListener('input', clearError);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value === ACCESS_PASSWORD) {
      grantAccess('password');
      onUnlock();
    } else {
      showError('Incorrect password. Please try again.');
      input.select();
    }
  });

  // Focus the field once mounted.
  requestAnimationFrame(() => input.focus());

  return gate;
}

function setupGoogle(gate, onUnlock) {
  const clientId = getGoogleClientId();
  const slot = gate.querySelector('#auth-google');
  if (!clientId || !slot) return; // No client ID → password-only (divider + slot hide via CSS).

  const finish = (response) => {
    const profile = response && response.credential ? decodeJwt(response.credential) : null;
    grantAccess('google', profile ? { email: profile.email, name: profile.name } : null);
    onUnlock();
  };

  const render = () => {
    /* global google */
    if (!window.google || !window.google.accounts || !window.google.accounts.id) return false;
    try {
      window.google.accounts.id.initialize({ client_id: clientId, callback: finish });
      window.google.accounts.id.renderButton(slot, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        width: 320,
      });
      return true;
    } catch (e) {
      return false;
    }
  };

  // Load the Google Identity Services library on demand, then render.
  if (render()) return;
  const existing = document.querySelector('script[data-gsi]');
  if (existing) {
    existing.addEventListener('load', render);
    return;
  }
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.defer = true;
  s.dataset.gsi = '1';
  s.addEventListener('load', render);
  document.head.appendChild(s);
}

function unlockAndReveal(gate) {
  document.documentElement.classList.remove('auth-locked');
  gate.classList.add('is-leaving');
  const remove = () => gate.remove();
  gate.addEventListener('transitionend', remove, { once: true });
  setTimeout(remove, 600); // fallback if transitionend doesn't fire
}

export function initAuthGate() {
  // Expose a tiny reset helper for testing/sharing.
  window.__resetProtoAccess = function () {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_META);
    } catch (e) { /* noop */ }
    document.documentElement.classList.add('auth-locked');
    location.reload();
  };

  if (hasAccess()) {
    document.documentElement.classList.remove('auth-locked');
    return;
  }

  const mount = () => {
    document.documentElement.classList.add('auth-locked');
    let gate;
    const onUnlock = () => unlockAndReveal(gate);
    gate = buildGate(onUnlock);
    document.body.appendChild(gate);
    setupGoogle(gate, onUnlock);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
}

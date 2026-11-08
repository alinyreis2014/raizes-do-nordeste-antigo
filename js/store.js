/**
 * store.js — Estado da aplicação com persistência local.
 * Simula o banco de dados do back-end usando localStorage (com fallback em memória).
 */

const KEY = 'raizes-nordeste:v1';
export const CONSENT_VERSION = '1.0';

const defaults = () => ({
  consent: null, // { necessary, analytics, marketing, version, at }
  users: [],
  sessionUserId: null,
  unitId: null,
  cart: [],
  appliedCode: null,
  orders: [],
  overrides: {},
  channel: 'web',
  analyticsEvents: [],
  loginAttempts: { count: 0, lockedUntil: 0 },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const state = Object.assign(defaults(), load() || {});

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* modo privado ou armazenamento cheio: segue em memória */
  }
}

export function resetAll() {
  Object.assign(state, defaults());
  try {
    localStorage.removeItem(KEY);
  } catch { /* noop */ }
}

export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function currentUser() {
  return state.users.find((u) => u.id === state.sessionUserId) || null;
}

/**
 * Hash de senha com SHA-256 + salt (Web Crypto).
 * Apenas demonstração: em produção o hash é feito no servidor (bcrypt/argon2).
 */
export async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // fallback (contexto não seguro): hash simples, somente para a demo
  let h = 0;
  for (const b of data) h = (h * 31 + b) | 0;
  return `fallback${h}`;
}

/**
 * Registro de evento de analytics — só acontece com consentimento (privacy by design).
 */
export function track(event, props = {}) {
  if (!state.consent?.analytics) return false;
  state.analyticsEvents.push({ event, props, at: new Date().toISOString() });
  if (state.analyticsEvents.length > 200) state.analyticsEvents.shift();
  persist();
  return true;
}

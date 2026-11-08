/**
 * core.js — Regras de negócio puras (sem DOM).
 * Por não depender do navegador, este módulo é testado com `node --test`.
 */

export const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const onlyDigits = (s) => String(s ?? '').replace(/\D/g, '');

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* ---------------- Validações de formulário ---------------- */

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email ?? '').trim());
}

export function isStrongPassword(pwd) {
  const p = String(pwd ?? '');
  return p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
}

export function isValidPhone(phone) {
  const d = onlyDigits(phone);
  return d.length === 10 || d.length === 11;
}

/** Validação de CPF pelos dígitos verificadores. */
export function isValidCPF(cpf) {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += Number(d[i]) * (t + 1 - i);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(d[t])) return false;
  }
  return true;
}

export function maskCPF(cpf) {
  const d = onlyDigits(cpf).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Exibe o CPF mascarado (privacidade): ***.456.789-** */
export function hideCPF(cpf) {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return '';
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** Algoritmo de Luhn para número de cartão. */
export function isValidCardNumber(num) {
  const d = onlyDigits(num);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function cardBrand(num) {
  const d = onlyDigits(num);
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(d)) return 'Elo';
  return 'Cartão';
}

/** Validade no formato MM/AA, não pode estar vencida. */
export function isValidExpiry(value, now = new Date()) {
  const m = /^(\d{2})\/(\d{2})$/.exec(String(value ?? '').trim());
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const lastDay = new Date(year, month, 0, 23, 59, 59);
  return lastDay >= now;
}

export const isValidCVV = (cvv) => /^\d{3,4}$/.test(String(cvv ?? ''));

/* ---------------- Cardápio dinâmico por unidade ---------------- */

/**
 * Monta o cardápio de uma unidade a partir do catálogo-base.
 * `overrides` permite ao gerente desligar itens em tempo real: { [unitId]: { [productId]: false } }
 */
export function menuForUnit(products, unitId, overrides = {}) {
  return products
    .filter((p) => p.units && p.units[unitId])
    .map((p) => {
      const cfg = p.units[unitId];
      const manual = overrides?.[unitId]?.[p.id];
      return {
        ...p,
        price: cfg.price ?? p.basePrice,
        available: manual === undefined ? cfg.available !== false : Boolean(manual),
      };
    });
}

/* ---------------- Promoções e carrinho ---------------- */

/**
 * Avalia se um cupom/promoção pode ser aplicado.
 * Retorna { ok, discount, reason }.
 */
export function evaluatePromo(promo, ctx) {
  const { subtotal = 0, unitId, date = new Date(), ordersCount = 0 } = ctx || {};
  if (!promo) return { ok: false, discount: 0, reason: 'Cupom inválido.' };
  if (promo.validUntil && new Date(promo.validUntil) < date)
    return { ok: false, discount: 0, reason: 'Este cupom expirou.' };
  if (promo.used) return { ok: false, discount: 0, reason: 'Este cupom já foi utilizado.' };
  if (promo.units && !promo.units.includes(unitId))
    return { ok: false, discount: 0, reason: 'Cupom não válido nesta unidade.' };
  if (promo.weekdays && !promo.weekdays.includes(date.getDay()))
    return { ok: false, discount: 0, reason: 'Cupom não válido hoje.' };
  if (promo.firstOrderOnly && ordersCount > 0)
    return { ok: false, discount: 0, reason: 'Cupom válido apenas no primeiro pedido.' };
  if (promo.minOrder && subtotal < promo.minOrder)
    return { ok: false, discount: 0, reason: `Pedido mínimo de ${fmtBRL(promo.minOrder)} para este cupom.` };

  let discount = 0;
  if (promo.type === 'percent') discount = (subtotal * promo.value) / 100;
  else if (promo.type === 'fixed') discount = promo.value;
  if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
  discount = round2(Math.min(discount, subtotal));
  return { ok: true, discount, reason: '' };
}

export function cartSubtotal(items) {
  return round2(items.reduce((s, it) => s + it.price * it.qty, 0));
}

export function calcTotals(items, promo, ctx = {}) {
  const subtotal = cartSubtotal(items);
  const res = promo ? evaluatePromo(promo, { ...ctx, subtotal }) : { ok: false, discount: 0, reason: '' };
  const discount = res.ok ? res.discount : 0;
  return {
    subtotal,
    discount,
    total: round2(subtotal - discount),
    promoValid: res.ok,
    promoReason: res.reason,
  };
}

export function addToCart(cart, product, qty = 1) {
  if (!product.available) throw new Error('Produto indisponível nesta unidade.');
  const next = cart.map((i) => ({ ...i }));
  const found = next.find((i) => i.id === product.id);
  if (found) found.qty = Math.min(found.qty + qty, 20);
  else next.push({ id: product.id, name: product.name, price: product.price, qty: Math.min(qty, 20), icon: product.icon });
  return next;
}

export function setQty(cart, id, qty) {
  return cart
    .map((i) => (i.id === id ? { ...i, qty: Math.min(Math.max(qty, 0), 20) } : { ...i }))
    .filter((i) => i.qty > 0);
}

/* ---------------- Fidelidade ---------------- */

export const POINTS_PER_REAL = 1;

export const pointsFor = (total) => Math.floor(Math.max(total, 0) * POINTS_PER_REAL);

export const LEVELS = [
  { id: 'semente', name: 'Semente', min: 0, perk: 'Acúmulo de 1 ponto por real' },
  { id: 'broto', name: 'Broto', min: 200, perk: 'Cupom de aniversário' },
  { id: 'raiz', name: 'Raiz', min: 500, perk: 'Fila prioritária e brindes' },
];

export function levelFor(lifetimePoints) {
  let current = LEVELS[0];
  for (const l of LEVELS) if (lifetimePoints >= l.min) current = l;
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  const progress = next ? (lifetimePoints - current.min) / (next.min - current.min) : 1;
  return { current, next, progress: Math.max(0, Math.min(1, progress)) };
}

export function canRedeem(balance, reward) {
  return balance >= reward.cost;
}

/* ---------------- Status do pedido ---------------- */

export const ORDER_FLOW = ['recebido', 'em_preparo', 'pronto', 'retirado'];

export const STATUS_LABEL = {
  recebido: 'Pagamento confirmado',
  em_preparo: 'Em preparo',
  pronto: 'Pronto para retirada',
  retirado: 'Retirado',
  cancelado: 'Cancelado',
};

export function nextStatus(status) {
  const i = ORDER_FLOW.indexOf(status);
  if (i < 0 || i === ORDER_FLOW.length - 1) return status;
  return ORDER_FLOW[i + 1];
}

export function pickupCode(rand = Math.random) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const l = letters[Math.floor(rand() * letters.length)];
  const n = String(Math.floor(rand() * 900) + 100);
  return `${l}${n}`;
}

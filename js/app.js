/**
 * app.js — Interface (SPA com roteamento por hash, sem framework).
 * Rotas: #/  #/carrinho  #/checkout  #/pedido/:id  #/pedidos  #/login  #/cadastro
 *        #/fidelidade  #/promocoes  #/conta  #/privacidade  #/equipe  #/admin
 */
import {
  fmtBRL, onlyDigits, isValidEmail, isStrongPassword, isValidPhone, isValidCPF, maskCPF, hideCPF,
  isValidCardNumber, isValidExpiry, isValidCVV, cardBrand, menuForUnit, calcTotals, addToCart, setQty,
  pointsFor, levelFor, canRedeem, ORDER_FLOW, STATUS_LABEL, nextStatus, pickupCode,
} from './core.js';
import { UNITS, CATEGORIES, PRODUCTS, PROMOS, REWARDS, STAFF_PINS } from './data.js';
import { state, persist, resetAll, uid, currentUser, hashPassword, track, CONSENT_VERSION } from './store.js';
import { requestPayment, checkPix, GatewayError } from './payment.js';

const $app = document.getElementById('app');
const $modal = document.getElementById('modal');

/** Estado efêmero de interface (não persistido). */
const ui = {
  category: 'all',
  query: '',
  checkout: null, // { phase: form|processing|pix|declined|error, ... }
  staffAuth: { equipe: false, admin: false },
  staffTab: 'cozinha',
  staffUnit: null,
  lastActivity: Date.now(),
  lastRoute: null,
};

/* ================= Utilidades ================= */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const isTotem = () => state.channel === 'totem';
const unit = (id = state.unitId) => UNITS.find((u) => u.id === id) || null;
const menu = (unitId = state.unitId) => menuForUnit(PRODUCTS, unitId, state.overrides);
const firstName = (n) => esc(String(n || '').trim().split(/\s+/)[0] || 'Cliente');
const timeStr = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateStr = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function openNow(u, d = new Date()) {
  const h = d.getHours();
  return h >= u.open[0] && h < u.open[1];
}

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name = '', ...params] = h.split('/').map(decodeURIComponent);
  return { name, params };
}

function go(path) {
  if (location.hash === `#/${path}`) render();
  else location.hash = `#/${path}`;
}

function toast(msg, type = 'info') {
  const box = document.getElementById('toasts');
  box.replaceChildren(); // apenas um aviso por vez, para não cobrir a tela
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add('is-out'), 3600);
  setTimeout(() => el.remove(), 4000);
}

function openModal(html) {
  $modal.innerHTML = `<div class="modal__box">${html}</div>`;
  if (typeof $modal.showModal === 'function') $modal.showModal();
  else $modal.setAttribute('open', '');
  $modal.querySelector('input, button:not([data-action="close-modal"])')?.focus();
}
function closeModal() {
  if (typeof $modal.close === 'function') $modal.close();
  else $modal.removeAttribute('open');
}

function userOrdersCount(user) {
  return user ? state.orders.filter((o) => o.userId === user.id).length : 0;
}

/** Procura o cupom: primeiro nos cupons pessoais do usuário (fidelidade), depois nas campanhas. */
function findPromo(code) {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  const user = currentUser();
  const own = user?.coupons?.find((x) => x.code === c);
  if (own) return own;
  return PROMOS.find((p) => p.code === c) || null;
}

function totals() {
  const user = currentUser();
  const promo = findPromo(state.appliedCode);
  const t = calcTotals(state.cart, promo, {
    unitId: state.unitId,
    date: new Date(),
    ordersCount: isTotem() ? 0 : userOrdersCount(user),
  });
  if (state.appliedCode && !promo) {
    t.promoReason = 'Cupom inválido.';
  }
  return t;
}

const cartCount = () => state.cart.reduce((s, i) => s + i.qty, 0);

function fieldError(form, name, msg) {
  const input = form.elements[name];
  const err = form.querySelector(`[data-err="${name}"]`);
  if (input && input.setAttribute) {
    if (msg) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  if (err) err.textContent = msg || '';
}

function clearErrors(form) {
  form.querySelectorAll('[data-err]').forEach((e) => (e.textContent = ''));
  form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  const box = form.querySelector('.form-alert');
  if (box) box.hidden = true;
}

function formAlert(form, msg) {
  const box = form.querySelector('.form-alert');
  if (box) {
    box.textContent = msg;
    box.hidden = false;
    box.focus?.();
  }
}

function focusFirstInvalid(form) {
  form.querySelector('[aria-invalid="true"]')?.focus();
}

const field = ({ name, label, type = 'text', value = '', hint = '', required = false, attrs = '' }) => `
  <div class="field">
    <label for="f-${name}">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">(opcional)</span>'}</label>
    <input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${required ? 'required aria-required="true"' : ''}
      aria-describedby="h-${name} e-${name}" ${attrs} />
    ${hint ? `<p class="hint" id="h-${name}">${hint}</p>` : ''}
    <p class="field-error" id="e-${name}" data-err="${name}" aria-live="polite"></p>
  </div>`;

/* ================= Cabeçalho, navegação e banner LGPD ================= */

function renderChrome() {
  const u = unit();
  document.getElementById('unitChipLabel').textContent = u ? u.name : 'Escolha a unidade';
  document.body.classList.toggle('totem', isTotem());
  document.getElementById('totemToggle').textContent = isTotem() ? 'Sair do modo totem' : 'Modo totem';

  const r = route().name;
  const user = currentUser();
  const items = isTotem()
    ? [['', '🍽️', 'Cardápio'], ['promocoes', '🏷️', 'Promoções'], ['carrinho', '🛒', 'Carrinho']]
    : [
        ['', '🍽️', 'Cardápio'],
        ['promocoes', '🏷️', 'Promoções'],
        ['fidelidade', '⭐', 'Fidelidade'],
        ['pedidos', '🧾', 'Pedidos'],
        [user ? 'conta' : 'login', '👤', user ? firstName(user.name) : 'Entrar'],
        ['carrinho', '🛒', 'Carrinho'],
      ];
  const count = cartCount();
  document.getElementById('tabbar').innerHTML = items
    .map(([path, icon, label]) => {
      const active = r === path || (path === 'login' && r === 'cadastro');
      const badge = path === 'carrinho' && count ? `<span class="tab__badge" aria-label="${count} itens">${count}</span>` : '';
      return `<a class="tab ${path === 'carrinho' ? 'tab--cart' : ''}" href="#/${path}" ${active ? 'aria-current="page"' : ''}>
        <span class="tab__icon" aria-hidden="true">${icon}${badge}</span><span class="tab__label">${label}</span></a>`;
    })
    .join('');

  renderConsentBanner();
}

function renderConsentBanner() {
  const el = document.getElementById('consentBanner');
  if (state.consent) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  el.innerHTML = `
    <div class="consent__box" role="region" aria-label="Aviso de privacidade e cookies">
      <p><strong>Sua privacidade importa.</strong> Usamos cookies essenciais para o site funcionar (carrinho e login).
      Com a sua permissão, também usamos cookies de <b>análise</b> (melhorar o cardápio) e de <b>marketing</b> (ofertas personalizadas).
      Você pode mudar isso quando quiser. <a href="#/privacidade">Política de privacidade</a>.</p>
      <div class="consent__actions">
        <button class="btn btn--outline" data-action="consent-necessary">Somente essenciais</button>
        <button class="btn btn--outline" data-action="open-consent">Personalizar</button>
        <button class="btn" data-action="consent-all">Aceitar todos</button>
      </div>
    </div>`;
}

function saveConsent({ analytics, marketing }) {
  const prev = state.consent;
  state.consent = { necessary: true, analytics: !!analytics, marketing: !!marketing, version: CONSENT_VERSION, at: new Date().toISOString() };
  const user = currentUser();
  if (user) {
    user.consentLog = user.consentLog || [];
    user.consentLog.push({ type: 'cookies', analytics: !!analytics, marketing: !!marketing, at: state.consent.at });
  }
  if (prev && prev.analytics && !analytics) state.analyticsEvents = []; // revogação apaga os eventos coletados
  persist();
  renderChrome();
}

/* ================= Telas ================= */

function unitCards(compact = false) {
  return `<div class="units ${compact ? 'units--compact' : ''}">${UNITS.map(
    (u) => `
    <article class="card unit ${u.id === state.unitId ? 'is-current' : ''}">
      <h3>${esc(u.name)}</h3>
      <p class="muted small">${esc(u.address)}</p>
      <p class="small">${esc(u.hours)} · ${openNow(u) ? '<span class="badge badge--ok">Aberto agora</span>' : '<span class="badge badge--warn">Fechado agora</span>'}</p>
      <button class="btn btn--block" data-action="set-unit" data-id="${u.id}">${u.id === state.unitId ? 'Unidade atual' : 'Pedir nesta unidade'}</button>
    </article>`
  ).join('')}</div>`;
}

function viewHome() {
  if (!state.unitId) {
    return `
      <section class="intro">
        <p class="eyebrow">Bem-vindo à Raízes do Nordeste</p>
        <h1>Onde você vai retirar seu pedido?</h1>
        <p class="muted">O cardápio, os preços e as promoções mudam conforme a unidade.</p>
      </section>
      ${unitCards()}`;
  }
  const u = unit();
  const promosHere = PROMOS.filter((p) => !p.units || p.units.includes(u.id));
  const cats = [{ id: 'all', name: 'Tudo' }, ...CATEGORIES];
  return `
    <section class="hero">
      <div>
        <p class="eyebrow">Você está pedindo em</p>
        <h1>${esc(u.name)}</h1>
        <p class="muted small">${esc(u.hours)} · ${openNow(u) ? '<span class="badge badge--ok">Aberto agora</span>' : '<span class="badge badge--warn">Fechado — o pedido entra na fila da abertura</span>'}</p>
      </div>
      <button class="btn btn--outline" data-action="choose-unit">Trocar unidade</button>
    </section>

    <section class="promo-strip" aria-labelledby="promoTitle">
      <h2 id="promoTitle" class="sr-only">Promoções desta unidade</h2>
      ${promosHere.slice(0, 3).map((p) => `
        <article class="promo">
          <p class="promo__title">${esc(p.title)}</p>
          <p class="small">${esc(p.description)}</p>
          <button class="chip chip--code" data-action="apply-code" data-code="${p.code}" aria-label="Aplicar cupom ${p.code}">${p.code}</button>
        </article>`).join('')}
    </section>

    <section aria-labelledby="menuTitle">
      <div class="menu-head">
        <h2 id="menuTitle">Cardápio</h2>
        <label class="search">
          <span class="sr-only">Buscar no cardápio</span>
          <input type="search" id="searchInput" placeholder="Buscar prato ou bebida" value="${esc(ui.query)}" autocomplete="off" />
        </label>
      </div>
      <div class="chips" role="group" aria-label="Filtrar por categoria">
        ${cats.map((c) => `<button class="chip ${ui.category === c.id ? 'is-active' : ''}" aria-pressed="${ui.category === c.id}" data-action="cat" data-id="${c.id}">${c.name}</button>`).join('')}
      </div>
      <div id="grid" class="grid"></div>
    </section>`;
}

function renderGrid() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  const q = ui.query.trim().toLowerCase();
  const list = menu()
    .filter((p) => ui.category === 'all' || p.category === ui.category)
    .filter((p) => !q || `${p.name} ${p.desc} ${p.tags.join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => Number(b.available) - Number(a.available));
  if (!list.length) {
    grid.innerHTML = `<p class="empty">Nenhum item encontrado${q ? ` para “${esc(ui.query)}”` : ''} nesta unidade.</p>`;
    return;
  }
  grid.innerHTML = list
    .map((p) => {
      const inCart = state.cart.find((i) => i.id === p.id);
      return `
      <article class="card product ${p.available ? '' : 'is-off'}">
        <div class="product__icon" aria-hidden="true">${p.icon}</div>
        <div class="product__body">
          <h3>${esc(p.name)}</h3>
          <p class="muted small">${esc(p.desc)}</p>
          ${p.tags.length ? `<p class="tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</p>` : ''}
        </div>
        <div class="product__foot">
          <strong class="price">${fmtBRL(p.price)}</strong>
          ${p.available
            ? `<button class="btn btn--sm" data-action="add" data-id="${p.id}" aria-label="Adicionar ${esc(p.name)} ao carrinho">${inCart ? `Adicionar (${inCart.qty})` : 'Adicionar'}</button>`
            : '<span class="badge badge--off">Indisponível hoje</span>'}
        </div>
      </article>`;
    })
    .join('');
}

function viewCart() {
  if (!state.cart.length) {
    return `
      <section class="empty-state">
        <p class="empty-state__icon" aria-hidden="true">🛒</p>
        <h1>Seu carrinho está vazio</h1>
        <p class="muted">Que tal um cuscuz com ovo ou uma tapioca de queijo coalho?</p>
        <a class="btn" href="#/">Ver cardápio</a>
      </section>`;
  }
  const t = totals();
  const user = currentUser();
  const coupons = (user?.coupons || []).filter((c) => !c.used);
  return `
    <h1>Carrinho</h1>
    <p class="muted small">Retirada em <b>${esc(unit()?.name)}</b></p>
    <div class="layout-2">
      <section class="card" aria-label="Itens do carrinho">
        <ul class="cart-list">
          ${state.cart.map((i) => `
            <li class="cart-item">
              <span class="cart-item__icon" aria-hidden="true">${i.icon}</span>
              <div class="cart-item__info">
                <p class="cart-item__name">${esc(i.name)}</p>
                <p class="muted small">${fmtBRL(i.price)} cada</p>
              </div>
              <div class="stepper" role="group" aria-label="Quantidade de ${esc(i.name)}">
                <button class="stepper__btn" data-action="qty" data-id="${i.id}" data-delta="-1" aria-label="Diminuir">−</button>
                <span class="stepper__val" aria-live="polite">${i.qty}</span>
                <button class="stepper__btn" data-action="qty" data-id="${i.id}" data-delta="1" aria-label="Aumentar" ${i.qty >= 20 ? 'disabled' : ''}>+</button>
              </div>
              <strong class="cart-item__total">${fmtBRL(i.price * i.qty)}</strong>
              <button class="icon-btn" data-action="remove" data-id="${i.id}" aria-label="Remover ${esc(i.name)}">✕</button>
            </li>`).join('')}
        </ul>
      </section>

      <aside class="card summary" aria-label="Resumo do pedido">
        <form data-form="coupon" class="coupon" novalidate>
          <label for="f-code">Cupom de desconto</label>
          <div class="coupon__row">
            <input id="f-code" name="code" placeholder="Ex.: ARRETADO" value="${esc(state.appliedCode || '')}" autocapitalize="characters" aria-describedby="e-code" />
            <button class="btn btn--outline" type="submit">Aplicar</button>
          </div>
          <p class="field-error" id="e-code" data-err="code">${state.appliedCode && !t.promoValid ? esc(t.promoReason) : ''}</p>
          ${state.appliedCode && t.promoValid ? `<p class="ok small">Cupom <b>${esc(state.appliedCode)}</b> aplicado. <button type="button" class="linklike" data-action="remove-code">Remover</button></p>` : ''}
        </form>
        ${coupons.length ? `<p class="small">Seus cupons de fidelidade: ${coupons.map((c) => `<button class="chip chip--code" data-action="apply-code" data-code="${c.code}">${esc(c.name)}</button>`).join(' ')}</p>` : ''}
        ${totalsBox(t)}
        <button class="btn btn--block btn--lg" data-action="go-checkout">Ir para pagamento</button>
        ${!user && !isTotem() ? '<p class="muted small center">Você vai entrar ou criar sua conta no próximo passo.</p>' : ''}
      </aside>
    </div>`;
}

function totalsBox(t) {
  return `
    <dl class="totals">
      <div><dt>Subtotal</dt><dd>${fmtBRL(t.subtotal)}</dd></div>
      ${t.discount ? `<div class="ok"><dt>Desconto</dt><dd>− ${fmtBRL(t.discount)}</dd></div>` : ''}
      <div class="totals__total"><dt>Total</dt><dd>${fmtBRL(t.total)}</dd></div>
    </dl>
    ${!isTotem() && currentUser() ? `<p class="small muted">Você vai ganhar <b>${pointsFor(t.total)} pontos</b> com este pedido.</p>` : ''}`;
}

function viewCheckout() {
  const c = ui.checkout || (ui.checkout = { phase: 'form', method: 'pix', fulfillment: 'balcao', name: '' });
  if (c.phase === 'processing') return viewProcessing();
  if (c.phase === 'pix') return viewPix();
  if (c.phase === 'declined' || c.phase === 'error') return viewPaymentFail();

  if (!state.cart.length) return viewCart();
  const user = currentUser();
  if (!user && !isTotem()) {
    setTimeout(() => go('login/checkout'));
    return '';
  }
  const t = totals();
  const isCard = c.method === 'credito' || c.method === 'debito';
  return `
    <h1>Pagamento</h1>
    <div class="layout-2">
      <form class="card form" data-form="checkout" novalidate>
        <div class="form-alert" role="alert" tabindex="-1" hidden></div>

        <fieldset class="options">
          <legend>Como você quer receber?</legend>
          ${[['balcao', '🛍️', 'Retirar no balcão'], ['local', '🍽️', 'Comer no local']].map(([v, i, l]) => `
            <label class="option"><input type="radio" name="fulfillment" value="${v}" ${c.fulfillment === v ? 'checked' : ''} />
            <span><span aria-hidden="true">${i}</span> ${l}</span></label>`).join('')}
        </fieldset>

        ${!user ? field({ name: 'name', label: 'Nome para chamarmos no balcão', value: c.name, required: true, hint: 'Usado só para identificar este pedido. Não guardamos depois da retirada.', attrs: 'autocomplete="given-name" maxlength="40"' }) : ''}

        <fieldset class="options">
          <legend>Forma de pagamento</legend>
          ${[['pix', '⚡', 'Pix'], ['credito', '💳', 'Cartão de crédito'], ['debito', '💳', 'Cartão de débito']].map(([v, i, l]) => `
            <label class="option"><input type="radio" name="method" value="${v}" ${c.method === v ? 'checked' : ''} data-change="method" />
            <span><span aria-hidden="true">${i}</span> ${l}</span></label>`).join('')}
        </fieldset>

        <div id="cardFields" ${isCard ? '' : 'hidden'}>
          ${field({ name: 'cardNumber', label: 'Número do cartão', required: true, attrs: 'inputmode="numeric" autocomplete="cc-number" data-mask="card" maxlength="23" placeholder="0000 0000 0000 0000"' })}
          ${field({ name: 'cardName', label: 'Nome impresso no cartão', required: true, attrs: 'autocomplete="cc-name"' })}
          <div class="row-2">
            ${field({ name: 'expiry', label: 'Validade', required: true, attrs: 'inputmode="numeric" autocomplete="cc-exp" data-mask="expiry" placeholder="MM/AA" maxlength="5"' })}
            ${field({ name: 'cvv', label: 'CVV', required: true, type: 'password', attrs: 'inputmode="numeric" autocomplete="cc-csc" maxlength="4"' })}
          </div>
          <details class="test-cards"><summary>Cartões de teste (demonstração)</summary>
            <ul class="small">
              <li><code>4111 1111 1111 1111</code> → aprovado</li>
              <li><code>4000 0000 0000 0002</code> → recusado (limite)</li>
              <li><code>4000 0000 0000 0069</code> → recusado (operadora)</li>
              <li><code>4000 0000 0000 0119</code> → falha de comunicação</li>
            </ul></details>
        </div>

        <p class="note"><span aria-hidden="true">🔒</span> Os dados do cartão vão direto para o provedor de pagamento (serviço externo).
        A Raízes do Nordeste <b>não armazena</b> número, validade nem CVV — guardamos só a bandeira e os 4 últimos dígitos no comprovante.</p>

        <button class="btn btn--block btn--lg" type="submit">Pagar ${fmtBRL(t.total)}</button>
        <a class="btn btn--ghost btn--block" href="#/carrinho">Voltar ao carrinho</a>
      </form>

      <aside class="card summary" aria-label="Resumo">
        <h2 class="h3">Resumo</h2>
        <ul class="mini-list">${state.cart.map((i) => `<li><span>${i.qty}× ${esc(i.name)}</span><span>${fmtBRL(i.price * i.qty)}</span></li>`).join('')}</ul>
        ${totalsBox(t)}
        <p class="small muted">Retirada: ${esc(unit()?.name)}</p>
      </aside>
    </div>`;
}

function viewProcessing() {
  const s = ui.checkout.step || 1;
  const steps = ['Pedido validado', 'Enviando ao provedor de pagamento', 'Aguardando resposta do banco'];
  return `
    <section class="status-screen" aria-busy="true">
      <div class="spinner" aria-hidden="true"></div>
      <h1>Processando pagamento…</h1>
      <p class="muted">Não feche esta tela. Isso leva poucos segundos.</p>
      <ol class="steps">${steps.map((t, i) => `<li class="${i + 1 < s ? 'done' : i + 1 === s ? 'current' : ''}">${t}</li>`).join('')}</ol>
    </section>`;
}

function qrSvg(text) {
  // QR "simulado": padrão determinístico a partir do texto (não é um QR Code legível).
  let h = 2166136261;
  const n = 25;
  const cells = [];
  for (let i = 0; i < n * n; i++) {
    h ^= text.charCodeAt(i % text.length) + i;
    h = Math.imul(h, 16777619) >>> 0;
    cells.push(h % 3 === 0);
  }
  const finder = (x, y) =>
    `<rect x="${x}" y="${y}" width="7" height="7" fill="#2B1D14"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#2B1D14"/>`;
  const inFinder = (x, y) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
  let rects = '';
  cells.forEach((on, i) => {
    const x = i % n;
    const y = Math.floor(i / n);
    if (on && !inFinder(x, y)) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="#2B1D14"/>`;
  });
  return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" class="qr" role="img" aria-label="QR Code Pix simulado"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/>${rects}${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
}

function viewPix() {
  const p = ui.checkout.pix;
  return `
    <section class="status-screen">
      <h1>Pague com Pix</h1>
      <p class="muted">Abra o app do seu banco e escaneie o código ou use o Pix Copia e Cola.</p>
      ${qrSvg(p.code)}
      <p class="badge badge--info">QR Code simulado — nenhum pagamento real</p>
      <div class="copy">
        <label for="pixCode" class="sr-only">Código Pix Copia e Cola</label>
        <input id="pixCode" readonly value="${esc(p.code)}" />
        <button class="btn btn--outline" data-action="copy-pix">Copiar</button>
      </div>
      <p class="waiting"><span class="dot" aria-hidden="true"></span> Aguardando confirmação do banco… expira em <b id="pixTimer">5:00</b></p>
      <p class="small muted">Na demonstração, o pagamento é confirmado automaticamente em ~5 segundos.</p>
      <button class="btn btn--ghost" data-action="cancel-payment">Cancelar e escolher outra forma</button>
    </section>`;
}

function viewPaymentFail() {
  const c = ui.checkout;
  const isError = c.phase === 'error';
  return `
    <section class="status-screen" role="alert">
      <p class="status-screen__icon" aria-hidden="true">${isError ? '⚠️' : '❌'}</p>
      <h1>${isError ? 'Serviço de pagamento indisponível' : 'Pagamento não aprovado'}</h1>
      <p>${esc(c.message)}</p>
      <p class="muted small">Nenhum valor foi cobrado. Seu carrinho continua salvo.</p>
      <div class="actions">
        <button class="btn" data-action="retry-payment">Tentar novamente</button>
        <button class="btn btn--outline" data-action="retry-pix">Pagar com Pix</button>
      </div>
    </section>`;
}

const STATUS_MSG = {
  recebido: 'Recebemos seu pagamento. A cozinha já foi avisada.',
  em_preparo: 'Nossa cozinha está preparando seu pedido.',
  pronto: 'Seu pedido está pronto! Mostre o código no balcão.',
  retirado: 'Pedido entregue. Bom apetite e obrigado pela preferência!',
};

function canSeeOrder(o) {
  if (!o.userId) return true; // pedido de convidado/totem neste dispositivo
  return o.userId === state.sessionUserId || ui.staffAuth.equipe || ui.staffAuth.admin;
}

function viewOrder(id) {
  const o = state.orders.find((x) => x.id === id);
  if (!o || !canSeeOrder(o)) return viewNotFound('Pedido não encontrado.');
  const idx = ORDER_FLOW.indexOf(o.status);
  const at = (s) => o.history.find((h) => h.status === s)?.at;
  const pay = o.payment;
  return `
    <section class="order-hero is-${o.status}" aria-live="polite">
      <p class="eyebrow">Pedido #${o.number} · ${esc(unit(o.unitId)?.name)}</p>
      <h1>${STATUS_LABEL[o.status]}</h1>
      <p>${STATUS_MSG[o.status] || ''}</p>
      <div class="pickup"><span>Código de retirada</span><strong>${esc(o.code)}</strong></div>
    </section>

    <ol class="timeline" aria-label="Andamento do pedido">
      ${ORDER_FLOW.map((s, i) => `
        <li class="${i < idx ? 'done' : i === idx ? 'current' : ''}">
          <span class="timeline__dot" aria-hidden="true"></span>
          <span class="timeline__label">${STATUS_LABEL[s]}</span>
          <span class="timeline__time">${at(s) ? timeStr(at(s)) : ''}</span>
        </li>`).join('')}
    </ol>

    <div class="layout-2">
      <section class="card">
        <h2 class="h3">Itens</h2>
        <ul class="mini-list">${o.items.map((i) => `<li><span>${i.qty}× ${esc(i.name)}</span><span>${fmtBRL(i.price * i.qty)}</span></li>`).join('')}</ul>
        <dl class="totals">
          <div><dt>Subtotal</dt><dd>${fmtBRL(o.subtotal)}</dd></div>
          ${o.discount ? `<div class="ok"><dt>Desconto ${o.promoCode ? `(${esc(o.promoCode)})` : ''}</dt><dd>− ${fmtBRL(o.discount)}</dd></div>` : ''}
          <div class="totals__total"><dt>Total pago</dt><dd>${fmtBRL(o.total)}</dd></div>
        </dl>
      </section>
      <section class="card">
        <h2 class="h3">Pagamento</h2>
        <p><span class="badge badge--ok">Aprovado</span> ${pay.method === 'pix' ? 'Pix' : `${esc(pay.brand)} final ${esc(pay.last4)} (${pay.method === 'credito' ? 'crédito' : 'débito'})`}</p>
        <p class="small muted">Transação ${esc(pay.transactionId)} · ${dateStr(pay.approvedAt)}</p>
        <p class="small">${o.fulfillment === 'local' ? '🍽️ Comer no local' : '🛍️ Retirar no balcão'} · Canal: ${esc(o.channel)}</p>
        ${o.points ? `<p class="ok small">+${o.points} pontos de fidelidade creditados.</p>` : ''}
      </section>
    </div>
    ${isTotem() ? '<button class="btn btn--block btn--lg" data-action="totem-new">Fazer novo pedido</button>' : '<a class="btn btn--outline" href="#/pedidos">Ver todos os pedidos</a>'}`;
}

function viewOrders() {
  const user = currentUser();
  const list = state.orders.filter((o) => (user ? o.userId === user.id : !o.userId && o.channel !== 'totem'));
  return `
    <h1>Meus pedidos</h1>
    ${!user ? '<p class="muted">Entre na sua conta para ver o histórico completo. <a href="#/login/pedidos">Entrar</a></p>' : ''}
    ${list.length ? `<ul class="order-list">${list.map((o) => `
      <li class="card order-row">
        <div><p><b>#${o.number}</b> · ${dateStr(o.createdAt)}</p><p class="muted small">${esc(unit(o.unitId)?.name)} · ${o.items.reduce((s, i) => s + i.qty, 0)} itens · ${fmtBRL(o.total)}</p></div>
        <span class="badge badge--${o.status === 'pronto' ? 'ok' : o.status === 'retirado' ? 'off' : 'info'}">${STATUS_LABEL[o.status]}</span>
        <a class="btn btn--sm btn--outline" href="#/pedido/${o.id}">Acompanhar</a>
      </li>`).join('')}</ul>` : '<p class="empty">Nenhum pedido por aqui ainda.</p>'}`;
}

function viewLogin(next = '') {
  if (currentUser()) {
    setTimeout(() => go(next || 'conta'));
    return '';
  }
  if (isTotem()) return viewNotFound('No totem não é preciso entrar: o pedido é feito como convidado.');
  return `
    <section class="auth">
      <form class="card form" data-form="login" data-next="${esc(next)}" novalidate>
        <h1>Entrar</h1>
        ${next === 'checkout' ? '<p class="muted">Entre para concluir o pedido e acumular pontos.</p>' : ''}
        <div class="form-alert" role="alert" tabindex="-1" hidden></div>
        ${field({ name: 'email', label: 'E-mail', type: 'email', required: true, attrs: 'autocomplete="email"' })}
        ${field({ name: 'password', label: 'Senha', type: 'password', required: true, attrs: 'autocomplete="current-password"' })}
        <label class="check small"><input type="checkbox" data-change="show-pwd" /> Mostrar senha</label>
        <button class="btn btn--block btn--lg" type="submit">Entrar</button>
        <p class="center small">Ainda não tem conta? <a href="#/cadastro/${esc(next)}">Criar conta</a></p>
      </form>
    </section>`;
}

function viewRegister(next = '') {
  if (currentUser()) {
    setTimeout(() => go(next || 'conta'));
    return '';
  }
  return `
    <section class="auth">
      <form class="card form" data-form="register" data-next="${esc(next)}" novalidate>
        <h1>Criar conta</h1>
        <p class="muted small">Pedimos só o necessário. Campos com <span class="req">*</span> são obrigatórios.</p>
        <div class="form-alert" role="alert" tabindex="-1" hidden></div>
        ${field({ name: 'name', label: 'Nome completo', required: true, attrs: 'autocomplete="name" maxlength="80"' })}
        ${field({ name: 'email', label: 'E-mail', type: 'email', required: true, hint: 'Para login e envio do comprovante.', attrs: 'autocomplete="email"' })}
        ${field({ name: 'phone', label: 'Celular', type: 'tel', hint: 'Para avisar quando o pedido estiver pronto.', attrs: 'autocomplete="tel" data-mask="phone" maxlength="15" placeholder="(81) 99999-9999"' })}
        ${field({ name: 'cpf', label: 'CPF', hint: 'Usado apenas para emitir nota fiscal com CPF. Você pode deixar em branco.', attrs: 'inputmode="numeric" data-mask="cpf" maxlength="14" placeholder="000.000.000-00"' })}
        ${field({ name: 'password', label: 'Senha', type: 'password', required: true, hint: 'Mínimo de 8 caracteres, com letras e números.', attrs: 'autocomplete="new-password"' })}
        ${field({ name: 'confirm', label: 'Confirme a senha', type: 'password', required: true, attrs: 'autocomplete="new-password"' })}

        <fieldset class="consents">
          <legend>Privacidade (LGPD)</legend>
          <label class="check"><input type="checkbox" name="terms" aria-describedby="e-terms" />
            <span>Li e aceito os <a href="#/privacidade" target="_blank" rel="noopener">Termos de Uso e a Política de Privacidade</a>. <span class="req">*</span></span></label>
          <p class="field-error" id="e-terms" data-err="terms"></p>
          <label class="check"><input type="checkbox" name="marketing" />
            <span>Quero receber ofertas e novidades por e-mail/WhatsApp. <span class="opt">(opcional — pode cancelar quando quiser)</span></span></label>
        </fieldset>

        <button class="btn btn--block btn--lg" type="submit">Criar conta</button>
        <p class="center small">Já tem conta? <a href="#/login/${esc(next)}">Entrar</a></p>
      </form>
    </section>`;
}

function viewLoyalty() {
  const user = currentUser();
  const how = `
    <ul class="how">
      <li><b>1 ponto</b> a cada R$ 1 em pedidos pagos.</li>
      <li>Troque pontos por cupons no catálogo abaixo.</li>
      <li>Suba de nível: Semente → Broto (200) → Raiz (500 pontos acumulados).</li>
    </ul>`;
  if (!user) {
    return `
      <section class="intro">
        <p class="eyebrow">Programa Raízes+</p>
        <h1>Peça, junte pontos e troque por delícias</h1>
        ${how}
        <div class="actions"><a class="btn" href="#/cadastro/fidelidade">Criar conta</a> <a class="btn btn--outline" href="#/login/fidelidade">Entrar</a></div>
      </section>`;
  }
  const lv = levelFor(user.lifetimePoints || 0);
  const coupons = (user.coupons || []).filter((c) => !c.used);
  return `
    <h1>Raízes+ Fidelidade</h1>
    <section class="card points">
      <div>
        <p class="eyebrow">Seu saldo</p>
        <p class="points__value">${user.points || 0} <small>pontos</small></p>
        <p>Nível <b>${lv.current.name}</b> — ${lv.current.perk}</p>
      </div>
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(lv.progress * 100)}"
        aria-label="Progresso para o próximo nível"><span style="width:${lv.progress * 100}%"></span></div>
      <p class="small muted">${lv.next ? `Faltam ${lv.next.min - (user.lifetimePoints || 0)} pontos para o nível ${lv.next.name}.` : 'Você está no nível máximo. Arretado!'}</p>
    </section>
    ${how}
    <h2>Trocar pontos</h2>
    <div class="grid grid--rewards">
      ${REWARDS.map((r) => `
        <article class="card reward">
          <p class="reward__icon" aria-hidden="true">${r.icon}</p>
          <h3>${esc(r.name)}</h3>
          <p class="muted">${r.cost} pontos</p>
          <button class="btn btn--sm btn--block" data-action="redeem" data-id="${r.id}" ${canRedeem(user.points || 0, r) ? '' : 'disabled aria-disabled="true"'}>
            ${canRedeem(user.points || 0, r) ? 'Resgatar' : `Faltam ${r.cost - (user.points || 0)} pts`}</button>
        </article>`).join('')}
    </div>
    <h2>Meus cupons</h2>
    ${coupons.length ? `<ul class="coupon-list">${coupons.map((c) => `<li class="card"><b>${esc(c.name)}</b> <code>${esc(c.code)}</code> <button class="btn btn--sm btn--outline" data-action="apply-code" data-code="${c.code}">Usar no carrinho</button></li>`).join('')}</ul>` : '<p class="muted">Nenhum cupom disponível.</p>'}
    <h2>Extrato</h2>
    ${(user.pointsHistory || []).length ? `<ul class="mini-list">${user.pointsHistory.slice(-10).reverse().map((h) => `<li><span>${dateStr(h.at)} — ${esc(h.desc)}</span><span class="${h.delta > 0 ? 'ok' : 'warn'}">${h.delta > 0 ? '+' : ''}${h.delta}</span></li>`).join('')}</ul>` : '<p class="muted">Seu extrato aparece aqui depois do primeiro pedido.</p>'}`;
}

function viewPromos() {
  const user = currentUser();
  const u = unit();
  return `
    <h1>Promoções e campanhas</h1>
    ${user && !user.marketing ? '<p class="note">Quer receber ofertas personalizadas? Ative em <a href="#/conta">Conta › Privacidade</a>. Sem seu consentimento, não enviamos marketing.</p>' : ''}
    <div class="grid grid--promos">
      ${PROMOS.map((p) => {
        const here = !p.units || (u && p.units.includes(u.id));
        return `
        <article class="card promo-card">
          <h2 class="h3">${esc(p.title)}</h2>
          <p class="small">${esc(p.description)}</p>
          ${p.validUntil ? `<p class="small muted">Válido até ${new Date(p.validUntil).toLocaleDateString('pt-BR')}</p>` : ''}
          <p><code class="code">${p.code}</code></p>
          ${here ? `<button class="btn btn--sm" data-action="apply-code" data-code="${p.code}">Usar no carrinho</button>` : `<span class="badge badge--off">Não vale na unidade atual</span>`}
        </article>`;
      }).join('')}
    </div>`;
}

function viewAccount() {
  const user = currentUser();
  if (!user) {
    setTimeout(() => go('login/conta'));
    return '';
  }
  const log = [...(user.consentLog || [])].reverse();
  return `
    <h1>Minha conta</h1>
    <div class="layout-2">
      <form class="card form" data-form="profile" novalidate>
        <h2 class="h3">Meus dados</h2>
        ${field({ name: 'name', label: 'Nome completo', value: user.name, required: true })}
        <div class="field"><label>E-mail</label><p class="readonly">${esc(user.email)}</p></div>
        ${field({ name: 'phone', label: 'Celular', type: 'tel', value: user.phone || '', attrs: 'data-mask="phone" maxlength="15"' })}
        <div class="field"><label>CPF</label><p class="readonly">${user.cpf ? hideCPF(user.cpf) : 'Não informado'}</p></div>
        <button class="btn" type="submit">Salvar alterações</button>
        <button class="btn btn--ghost" type="button" data-action="logout">Sair da conta</button>
      </form>

      <section class="card privacy-center" aria-labelledby="pcTitle">
        <h2 class="h3" id="pcTitle">🔒 Central de privacidade (LGPD)</h2>
        <p class="small muted">Você controla como usamos seus dados. As mudanças valem na hora.</p>
        <label class="switch"><input type="checkbox" data-change="marketing" ${user.marketing ? 'checked' : ''} />
          <span><b>Ofertas e novidades</b><br><span class="small muted">E-mail/WhatsApp com promoções. Base legal: consentimento.</span></span></label>
        <label class="switch"><input type="checkbox" data-change="analytics" ${state.consent?.analytics ? 'checked' : ''} />
          <span><b>Cookies de análise</b><br><span class="small muted">Estatísticas de uso para melhorar o cardápio. Base legal: consentimento.</span></span></label>
        <label class="switch is-locked"><input type="checkbox" checked disabled />
          <span><b>Dados essenciais</b><br><span class="small muted">Conta, pedidos e pagamento. Base legal: execução de contrato e obrigação legal (nota fiscal).</span></span></label>

        <div class="actions">
          <button class="btn btn--outline btn--sm" data-action="export-data">⬇️ Baixar meus dados</button>
          <button class="btn btn--danger btn--sm" data-action="delete-account">Excluir minha conta</button>
        </div>
        <details><summary class="small">Histórico de consentimentos (${log.length})</summary>
          <ul class="mini-list small">${log.map((l) => `<li><span>${dateStr(l.at)}</span><span>${esc(describeConsent(l))}</span></li>`).join('')}</ul>
        </details>
        <p class="small">Dúvidas ou outros pedidos (correção, portabilidade, informação sobre compartilhamento): <a href="mailto:privacidade@raizesdonordeste.com.br">privacidade@raizesdonordeste.com.br</a> (Encarregado/DPO).</p>
      </section>
    </div>`;
}

function describeConsent(l) {
  if (l.type === 'terms') return `Aceitou termos v${l.version}`;
  if (l.type === 'marketing') return l.value ? 'Ativou ofertas' : 'Revogou ofertas';
  if (l.type === 'cookies') return `Cookies: análise ${l.analytics ? 'sim' : 'não'}, marketing ${l.marketing ? 'sim' : 'não'}`;
  return l.type;
}

function viewPrivacy() {
  return `
    <article class="card prose">
      <h1>Política de Privacidade</h1>
      <p class="muted small">Versão ${CONSENT_VERSION} · Documento de demonstração para fins acadêmicos.</p>
      <h2>1. Quem cuida dos seus dados</h2>
      <p>A Rede Raízes do Nordeste (empresa fictícia) é a controladora dos dados pessoais tratados neste site, no app e nos totens.
      Encarregado (DPO): <a href="mailto:privacidade@raizesdonordeste.com.br">privacidade@raizesdonordeste.com.br</a>.</p>
      <h2>2. Quais dados coletamos e para quê</h2>
      <table class="table">
        <thead><tr><th>Dado</th><th>Finalidade</th><th>Base legal (LGPD, art. 7º)</th></tr></thead>
        <tbody>
          <tr><td>Nome, e-mail, senha (criptografada)</td><td>Criar e proteger sua conta</td><td>Execução de contrato (V)</td></tr>
          <tr><td>Itens, unidade, valores do pedido</td><td>Preparar, entregar e cobrar o pedido</td><td>Execução de contrato (V)</td></tr>
          <tr><td>CPF (opcional)</td><td>Nota fiscal com CPF</td><td>Obrigação legal (II)</td></tr>
          <tr><td>Celular (opcional)</td><td>Avisar que o pedido está pronto</td><td>Execução de contrato (V)</td></tr>
          <tr><td>Pontos e cupons</td><td>Programa de fidelidade</td><td>Execução de contrato (V)</td></tr>
          <tr><td>Preferências e histórico para ofertas</td><td>Marketing personalizado</td><td>Consentimento (I)</td></tr>
          <tr><td>Eventos de navegação</td><td>Estatísticas de uso</td><td>Consentimento (I)</td></tr>
        </tbody>
      </table>
      <h2>3. Pagamentos</h2>
      <p>Os dados do cartão são enviados diretamente ao provedor de pagamento parceiro. Não armazenamos número, validade nem código de segurança.
      Guardamos apenas bandeira, 4 últimos dígitos e o código da transação para o seu comprovante.</p>
      <h2>4. Com quem compartilhamos</h2>
      <p>Provedor de pagamento (processar a cobrança), emissor de nota fiscal e serviços de hospedagem. Não vendemos dados pessoais.</p>
      <h2>5. Por quanto tempo guardamos</h2>
      <p>Dados de conta: enquanto ela estiver ativa. Dados fiscais do pedido: pelo prazo exigido em lei (5 anos), sem vínculo com o seu nome após a exclusão da conta.
      No totem, o nome informado serve só para chamar o pedido.</p>
      <h2>6. Seus direitos (art. 18)</h2>
      <ul>
        <li>Confirmar e acessar seus dados — botão <b>Baixar meus dados</b> em Conta.</li>
        <li>Corrigir dados — edição em Conta › Meus dados.</li>
        <li>Revogar consentimentos — chaves na Central de privacidade.</li>
        <li>Eliminar dados — botão <b>Excluir minha conta</b>.</li>
        <li>Portabilidade e informação sobre compartilhamento — pelo e-mail do Encarregado.</li>
      </ul>
      <h2>7. Cookies</h2>
      <p>Essenciais (sempre ativos): carrinho, sessão e preferências de privacidade. Análise e marketing: só com sua autorização.
      <button class="linklike" data-action="open-consent">Alterar preferências de cookies</button>.</p>
      <h2>8. Segurança</h2>
      <p>Conexão HTTPS, senhas com hash, acesso interno por perfil (cozinha, atendimento, gerência) e exibição mínima de dados para a equipe — a cozinha vê apenas o primeiro nome e o código do pedido.</p>
    </article>`;
}

function gate(role) {
  if (ui.staffAuth[role]) return null;
  const title = role === 'admin' ? 'Gerência' : 'Equipe da loja';
  return `
    <section class="auth">
      <form class="card form" data-form="pin" data-role="${role}" novalidate>
        <h1>${title}</h1>
        <p class="muted small">Área restrita. Em produção: login corporativo com perfis de acesso.
        Demonstração: PIN <code>${role === 'admin' ? '9999' : '1234'}</code>.</p>
        <div class="form-alert" role="alert" tabindex="-1" hidden></div>
        ${field({ name: 'pin', label: 'PIN', type: 'password', required: true, attrs: 'inputmode="numeric" maxlength="4" autocomplete="off"' })}
        <button class="btn btn--block" type="submit">Acessar</button>
      </form>
    </section>`;
}

function unitSelect(name, current) {
  return `<label class="inline-select">Unidade:
    <select data-change="${name}">${UNITS.map((u) => `<option value="${u.id}" ${u.id === current ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>`;
}

function viewStaff() {
  const g = gate('equipe');
  if (g) return g;
  const unitId = ui.staffUnit || state.unitId || UNITS[0].id;
  ui.staffUnit = unitId;
  const orders = state.orders.filter((o) => o.unitId === unitId);
  const col = (status, action, label) => {
    const list = orders.filter((o) => o.status === status).reverse();
    return `
      <section class="kds__col" aria-label="${STATUS_LABEL[status]}">
        <h2 class="h3">${STATUS_LABEL[status]} <span class="badge">${list.length}</span></h2>
        ${list.map((o) => `
          <article class="ticket">
            <header><b>#${o.number}</b> <span class="code">${esc(o.code)}</span> <span class="muted small">${timeStr(o.history.at(-1).at)}</span></header>
            <p class="small">${firstName(o.customerName)} · ${o.fulfillment === 'local' ? 'Comer no local' : 'Balcão'}</p>
            <ul class="small">${o.items.map((i) => `<li><b>${i.qty}×</b> ${esc(i.name)}</li>`).join('')}</ul>
            ${action ? `<button class="btn btn--sm btn--block" data-action="advance" data-id="${o.id}">${label}</button>` : ''}
          </article>`).join('') || '<p class="muted small">Nenhum pedido.</p>'}
      </section>`;
  };
  return `
    <div class="staff-head">
      <h1>Painel da equipe</h1>
      ${unitSelect('staff-unit', unitId)}
    </div>
    <div class="tabs" role="tablist">
      <button role="tab" class="tabs__btn" aria-selected="${ui.staffTab === 'cozinha'}" data-action="staff-tab" data-id="cozinha">👩‍🍳 Cozinha</button>
      <button role="tab" class="tabs__btn" aria-selected="${ui.staffTab === 'atendimento'}" data-action="staff-tab" data-id="atendimento">🧑‍💼 Atendimento</button>
    </div>
    ${ui.staffTab === 'cozinha'
      ? `<div class="kds">${col('recebido', true, 'Iniciar preparo')}${col('em_preparo', true, 'Marcar como pronto')}${col('pronto', false)}</div>
         <p class="small muted">Na demonstração, os pedidos também avançam sozinhos (≈8 s e ≈15 s) para simular a cozinha.</p>`
      : `<div class="layout-2">
          <form class="card form" data-form="pickup" novalidate>
            <h2 class="h3">Confirmar retirada</h2>
            <div class="form-alert" role="alert" tabindex="-1" hidden></div>
            ${field({ name: 'code', label: 'Código informado pelo cliente', required: true, attrs: 'autocapitalize="characters" maxlength="4" placeholder="Ex.: K482"' })}
            <button class="btn btn--block" type="submit">Entregar pedido</button>
          </form>
          ${col('pronto', true, 'Entregar')}
        </div>`}`;
}

function viewAdmin() {
  const g = gate('admin');
  if (g) return g;
  const unitId = ui.staffUnit || state.unitId || UNITS[0].id;
  ui.staffUnit = unitId;
  const today = new Date().toDateString();
  const rows = UNITS.map((u) => {
    const os = state.orders.filter((o) => o.unitId === u.id);
    const revenue = os.reduce((s, o) => s + o.total, 0);
    return { u, count: os.length, revenue, today: os.filter((o) => new Date(o.createdAt).toDateString() === today).length };
  });
  const all = state.orders;
  const revenue = all.reduce((s, o) => s + o.total, 0);
  const open = all.filter((o) => o.status !== 'retirado').length;
  const m = menu(unitId);
  return `
    <div class="staff-head"><h1>Gerência</h1>${unitSelect('staff-unit', unitId)}</div>
    <div class="kpis">
      <div class="card kpi"><p class="kpi__label">Pedidos (rede)</p><p class="kpi__value">${all.length}</p></div>
      <div class="card kpi"><p class="kpi__label">Faturamento</p><p class="kpi__value">${fmtBRL(revenue)}</p></div>
      <div class="card kpi"><p class="kpi__label">Ticket médio</p><p class="kpi__value">${fmtBRL(all.length ? revenue / all.length : 0)}</p></div>
      <div class="card kpi"><p class="kpi__label">Em andamento</p><p class="kpi__value">${open}</p></div>
    </div>
    <div class="layout-2">
      <section class="card">
        <h2 class="h3">Por unidade</h2>
        <table class="table"><thead><tr><th>Unidade</th><th>Hoje</th><th>Total</th><th>Faturamento</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${esc(r.u.name)}</td><td>${r.today}</td><td>${r.count}</td><td>${fmtBRL(r.revenue)}</td></tr>`).join('')}</tbody></table>
      </section>
      <section class="card">
        <h2 class="h3">Cardápio de ${esc(unit(unitId).name)}</h2>
        <p class="small muted">Desligue um item quando acabar: ele some do pedido na hora, em todos os canais.</p>
        <ul class="toggle-list">${m.map((p) => `
          <li><label class="switch"><input type="checkbox" data-change="product" data-id="${p.id}" ${p.available ? 'checked' : ''} />
          <span>${p.icon} ${esc(p.name)} <span class="muted small">${fmtBRL(p.price)}</span></span></label></li>`).join('')}</ul>
      </section>
    </div>
    <p><button class="btn btn--ghost btn--sm" data-action="reset-demo">Restaurar dados da demonstração</button></p>`;
}

function viewNotFound(msg = 'Página não encontrada.') {
  return `<section class="empty-state"><p class="empty-state__icon" aria-hidden="true">🌵</p><h1>${esc(msg)}</h1><a class="btn" href="#/">Voltar ao cardápio</a></section>`;
}

const VIEWS = {
  '': viewHome,
  carrinho: viewCart,
  checkout: viewCheckout,
  pedido: viewOrder,
  pedidos: viewOrders,
  login: viewLogin,
  cadastro: viewRegister,
  fidelidade: viewLoyalty,
  promocoes: viewPromos,
  conta: viewAccount,
  privacidade: viewPrivacy,
  equipe: viewStaff,
  admin: viewAdmin,
};

const TITLES = {
  '': 'Cardápio', carrinho: 'Carrinho', checkout: 'Pagamento', pedido: 'Acompanhar pedido', pedidos: 'Meus pedidos',
  login: 'Entrar', cadastro: 'Criar conta', fidelidade: 'Fidelidade', promocoes: 'Promoções', conta: 'Minha conta',
  privacidade: 'Política de privacidade', equipe: 'Equipe', admin: 'Gerência',
};

function render() {
  const r = route();
  const view = VIEWS[r.name] || (() => viewNotFound());
  if (r.name !== 'checkout' && ui.checkout && ui.checkout.phase !== 'processing') ui.checkout = null;
  $app.innerHTML = view(...r.params);
  document.title = `${TITLES[r.name] || 'Raízes do Nordeste'} · Raízes do Nordeste`;
  renderChrome();
  if (r.name === '' && state.unitId) renderGrid();
  const key = location.hash;
  if (ui.lastRoute !== key) {
    ui.lastRoute = key;
    window.scrollTo(0, 0);
    $app.focus({ preventScroll: true });
    track('page_view', { route: r.name });
  }
}

/* ================= Ações ================= */

function setUnit(id) {
  if (!UNITS.some((u) => u.id === id)) return;
  const changed = state.unitId !== id;
  state.unitId = id;
  if (changed && state.cart.length) {
    const m = menu();
    const before = state.cart.length;
    state.cart = state.cart
      .map((i) => {
        const p = m.find((x) => x.id === i.id);
        return p && p.available ? { ...i, price: p.price } : null;
      })
      .filter(Boolean);
    if (state.cart.length < before) toast('Alguns itens não existem nesta unidade e saíram do carrinho.', 'warn');
    else toast('Preços do carrinho atualizados para a nova unidade.');
  }
  persist();
}

async function startPayment(form) {
  const c = ui.checkout;
  const fd = new FormData(form);
  c.method = fd.get('method');
  c.fulfillment = fd.get('fulfillment');
  const user = currentUser();
  clearErrors(form);
  const errors = {};

  if (!user) {
    c.name = String(fd.get('name') || '').trim();
    if (c.name.length < 2) errors.name = 'Informe um nome com pelo menos 2 letras.';
  }
  const isCard = c.method !== 'pix';
  let card = null;
  if (isCard) {
    card = { number: fd.get('cardNumber'), name: String(fd.get('cardName') || '').trim(), expiry: fd.get('expiry'), cvv: fd.get('cvv') };
    if (!onlyDigits(card.number)) errors.cardNumber = 'Informe o número do cartão.';
    else if (!isValidCardNumber(card.number)) errors.cardNumber = 'Número de cartão inválido. Confira os dígitos.';
    if (card.name.length < 3) errors.cardName = 'Informe o nome como está no cartão.';
    if (!isValidExpiry(card.expiry)) errors.expiry = /^\d{2}\/\d{2}$/.test(card.expiry || '') ? 'Cartão vencido ou mês inválido.' : 'Use o formato MM/AA.';
    if (!isValidCVV(card.cvv)) errors.cvv = 'CVV deve ter 3 ou 4 números.';
  }
  const t = totals();
  if (state.appliedCode && !t.promoValid) {
    errors._form = `O cupom ${state.appliedCode} não pode ser usado: ${t.promoReason} Remova-o no carrinho.`;
  }
  const keys = Object.keys(errors);
  if (keys.length) {
    keys.filter((k) => k !== '_form').forEach((k) => fieldError(form, k, errors[k]));
    formAlert(form, errors._form || 'Revise os campos destacados.');
    if (!errors._form) focusFirstInvalid(form);
    return;
  }

  // Envio ao serviço externo de pagamento
  const amount = t.total;
  ui.checkout = { ...c, phase: 'processing', step: 1 };
  render();
  setTimeout(() => { if (ui.checkout?.phase === 'processing') { ui.checkout.step = 2; render(); } }, 500);
  setTimeout(() => { if (ui.checkout?.phase === 'processing') { ui.checkout.step = 3; render(); } }, 1200);
  track('payment_requested', { method: c.method });

  try {
    const res = await requestPayment({ method: c.method === 'pix' ? 'pix' : 'card', amount, card });
    card = null; // descarta os dados do cartão da memória
    if (res.status === 'approved') return finalizeOrder({ ...res, method: c.method });
    if (res.status === 'pending') {
      ui.checkout = { ...ui.checkout, phase: 'pix', pix: { id: res.transactionId, code: res.pixCode, expiresAt: Date.now() + res.expiresIn * 1000 } };
      render();
      return pollPix(res.transactionId);
    }
    ui.checkout = { ...ui.checkout, phase: 'declined', message: res.message };
    track('payment_declined');
    render();
  } catch (err) {
    ui.checkout = {
      ...ui.checkout,
      phase: 'error',
      message: err instanceof GatewayError ? err.message : 'Erro inesperado ao processar o pagamento.',
    };
    render();
  }
}

async function pollPix(id) {
  const tick = async () => {
    const c = ui.checkout;
    if (!c || c.phase !== 'pix' || c.pix.id !== id) return; // cancelado
    const left = Math.max(0, Math.round((c.pix.expiresAt - Date.now()) / 1000));
    const el = document.getElementById('pixTimer');
    if (el) el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const res = await checkPix(id);
    if (ui.checkout?.pix?.id !== id) return;
    if (res.status === 'approved') return finalizeOrder({ status: 'approved', transactionId: id, method: 'pix' });
    if (res.status === 'expired' || left === 0) {
      ui.checkout = { ...ui.checkout, phase: 'error', message: 'O código Pix expirou antes da confirmação.' };
      return render();
    }
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
}

function finalizeOrder(pay) {
  const user = currentUser();
  const t = totals();
  const now = new Date().toISOString();
  const c = ui.checkout || {};
  const order = {
    id: uid('ped'),
    number: 100 + state.orders.length + 1,
    code: pickupCode(),
    unitId: state.unitId,
    channel: state.channel,
    userId: user?.id || null,
    customerName: user ? user.name : c.name,
    items: state.cart.map((i) => ({ ...i })),
    subtotal: t.subtotal,
    discount: t.discount,
    total: t.total,
    promoCode: t.promoValid ? state.appliedCode : null,
    fulfillment: c.fulfillment || 'balcao',
    payment: {
      method: pay.method,
      transactionId: pay.transactionId,
      brand: pay.token?.brand || null,
      last4: pay.token?.last4 || null,
      approvedAt: now,
    },
    status: 'recebido',
    history: [{ status: 'recebido', at: now, by: 'sistema' }],
    createdAt: now,
    points: user && !isTotem() ? pointsFor(t.total) : 0,
  };
  state.orders.unshift(order);

  if (user) {
    if (order.points) {
      user.points = (user.points || 0) + order.points;
      user.lifetimePoints = (user.lifetimePoints || 0) + order.points;
      user.pointsHistory = user.pointsHistory || [];
      user.pointsHistory.push({ delta: order.points, desc: `Pedido #${order.number}`, at: now });
    }
    const own = user.coupons?.find((x) => x.code === order.promoCode);
    if (own) own.used = true;
  }
  state.cart = [];
  state.appliedCode = null;
  ui.checkout = null;
  persist();
  track('purchase', { total: order.total, channel: order.channel });
  toast('Pagamento aprovado! Pedido enviado para a cozinha.', 'ok');
  go(`pedido/${order.id}`);
}

function advanceOrder(o, by) {
  const n = nextStatus(o.status);
  if (n === o.status) return false;
  o.status = n;
  o.history.push({ status: n, at: new Date().toISOString(), by });
  if (n === 'pronto' && (o.userId ? o.userId === state.sessionUserId : true) && !['equipe', 'admin'].includes(route().name)) {
    toast(`Pedido #${o.number} pronto! Código ${o.code}.`, 'ok');
    navigator.vibrate?.(200);
  }
  if (n === 'retirado' && !o.userId) o.customerName = 'Convidado'; // minimização: descarta o nome do convidado
  return true;
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

const actions = {
  'choose-unit': () =>
    openModal(`<h2 id="modalTitle">Escolha a unidade</h2>${unitCards(true)}<button class="btn btn--ghost btn--block" data-action="close-modal">Fechar</button>`),
  'set-unit': (el) => {
    setUnit(el.dataset.id);
    closeModal();
    if (route().name === '') render();
    else go('');
  },
  'close-modal': closeModal,
  cat: (el) => { ui.category = el.dataset.id; render(); },
  add: (el) => {
    const p = menu().find((x) => x.id === el.dataset.id);
    if (!p) return;
    try {
      state.cart = addToCart(state.cart, p);
      persist();
      toast(`${p.name} adicionado ao carrinho.`, 'ok');
      track('add_to_cart', { id: p.id });
      renderGrid();
      renderChrome();
    } catch (e) {
      toast(e.message, 'warn');
    }
  },
  qty: (el) => {
    const it = state.cart.find((i) => i.id === el.dataset.id);
    if (!it) return;
    state.cart = setQty(state.cart, it.id, it.qty + Number(el.dataset.delta));
    persist();
    render();
  },
  remove: (el) => { state.cart = setQty(state.cart, el.dataset.id, 0); persist(); render(); },
  'apply-code': (el) => {
    state.appliedCode = el.dataset.code;
    persist();
    toast(`Cupom ${el.dataset.code} adicionado ao carrinho.`, 'ok');
    go('carrinho');
  },
  'remove-code': () => { state.appliedCode = null; persist(); render(); },
  'go-checkout': () => {
    const t = totals();
    if (state.appliedCode && !t.promoValid) {
      toast(`Cupom não aplicável: ${t.promoReason}`, 'warn');
      return;
    }
    ui.checkout = null;
    if (!currentUser() && !isTotem()) go('login/checkout');
    else go('checkout');
  },
  'copy-pix': async () => {
    const v = document.getElementById('pixCode')?.value || '';
    try { await navigator.clipboard.writeText(v); toast('Código Pix copiado.', 'ok'); }
    catch { document.getElementById('pixCode')?.select(); toast('Selecione e copie o código.'); }
  },
  'cancel-payment': () => { ui.checkout = { ...ui.checkout, phase: 'form' }; render(); },
  'retry-payment': () => { ui.checkout = { ...ui.checkout, phase: 'form' }; render(); },
  'retry-pix': () => { ui.checkout = { ...ui.checkout, phase: 'form', method: 'pix' }; render(); },
  logout: () => {
    state.sessionUserId = null;
    state.appliedCode = null;
    persist();
    toast('Você saiu da conta.');
    go('');
  },
  redeem: (el) => {
    const user = currentUser();
    const r = REWARDS.find((x) => x.id === el.dataset.id);
    if (!user || !r) return;
    if (!canRedeem(user.points || 0, r)) return toast('Pontos insuficientes para este resgate.', 'warn');
    const now = new Date().toISOString();
    user.points -= r.cost;
    user.pointsHistory = user.pointsHistory || [];
    user.pointsHistory.push({ delta: -r.cost, desc: `Resgate: ${r.name}`, at: now });
    user.coupons = user.coupons || [];
    const code = `RZ${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    user.coupons.push({ code, name: r.name, title: r.name, type: r.type, value: r.value, maxDiscount: r.maxDiscount, used: false, createdAt: now });
    persist();
    toast(`Resgatado! Seu cupom é ${code}.`, 'ok');
    render();
  },
  'export-data': () => {
    const user = currentUser();
    if (!user) return;
    const { passwordHash, salt, ...profile } = user;
    downloadJSON(`meus-dados-raizes-${new Date().toISOString().slice(0, 10)}.json`, {
      geradoEm: new Date().toISOString(),
      aviso: 'Exportação de dados pessoais (LGPD, art. 18, II e V). A senha não é exportada.',
      perfil: profile,
      pedidos: state.orders.filter((o) => o.userId === user.id),
      preferenciasDeCookies: state.consent,
    });
    toast('Arquivo com seus dados baixado.', 'ok');
  },
  'delete-account': () =>
    openModal(`
      <h2 id="modalTitle">Excluir conta</h2>
      <p>Vamos apagar seu cadastro, pontos e cupons. Os pedidos já pagos ficam guardados <b>sem o seu nome</b>, apenas para fins fiscais.</p>
      <p><b>Essa ação não pode ser desfeita.</b></p>
      <form data-form="delete" novalidate>
        <div class="form-alert" role="alert" tabindex="-1" hidden></div>
        ${field({ name: 'confirm', label: 'Digite EXCLUIR para confirmar', required: true, attrs: 'autocomplete="off"' })}
        <div class="actions"><button type="button" class="btn btn--ghost" data-action="close-modal">Cancelar</button>
        <button type="submit" class="btn btn--danger">Excluir definitivamente</button></div>
      </form>`),
  'open-consent': () => {
    const c = state.consent || { analytics: false, marketing: false };
    openModal(`
      <h2 id="modalTitle">Preferências de privacidade</h2>
      <form data-form="consent">
        <label class="switch is-locked"><input type="checkbox" checked disabled /><span><b>Essenciais</b><br><span class="small muted">Carrinho, login e segurança. Sempre ativos.</span></span></label>
        <label class="switch"><input type="checkbox" name="analytics" ${c.analytics ? 'checked' : ''} /><span><b>Análise</b><br><span class="small muted">Contagem de visitas e itens mais vistos, sem identificar você.</span></span></label>
        <label class="switch"><input type="checkbox" name="marketing" ${c.marketing ? 'checked' : ''} /><span><b>Marketing</b><br><span class="small muted">Ofertas personalizadas com base nos seus pedidos.</span></span></label>
        <div class="actions"><button type="button" class="btn btn--ghost" data-action="close-modal">Cancelar</button><button class="btn" type="submit">Salvar preferências</button></div>
      </form>`);
  },
  'consent-all': () => { saveConsent({ analytics: true, marketing: true }); toast('Preferências salvas.'); },
  'consent-necessary': () => { saveConsent({ analytics: false, marketing: false }); toast('Usaremos apenas cookies essenciais.'); },
  'toggle-totem': () => {
    const goingTotem = !isTotem();
    state.channel = goingTotem ? 'totem' : 'web';
    if (goingTotem) {
      state.sessionUserId = null; // aparelho compartilhado: nenhuma conta fica conectada
      state.cart = [];
      state.appliedCode = null;
    }
    persist();
    toast(goingTotem ? 'Modo totem ativado (autoatendimento na loja).' : 'Modo web ativado.');
    go('');
  },
  'totem-new': () => { state.cart = []; state.appliedCode = null; persist(); go(''); },
  'staff-tab': (el) => { ui.staffTab = el.dataset.id; render(); },
  advance: (el) => {
    const o = state.orders.find((x) => x.id === el.dataset.id);
    if (o && advanceOrder(o, route().name === 'equipe' ? ui.staffTab : 'gerencia')) {
      persist();
      toast(`Pedido #${o.number}: ${STATUS_LABEL[o.status]}.`, 'ok');
      render();
    }
  },
  'reset-demo': () =>
    openModal(`<h2 id="modalTitle">Restaurar demonstração?</h2><p>Apaga contas, pedidos e preferências salvos neste navegador.</p>
      <div class="actions"><button class="btn btn--ghost" data-action="close-modal">Cancelar</button><button class="btn btn--danger" data-action="reset-confirm">Restaurar</button></div>`),
  'reset-confirm': () => { resetAll(); ui.staffAuth = { equipe: false, admin: false }; closeModal(); toast('Dados da demonstração apagados.'); go(''); },
};

/* ================= Formulários ================= */

const forms = {
  coupon: (form, fd) => {
    const code = String(fd.get('code') || '').trim().toUpperCase();
    clearErrors(form);
    if (!code) {
      state.appliedCode = null;
      persist();
      return render();
    }
    state.appliedCode = code;
    const t = totals();
    if (!t.promoValid) {
      persist();
      render();
      document.getElementById('f-code')?.setAttribute('aria-invalid', 'true');
      return;
    }
    persist();
    toast(`Cupom aplicado: − ${fmtBRL(t.discount)}`, 'ok');
    render();
  },

  checkout: (form) => startPayment(form),

  login: async (form, fd) => {
    clearErrors(form);
    const att = state.loginAttempts;
    if (att.lockedUntil > Date.now()) {
      return formAlert(form, `Muitas tentativas. Tente novamente em ${Math.ceil((att.lockedUntil - Date.now()) / 1000)} segundos.`);
    }
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '');
    let bad = false;
    if (!isValidEmail(email)) { fieldError(form, 'email', 'Informe um e-mail válido.'); bad = true; }
    if (!password) { fieldError(form, 'password', 'Informe sua senha.'); bad = true; }
    if (bad) return focusFirstInvalid(form);

    const user = state.users.find((u) => u.email === email);
    const ok = user && (await hashPassword(password, user.salt)) === user.passwordHash;
    if (!ok) {
      att.count += 1;
      if (att.count >= 5) { att.lockedUntil = Date.now() + 30000; att.count = 0; }
      persist();
      return formAlert(form, 'E-mail ou senha incorretos.'); // mensagem genérica: não revela se o e-mail existe
    }
    state.loginAttempts = { count: 0, lockedUntil: 0 };
    state.sessionUserId = user.id;
    persist();
    toast(`Olá, ${user.name.split(' ')[0]}!`, 'ok');
    go(form.dataset.next || '');
  },

  register: async (form, fd) => {
    clearErrors(form);
    const v = Object.fromEntries(fd.entries());
    const email = String(v.email || '').trim().toLowerCase();
    const errors = {};
    if (String(v.name || '').trim().split(/\s+/).length < 2) errors.name = 'Informe nome e sobrenome.';
    if (!isValidEmail(email)) errors.email = 'Informe um e-mail válido (ex.: nome@dominio.com).';
    else if (state.users.some((u) => u.email === email)) errors.email = 'Já existe uma conta com este e-mail. Tente entrar.';
    if (v.phone && !isValidPhone(v.phone)) errors.phone = 'Celular deve ter DDD + número (10 ou 11 dígitos).';
    if (v.cpf && !isValidCPF(v.cpf)) errors.cpf = 'CPF inválido. Confira os números ou deixe em branco.';
    if (!isStrongPassword(v.password)) errors.password = 'A senha precisa de 8+ caracteres, com letras e números.';
    if (v.password !== v.confirm) errors.confirm = 'As senhas não conferem.';
    if (!fd.get('terms')) errors.terms = 'Para criar a conta, é preciso aceitar os termos e a política de privacidade.';
    if (Object.keys(errors).length) {
      Object.entries(errors).forEach(([k, m]) => fieldError(form, k, m));
      formAlert(form, 'Revise os campos destacados.');
      return focusFirstInvalid(form);
    }
    const salt = uid('s');
    const now = new Date().toISOString();
    const marketing = !!fd.get('marketing');
    const user = {
      id: uid('usr'),
      name: String(v.name).trim(),
      email,
      phone: v.phone ? onlyDigits(v.phone) : '',
      cpf: v.cpf ? onlyDigits(v.cpf) : '',
      salt,
      passwordHash: await hashPassword(v.password, salt),
      marketing,
      points: 0,
      lifetimePoints: 0,
      pointsHistory: [],
      coupons: [],
      createdAt: now,
      consentLog: [
        { type: 'terms', version: CONSENT_VERSION, at: now },
        { type: 'marketing', value: marketing, at: now },
      ],
    };
    state.users.push(user);
    state.sessionUserId = user.id;
    persist();
    track('sign_up');
    toast('Conta criada! Bem-vindo(a) à Raízes+.', 'ok');
    go(form.dataset.next || '');
  },

  profile: (form, fd) => {
    clearErrors(form);
    const user = currentUser();
    const name = String(fd.get('name') || '').trim();
    const phone = String(fd.get('phone') || '');
    let bad = false;
    if (name.split(/\s+/).length < 2) { fieldError(form, 'name', 'Informe nome e sobrenome.'); bad = true; }
    if (phone && !isValidPhone(phone)) { fieldError(form, 'phone', 'Celular deve ter DDD + número.'); bad = true; }
    if (bad) return focusFirstInvalid(form);
    user.name = name;
    user.phone = onlyDigits(phone);
    persist();
    toast('Dados atualizados.', 'ok');
    render();
  },

  consent: (form, fd) => {
    saveConsent({ analytics: !!fd.get('analytics'), marketing: !!fd.get('marketing') });
    closeModal();
    toast('Preferências salvas.', 'ok');
    if (route().name === 'conta') render();
  },

  delete: (form, fd) => {
    clearErrors(form);
    if (String(fd.get('confirm') || '').trim().toUpperCase() !== 'EXCLUIR') {
      fieldError(form, 'confirm', 'Digite EXCLUIR exatamente para confirmar.');
      return focusFirstInvalid(form);
    }
    const user = currentUser();
    state.orders.forEach((o) => {
      if (o.userId === user.id) { o.userId = null; o.customerName = 'Anonimizado'; o.anonymized = true; o.channel = 'web'; }
    });
    state.users = state.users.filter((u) => u.id !== user.id);
    state.sessionUserId = null;
    state.appliedCode = null;
    persist();
    closeModal();
    toast('Conta excluída e dados pessoais apagados.', 'ok');
    go('');
  },

  pin: (form, fd) => {
    clearErrors(form);
    const role = form.dataset.role;
    if (fd.get('pin') !== STAFF_PINS[role]) {
      fieldError(form, 'pin', 'PIN incorreto.');
      return focusFirstInvalid(form);
    }
    ui.staffAuth[role] = true;
    if (role === 'admin') ui.staffAuth.equipe = true;
    render();
  },

  pickup: (form, fd) => {
    clearErrors(form);
    const code = String(fd.get('code') || '').trim().toUpperCase();
    if (!code) { fieldError(form, 'code', 'Informe o código.'); return focusFirstInvalid(form); }
    const o = state.orders.find((x) => x.code === code && x.unitId === ui.staffUnit && x.status !== 'retirado');
    if (!o) return formAlert(form, `Nenhum pedido em aberto com o código ${code} nesta unidade.`);
    if (o.status !== 'pronto') return formAlert(form, `O pedido #${o.number} ainda está em “${STATUS_LABEL[o.status]}”. Aguarde a cozinha.`);
    advanceOrder(o, 'atendimento');
    persist();
    toast(`Pedido #${o.number} entregue.`, 'ok');
    render();
  },
};

/* ================= Máscaras de entrada ================= */

const MASKS = {
  cpf: maskCPF,
  phone: (v) => {
    const d = onlyDigits(v).slice(0, 11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    return d.replace(/(\d{2})(\d{5})(\d{1,4})/, '($1) $2-$3');
  },
  card: (v) => onlyDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '),
  expiry: (v) => onlyDigits(v).slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2'),
};

/* ================= Eventos globais ================= */

document.addEventListener('click', (e) => {
  ui.lastActivity = Date.now();
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  fn(el, e);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const fn = forms[form.dataset.form];
  if (fn) fn(form, new FormData(form));
});

document.addEventListener('input', (e) => {
  ui.lastActivity = Date.now();
  const t = e.target;
  if (t.id === 'searchInput') {
    ui.query = t.value;
    renderGrid();
    return;
  }
  const mask = t.dataset?.mask;
  if (mask && MASKS[mask]) t.value = MASKS[mask](t.value);
  if (t.getAttribute('aria-invalid')) {
    t.removeAttribute('aria-invalid');
    const err = t.form?.querySelector(`[data-err="${t.name}"]`);
    if (err) err.textContent = '';
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  const kind = t.dataset?.change;
  if (!kind) return;
  const user = currentUser();
  if (kind === 'method') {
    ui.checkout.method = t.value;
    const box = document.getElementById('cardFields');
    if (box) box.hidden = t.value === 'pix';
  } else if (kind === 'show-pwd') {
    const pwd = t.form?.elements.password;
    if (pwd) pwd.type = t.checked ? 'text' : 'password';
  } else if (kind === 'marketing' && user) {
    user.marketing = t.checked;
    user.consentLog.push({ type: 'marketing', value: t.checked, at: new Date().toISOString() });
    persist();
    toast(t.checked ? 'Você vai receber nossas ofertas.' : 'Consentimento de marketing revogado.', 'ok');
    render();
  } else if (kind === 'analytics') {
    saveConsent({ analytics: t.checked, marketing: state.consent?.marketing });
    toast(t.checked ? 'Cookies de análise ativados.' : 'Cookies de análise desativados e dados coletados apagados.', 'ok');
    render();
  } else if (kind === 'staff-unit') {
    ui.staffUnit = t.value;
    render();
  } else if (kind === 'product') {
    const uId = ui.staffUnit;
    state.overrides[uId] = state.overrides[uId] || {};
    state.overrides[uId][t.dataset.id] = t.checked;
    persist();
    toast(t.checked ? 'Item disponível no cardápio.' : 'Item marcado como indisponível.', 'ok');
  }
});

$modal.addEventListener('click', (e) => { if (e.target === $modal) closeModal(); });

window.addEventListener('hashchange', render);

/* ================= Simulação: cozinha e inatividade do totem ================= */

setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const o of state.orders) {
    const last = new Date(o.history.at(-1).at).getTime();
    if ((o.status === 'recebido' && now - last > 8000) || (o.status === 'em_preparo' && now - last > 15000)) {
      changed = advanceOrder(o, 'simulacao') || changed;
    }
  }
  if (changed) {
    persist();
    const r = route().name;
    const typing = document.activeElement && $app.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if (['pedido', 'pedidos', 'equipe', 'admin'].includes(r) && !typing) render();
  }

  if (isTotem() && now - ui.lastActivity > 90000 && (state.cart.length || route().name !== '')) {
    state.cart = [];
    state.appliedCode = null;
    ui.checkout = null;
    persist();
    ui.lastActivity = now;
    toast('Sessão reiniciada por inatividade.');
    go('');
  }
}, 2000);

/* ================= Inicialização ================= */

const params = new URLSearchParams(location.search);
const canal = params.get('canal');
if (['web', 'app', 'totem'].includes(canal)) state.channel = canal;
const unidade = params.get('unidade');
if (unidade) setUnit(unidade);
persist();
render();

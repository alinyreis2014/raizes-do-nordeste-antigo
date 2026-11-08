// Testes unitários das regras de negócio. Rodar com: npm test  (ou: node --test tests/*.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidEmail, isStrongPassword, isValidPhone, isValidCPF, maskCPF, hideCPF,
  isValidCardNumber, cardBrand, isValidExpiry, isValidCVV,
  menuForUnit, evaluatePromo, calcTotals, addToCart, setQty,
  pointsFor, levelFor, canRedeem, nextStatus, pickupCode,
} from '../js/core.js';
import { PRODUCTS, PROMOS, REWARDS } from '../js/data.js';

const promo = (code) => PROMOS.find((p) => p.code === code);

test('CT-U01 e-mail: aceita válido e rejeita inválido', () => {
  assert.ok(isValidEmail('maria@exemplo.com.br'));
  assert.ok(!isValidEmail('maria@'));
  assert.ok(!isValidEmail('maria exemplo.com'));
  assert.ok(!isValidEmail(''));
});

test('CT-U02 senha forte: 8+ caracteres com letras e números', () => {
  assert.ok(isStrongPassword('cuscuz2026'));
  assert.ok(!isStrongPassword('curta1'));
  assert.ok(!isStrongPassword('somenteletras'));
  assert.ok(!isStrongPassword('12345678'));
});

test('CT-U03 CPF: dígitos verificadores', () => {
  assert.ok(isValidCPF('529.982.247-25'));
  assert.ok(!isValidCPF('529.982.247-26'));
  assert.ok(!isValidCPF('111.111.111-11'));
  assert.ok(!isValidCPF('123'));
  assert.equal(maskCPF('52998224725'), '529.982.247-25');
  assert.equal(hideCPF('52998224725'), '***.982.247-**');
});

test('CT-U04 celular com DDD', () => {
  assert.ok(isValidPhone('(81) 99999-1234'));
  assert.ok(isValidPhone('8133331234'));
  assert.ok(!isValidPhone('99999-1234'));
});

test('CT-U05 cartão: Luhn, bandeira, validade e CVV', () => {
  for (const n of ['4111 1111 1111 1111', '4000000000000002', '4000000000000069', '4000000000000119'])
    assert.ok(isValidCardNumber(n), n);
  assert.ok(!isValidCardNumber('4111 1111 1111 1112'));
  assert.equal(cardBrand('4111111111111111'), 'Visa');
  assert.equal(cardBrand('5555555555554444'), 'Mastercard');
  const now = new Date(2026, 10, 8);
  assert.ok(isValidExpiry('12/27', now));
  assert.ok(isValidExpiry('11/26', now));
  assert.ok(!isValidExpiry('10/26', now));
  assert.ok(!isValidExpiry('13/27', now));
  assert.ok(!isValidExpiry('1227', now));
  assert.ok(isValidCVV('123'));
  assert.ok(!isValidCVV('12a'));
});

test('CT-U06 cardápio dinâmico por unidade', () => {
  const ssa = menuForUnit(PRODUCTS, 'ssa-pel');
  const forMenu = menuForUnit(PRODUCTS, 'for-ald');
  assert.ok(ssa.some((p) => p.id === 'acaraje'));
  assert.ok(!forMenu.some((p) => p.id === 'acaraje'), 'acarajé não é vendido em Fortaleza');
  assert.equal(ssa.find((p) => p.id === 'acaraje').price, 16);
  assert.equal(forMenu.find((p) => p.id === 'caldo-cana').available, false);
  const off = menuForUnit(PRODUCTS, 'rec-bv', { 'rec-bv': { baiao: false } });
  assert.equal(off.find((p) => p.id === 'baiao').available, false, 'gerente desligou o item');
});

test('CT-U07 carrinho: adicionar, somar e remover', () => {
  const m = menuForUnit(PRODUCTS, 'rec-bv');
  const tapioca = m.find((p) => p.id === 'tapioca-queijo');
  let cart = addToCart([], tapioca);
  cart = addToCart(cart, tapioca, 2);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].qty, 3);
  cart = setQty(cart, 'tapioca-queijo', 0);
  assert.equal(cart.length, 0);
  const off = { ...tapioca, available: false };
  assert.throws(() => addToCart([], off), /indisponível/);
});

test('CT-U08 promoções: regras de pedido mínimo, dia, unidade e 1º pedido', () => {
  const friday = new Date(2026, 10, 6); // sexta
  const monday = new Date(2026, 10, 9);
  assert.equal(evaluatePromo(promo('ARRETADO'), { subtotal: 39.9, date: monday }).ok, false);
  assert.equal(evaluatePromo(promo('ARRETADO'), { subtotal: 40, date: monday }).discount, 5);
  assert.equal(evaluatePromo(promo('SEXTOU'), { subtotal: 60, date: monday }).ok, false);
  assert.equal(evaluatePromo(promo('SEXTOU'), { subtotal: 60, date: friday }).discount, 8);
  assert.equal(evaluatePromo(promo('CUSCUZSSA'), { subtotal: 100, unitId: 'rec-bv', date: monday }).ok, false);
  assert.equal(evaluatePromo(promo('CUSCUZSSA'), { subtotal: 100, unitId: 'ssa-pel', date: monday }).discount, 10, 'teto de R$ 10');
  assert.equal(evaluatePromo(promo('BEMVINDO10'), { subtotal: 50, ordersCount: 1, date: monday }).ok, false);
  assert.equal(evaluatePromo(promo('BEMVINDO10'), { subtotal: 50, ordersCount: 0, date: monday }).discount, 5);
  assert.equal(evaluatePromo(null, { subtotal: 50 }).reason, 'Cupom inválido.');
  assert.equal(evaluatePromo({ ...promo('ARRETADO'), validUntil: '2020-01-01' }, { subtotal: 99, date: monday }).reason, 'Este cupom expirou.');
});

test('CT-U09 totais: desconto nunca deixa o total negativo', () => {
  const items = [{ id: 'x', price: 5.5, qty: 1 }];
  const t = calcTotals(items, { code: 'X', type: 'fixed', value: 10 }, {});
  assert.equal(t.total, 0);
  const t2 = calcTotals([{ id: 'a', price: 14.9, qty: 2 }, { id: 'b', price: 9.9, qty: 1 }], null);
  assert.equal(t2.subtotal, 39.7);
  assert.equal(t2.total, 39.7);
});

test('CT-U10 fidelidade: pontos, níveis e resgate', () => {
  assert.equal(pointsFor(39.7), 39);
  assert.equal(pointsFor(-5), 0);
  assert.equal(levelFor(0).current.id, 'semente');
  assert.equal(levelFor(250).current.id, 'broto');
  assert.equal(levelFor(600).current.id, 'raiz');
  assert.equal(levelFor(600).next, null);
  assert.ok(Math.abs(levelFor(100).progress - 0.5) < 1e-9);
  assert.ok(!canRedeem(59, REWARDS[0]));
  assert.ok(canRedeem(60, REWARDS[0]));
});

test('CT-U11 status do pedido segue o fluxo e não passa do fim', () => {
  assert.equal(nextStatus('recebido'), 'em_preparo');
  assert.equal(nextStatus('em_preparo'), 'pronto');
  assert.equal(nextStatus('pronto'), 'retirado');
  assert.equal(nextStatus('retirado'), 'retirado');
  assert.match(pickupCode(), /^[A-Z]\d{3}$/);
});

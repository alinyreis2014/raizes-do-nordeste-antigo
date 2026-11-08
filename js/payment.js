/**
 * payment.js — Simulação de um provedor de pagamento EXTERNO (gateway).
 *
 * Nenhum pagamento real é feito. O módulo imita o contrato de uma API de pagamentos:
 *   POST /payments           -> { transactionId, status: approved | declined | pending }
 *   GET  /payments/:id       -> { status }   (consulta do Pix)
 *
 * Cartões de teste (qualquer validade futura e CVV de 3 dígitos):
 *   4111 1111 1111 1111  -> aprovado
 *   4000 0000 0000 0002  -> recusado (saldo insuficiente)
 *   4000 0000 0000 0069  -> recusado (cartão expirado na operadora)
 *   4000 0000 0000 0119  -> erro de comunicação (gateway indisponível)
 */

import { onlyDigits, cardBrand } from './core.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const latency = () => 1200 + Math.random() * 900;
const txId = () => `TX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const pixStore = new Map();

export class GatewayError extends Error {}

export async function requestPayment({ method, amount, card }) {
  await wait(latency());

  if (!(amount > 0)) return { status: 'declined', message: 'Valor inválido.' };

  if (method === 'pix') {
    const id = txId();
    pixStore.set(id, { createdAt: Date.now(), amount });
    const code = `00020126580014BR.GOV.BCB.PIX0136raizes-demo-${id}5204000053039865406${amount.toFixed(2)}5802BR5920RAIZES DO NORDESTE6006RECIFE`;
    return { status: 'pending', transactionId: id, pixCode: code, expiresIn: 300 };
  }

  const digits = onlyDigits(card?.number);
  // O número completo nunca é guardado: o "token" simulado só mantém bandeira e final.
  const token = { brand: cardBrand(digits), last4: digits.slice(-4) };

  if (digits.endsWith('0119')) throw new GatewayError('Não foi possível falar com o provedor de pagamento. Nenhum valor foi cobrado.');
  if (digits.endsWith('0002')) return { status: 'declined', transactionId: txId(), message: 'Pagamento recusado: saldo ou limite insuficiente.', token };
  if (digits.endsWith('0069')) return { status: 'declined', transactionId: txId(), message: 'Pagamento recusado pela operadora do cartão.', token };

  return { status: 'approved', transactionId: txId(), token, method };
}

/** Consulta o status de um Pix. Na demo ele é "pago" ~5 s após a geração. */
export async function checkPix(transactionId) {
  await wait(400);
  const p = pixStore.get(transactionId);
  if (!p) return { status: 'not_found' };
  if (Date.now() - p.createdAt > 300000) return { status: 'expired' };
  return { status: Date.now() - p.createdAt > 5000 ? 'approved' : 'pending' };
}

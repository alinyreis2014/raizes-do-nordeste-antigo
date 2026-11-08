/**
 * data.js — Dados simulados (mock) que substituem a API do back-end.
 * Em produção, estes dados viriam de endpoints como GET /units e GET /units/:id/menu.
 */

export const UNITS = [
  {
    id: 'rec-bv',
    name: 'Recife — Boa Viagem',
    address: 'Av. Conselheiro Aguiar, 1200 — Boa Viagem, Recife/PE',
    hours: 'Todos os dias, 7h às 22h',
    open: [7, 22],
  },
  {
    id: 'ssa-pel',
    name: 'Salvador — Pelourinho',
    address: 'Largo do Pelourinho, 45 — Centro Histórico, Salvador/BA',
    hours: 'Todos os dias, 8h às 23h',
    open: [8, 23],
  },
  {
    id: 'for-ald',
    name: 'Fortaleza — Aldeota',
    address: 'Av. Santos Dumont, 3000 — Aldeota, Fortaleza/CE',
    hours: 'Seg. a sáb., 7h às 21h',
    open: [7, 21],
  },
];

export const CATEGORIES = [
  { id: 'cafe', name: 'Café da manhã' },
  { id: 'pratos', name: 'Pratos' },
  { id: 'lanches', name: 'Lanches' },
  { id: 'bebidas', name: 'Bebidas' },
  { id: 'doces', name: 'Doces' },
];

const all = (price) => ({ 'rec-bv': { price }, 'ssa-pel': { price }, 'for-ald': { price } });

export const PRODUCTS = [
  {
    id: 'tapioca-queijo', name: 'Tapioca de queijo coalho', category: 'cafe', icon: '🫓',
    desc: 'Goma fresca com queijo coalho derretido e manteiga da terra.', basePrice: 14.9,
    tags: ['vegetariano'], units: all(14.9),
  },
  {
    id: 'cuscuz-ovo', name: 'Cuscuz com ovo', category: 'cafe', icon: '🍳',
    desc: 'Cuscuz de milho no vapor com ovo estrelado e manteiga.', basePrice: 12.5,
    tags: ['vegetariano', 'sem glúten'], units: all(12.5),
  },
  {
    id: 'bolo-rolo', name: 'Bolo de rolo (fatia)', category: 'doces', icon: '🍰',
    desc: 'Receita pernambucana com goiabada em camadas finas.', basePrice: 9.0,
    tags: ['vegetariano'],
    units: { 'rec-bv': { price: 8.5 }, 'ssa-pel': { price: 9.5 }, 'for-ald': { price: 9.0 } },
  },
  {
    id: 'baiao', name: 'Baião de dois', category: 'pratos', icon: '🍛',
    desc: 'Arroz, feijão-verde, queijo coalho e nata. Serve 1 pessoa.', basePrice: 32.0,
    tags: [], units: all(32.0),
  },
  {
    id: 'carne-sol', name: 'Carne de sol com macaxeira', category: 'pratos', icon: '🥩',
    desc: 'Carne de sol na manteiga de garrafa, macaxeira frita e vinagrete.', basePrice: 42.9,
    tags: ['sem glúten'], units: all(42.9),
  },
  {
    id: 'acaraje', name: 'Acarajé completo', category: 'lanches', icon: '🧆',
    desc: 'Bolinho de feijão-fradinho com vatapá, caruru e camarão seco.', basePrice: 18.0,
    tags: [],
    units: { 'ssa-pel': { price: 16.0 }, 'rec-bv': { price: 19.0 } },
  },
  {
    id: 'escondidinho', name: 'Escondidinho de charque', category: 'pratos', icon: '🥘',
    desc: 'Purê de macaxeira gratinado com charque desfiada.', basePrice: 29.9,
    tags: ['sem glúten'], units: all(29.9),
  },
  {
    id: 'sanduiche-sol', name: 'Sanduíche de carne de sol', category: 'lanches', icon: '🥪',
    desc: 'Pão artesanal, carne de sol, queijo coalho e cebola caramelizada.', basePrice: 24.9,
    tags: [], units: all(24.9),
  },
  {
    id: 'cartola', name: 'Cartola', category: 'doces', icon: '🍌',
    desc: 'Banana frita, queijo manteiga, açúcar e canela.', basePrice: 15.0,
    tags: ['vegetariano'], units: { 'rec-bv': { price: 15.0 }, 'for-ald': { price: 14.0 } },
  },
  {
    id: 'suco-caja', name: 'Suco de cajá (500 ml)', category: 'bebidas', icon: '🧃',
    desc: 'Polpa natural, feito na hora. Com ou sem açúcar.', basePrice: 9.9,
    tags: ['vegano', 'sem glúten'], units: all(9.9),
  },
  {
    id: 'caldo-cana', name: 'Caldo de cana (500 ml)', category: 'bebidas', icon: '🥤',
    desc: 'Moído na hora, com limão.', basePrice: 8.0,
    tags: ['vegano', 'sem glúten'],
    units: { 'rec-bv': { price: 8.0 }, 'for-ald': { price: 7.5, available: false } },
  },
  {
    id: 'cafe-coado', name: 'Café coado', category: 'bebidas', icon: '☕',
    desc: 'Café do sertão coado no pano.', basePrice: 5.5,
    tags: ['vegano'], units: all(5.5),
  },
];

/**
 * Promoções e campanhas.
 * weekdays: 0 = domingo ... 6 = sábado
 */
export const PROMOS = [
  {
    code: 'BEMVINDO10', title: '10% no primeiro pedido', type: 'percent', value: 10, maxDiscount: 15,
    firstOrderOnly: true, description: 'Válido para o primeiro pedido da sua conta. Desconto máximo de R$ 15.',
  },
  {
    code: 'SEXTOU', title: 'R$ 8 off na sexta', type: 'fixed', value: 8, minOrder: 50, weekdays: [5],
    description: 'Toda sexta-feira em pedidos a partir de R$ 50.',
  },
  {
    code: 'ARRETADO', title: 'R$ 5 off acima de R$ 40', type: 'fixed', value: 5, minOrder: 40,
    validUntil: '2027-12-31T23:59:59', description: 'Campanha de lançamento. Pedido mínimo de R$ 40.',
  },
  {
    code: 'CUSCUZSSA', title: '15% em Salvador', type: 'percent', value: 15, maxDiscount: 10, units: ['ssa-pel'],
    description: 'Exclusivo da unidade Pelourinho. Desconto máximo de R$ 10.',
  },
];

/** Catálogo de recompensas do programa de fidelidade. Cada resgate gera um cupom pessoal. */
export const REWARDS = [
  { id: 'rw-cafe', name: 'Café coado grátis', cost: 60, type: 'fixed', value: 5.5, icon: '☕' },
  { id: 'rw-10', name: 'R$ 10 de desconto', cost: 120, type: 'fixed', value: 10, icon: '🎟️' },
  { id: 'rw-20pct', name: '20% em um pedido (até R$ 25)', cost: 250, type: 'percent', value: 20, maxDiscount: 25, icon: '⭐' },
];

/** PINs de demonstração para os perfis internos (em produção: login corporativo com perfis/RBAC). */
export const STAFF_PINS = { equipe: '1234', admin: '9999' };

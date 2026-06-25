// Pool de modificadores do dominó — PARTE 1 (nucleo portavel).
//
// Apenas os modificadores expressaveis na DSL fechada atual (M1): triggers sobre tags
// e as 7 ops basicas. Juntos, leem TODAS as tags declaradas pelo board — o validador
// de vocabulario (T5) fica verde, sem tags orfas.
//
// Os modificadores topologicos / de memoria de rodada / de evento (serpente, numerologo,
// mirror_engine, canhoto, ferrolho, ...) chegam na PARTE 2, junto das extensoes da DSL
// que eles exigem.

import type { Modifier } from '../../engine/index'

export const DOMINO_POOL_PORTABLE: Modifier[] = [
  {
    id: 'heavyweight',
    name: 'Pesadao',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'tag_value', tag: 'value_sum', cmp: '>=', value: 9 },
    effects: [{ op: 'add_base', args: [8] }],
  },
  {
    id: 'lightfingers',
    name: 'Dedo-Leve',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'tag_value', tag: 'value_sum', cmp: '<=', value: 3 },
    effects: [{ op: 'add_mult', args: [3] }],
  },
  {
    id: 'even_steven',
    name: 'Par Perfeito',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'has_tag', tag: 'is_even' },
    effects: [{ op: 'add_mult', args: [4] }],
  },
  {
    id: 'odd_todd',
    name: 'Impar Teimoso',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'has_tag', tag: 'is_odd' },
    effects: [{ op: 'add_mult', args: [4] }],
  },
  {
    id: 'polish',
    name: 'Lustro',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'has_tag', tag: 'is_double' },
    effects: [{ op: 'add_money', args: [1] }],
  },
  {
    id: 'high_roller',
    name: 'Cabeca-Alta',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'tag_value', tag: 'value_max', cmp: '>=', value: 6 },
    effects: [{ op: 'add_mult', args: [2] }],
  },
  {
    id: 'low_baller',
    name: 'Pe-no-Chao',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'tag_value', tag: 'value_min', cmp: '==', value: 0 },
    effects: [{ op: 'add_base', args: [4] }],
  },
  {
    id: 'sixer',
    name: 'Meia-Duzia',
    rarity: 'uncommon',
    cost: 6,
    slotType: 'standard',
    trigger: { kind: 'always' },
    effects: [{ op: 'add_mult_per', args: [2], query: { target: 'tag', key: 'contains', value: 6 } }],
  },
]

// Modificadores TOPOLOGICOS (PARTE 2a): usam a DSL estendida — quantidade vinda de
// uma tag, contagem na cobra (snapshot), e predicado de comprimento da cobra.
export const DOMINO_POOL_TOPOLOGICAL: Modifier[] = [
  {
    id: 'martelo',
    name: 'Martelo',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    // Dupla: soma o proprio value_sum a base (peca pesada vira ainda mais pesada).
    trigger: { kind: 'has_tag', tag: 'is_double' },
    effects: [{ op: 'add_base_tag', tag: 'value_sum', args: [1] }],
  },
  {
    id: 'colecionador',
    name: 'Colecionador',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    // +2 de base por peca da cobra que contem um seis. Arquetipo "seis".
    trigger: { kind: 'always' },
    effects: [{ op: 'add_base_per', args: [2], query: { target: 'snapshot', key: 'contains', value: 6 } }],
  },
  {
    id: 'numerologo',
    name: 'Numerologo',
    rarity: 'uncommon',
    cost: 6,
    slotType: 'standard',
    // +3 de mult por peca da cobra que contem o numero recem-exposto (closes_number).
    trigger: { kind: 'always' },
    effects: [
      { op: 'add_mult_per', args: [3], query: { target: 'snapshot', key: 'contains', fromTag: 'closes_number' } },
    ],
  },
  {
    id: 'serpente',
    name: 'Serpente',
    rarity: 'rare',
    cost: 8,
    slotType: 'standard',
    // A cada 5 pecas na cobra, dobra o multiplicador. Arquetipo "cobra longa".
    trigger: { kind: 'snapshot', metric: 'chainLength', mod: 5, cmp: '==', value: 0 },
    effects: [{ op: 'mul_mult', args: [2] }],
  },
]

// Modificadores de MEMORIA DE RODADA (PARTE 2b): dependem do que veio antes na rodada.
export const DOMINO_POOL_MEMORY: Modifier[] = [
  {
    id: 'crescente',
    name: 'Crescente',
    rarity: 'uncommon',
    cost: 6,
    slotType: 'standard',
    // +2 de mult quando a jogada vale mais que a anterior (ordenacao/tempo).
    trigger: { kind: 'tag_vs_memory', tag: 'value_sum', field: 'prevValueSum', cmp: '>' },
    effects: [{ op: 'add_mult', args: [2] }],
  },
  {
    id: 'gemeos',
    name: 'Gemeos',
    rarity: 'rare',
    cost: 8,
    slotType: 'standard',
    // Duas duplas seguidas: dobra o mult na 2a.
    trigger: {
      kind: 'and',
      preds: [
        { kind: 'has_tag', tag: 'is_double' },
        { kind: 'memory_flag', field: 'prevWasDouble' },
      ],
    },
    effects: [{ op: 'mul_mult', args: [2] }],
  },
  {
    id: 'mirror_engine',
    name: 'Motor Espelho',
    rarity: 'rare',
    cost: 8,
    slotType: 'standard',
    // Cada dupla ja jogada na rodada escala o mult em 1.2 (bola de neve de duplas).
    trigger: { kind: 'always' },
    effects: [{ op: 'mul_mult_pow', args: [1.2], memoryField: 'doubles' }],
  },
]

/** O pool completo disponivel ate aqui (portavel + topologico + memoria). */
export const DOMINO_POOL: Modifier[] = [
  ...DOMINO_POOL_PORTABLE,
  ...DOMINO_POOL_TOPOLOGICAL,
  ...DOMINO_POOL_MEMORY,
]

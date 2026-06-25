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

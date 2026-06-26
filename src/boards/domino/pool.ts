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
    description: 'Peca pesada (soma das metades >= 9): +8 fichas.',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'tag_value', tag: 'value_sum', cmp: '>=', value: 9 },
    effects: [{ op: 'add_base', args: [8] }],
  },
  {
    id: 'lightfingers',
    name: 'Dedo-Leve',
    description: 'Peca leve (soma <= 3): +3 de multiplicador.',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'tag_value', tag: 'value_sum', cmp: '<=', value: 3 },
    effects: [{ op: 'add_mult', args: [3] }],
  },
  {
    id: 'even_steven',
    name: 'Par Perfeito',
    description: 'Soma da peca e PAR: +4 de multiplicador.',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'has_tag', tag: 'is_even' },
    effects: [{ op: 'add_mult', args: [4] }],
  },
  {
    id: 'odd_todd',
    name: 'Impar Teimoso',
    description: 'Soma da peca e IMPAR: +4 de multiplicador.',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'has_tag', tag: 'is_odd' },
    effects: [{ op: 'add_mult', args: [4] }],
  },
  {
    id: 'polish',
    name: 'Lustro',
    description: 'Cada dupla que voce joga: +$1.',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'has_tag', tag: 'is_double' },
    effects: [{ op: 'add_money', args: [1] }],
  },
  {
    id: 'high_roller',
    name: 'Cabeca-Alta',
    description: 'A peca tem um 6: +2 de multiplicador.',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'tag_value', tag: 'value_max', cmp: '>=', value: 6 },
    effects: [{ op: 'add_mult', args: [2] }],
  },
  {
    id: 'low_baller',
    name: 'Pe-no-Chao',
    description: 'A peca tem um 0 (branco): +4 fichas.',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'tag_value', tag: 'value_min', cmp: '==', value: 0 },
    effects: [{ op: 'add_base', args: [4] }],
  },
  {
    id: 'sixer',
    name: 'Meia-Duzia',
    description: '+2 de multiplicador para cada 6 na peca jogada.',
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
    description: 'Dupla: soma o proprio valor as fichas (uma 6|6 da +12).',
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
    description: '+2 fichas por peca NA COBRA que contem um 6.',
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
    description: '+3 de mult por peca na cobra com o numero que voce acabou de expor.',
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
    description: 'A cada 3 pecas na cobra, DOBRA o multiplicador.',
    rarity: 'rare',
    cost: 8,
    slotType: 'standard',
    // A cada 3 pecas na cobra, dobra o multiplicador. Arquetipo "cobra longa".
    trigger: { kind: 'snapshot', metric: 'chainLength', mod: 3, cmp: '==', value: 0 },
    effects: [{ op: 'mul_mult', args: [2] }],
  },
  {
    id: 'the_count',
    name: 'O Conde',
    description: '+2 de mult por metade da peca igual ao numero mais comum da cobra.',
    rarity: 'uncommon',
    cost: 6,
    slotType: 'standard',
    // +2 de mult por metade da peca jogada igual ao numero mais comum da cobra.
    trigger: { kind: 'always' },
    effects: [
      { op: 'add_mult_per', args: [2], query: { target: 'entity', key: 'contains', equalsSnapshot: 'mostCommonNumber' } },
    ],
  },
]

// Modificadores de EVENTO (PARTE 2c): reagem a momentos da rodada, nao a jogadas.
export const DOMINO_POOL_EVENTS: Modifier[] = [
  {
    id: 'ferrolho',
    name: 'Ferrolho',
    description: 'Ao TRAVAR a rodada: +$6 e devolve 1 jogada.',
    rarity: 'uncommon',
    cost: 6,
    slotType: 'standard',
    // Ao travar: converte o "trancado" em recurso (dinheiro + 1 jogada de volta).
    trigger: { kind: 'always' },
    effects: [],
    hooks: [
      {
        on: 'lock',
        effects: [
          { op: 'add_money', args: [6] },
          { op: 'add_resource', resource: 'plays', args: [1] },
        ],
      },
    ],
  },
  {
    id: 'economia_circular',
    name: 'Economia Circular',
    description: 'Fim da rodada: +$1 por troca (redraw) NAO usada.',
    rarity: 'uncommon',
    cost: 6,
    slotType: 'standard',
    // Fim de rodada: +1 de dinheiro por redraw nao usado (jogo de juros).
    trigger: { kind: 'always' },
    effects: [],
    hooks: [{ on: 'round_end', effects: [{ op: 'add_money_per_resource', resource: 'redraws', args: [1] }] }],
  },
  {
    id: 'aposta',
    name: 'Aposta',
    description: 'Inicio da rodada: paga $3. Cada jogada: +1 de mult por $ que voce tem.',
    rarity: 'rare',
    cost: 8,
    slotType: 'standard',
    // Inicio de rodada: paga 3. Cada jogada: +1 de mult por dinheiro retido (escala arriscada).
    trigger: { kind: 'always' },
    effects: [{ op: 'add_mult_run', runField: 'money', args: [1] }],
    hooks: [{ on: 'round_start', effects: [{ op: 'add_money', args: [-3] }] }],
  },
]

// Modificadores de REGRA (PARTE 2c): mudam board/loja. O comportamento completo e
// aplicado pelo board/loja (helpers em engine/events.ts); a integracao no loop jogavel
// chega no M5 (CLI).
export const DOMINO_POOL_RULE: Modifier[] = [
  {
    id: 'canhoto',
    name: 'Canhoto',
    description: '(regra) Permite jogar nas duas pontas. [em desenvolvimento]',
    rarity: 'uncommon',
    cost: 6,
    slotType: 'standard',
    trigger: { kind: 'always' },
    effects: [],
    rule: { kind: 'two_ends_play' },
  },
  {
    id: 'pente_fino',
    name: 'Pente-Fino',
    description: '(regra) Afina seu baralho na loja. [em desenvolvimento]',
    rarity: 'common',
    cost: 4,
    slotType: 'standard',
    trigger: { kind: 'always' },
    effects: [],
    rule: { kind: 'shop_thinning', amount: 2 },
  },
]

// Modificadores de MEMORIA DE RODADA (PARTE 2b): dependem do que veio antes na rodada.
export const DOMINO_POOL_MEMORY: Modifier[] = [
  {
    id: 'crescente',
    name: 'Crescente',
    description: 'Jogada que vale MAIS que a anterior: +2 de multiplicador.',
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
    description: 'Dupla logo apos outra dupla: TRIPLICA o multiplicador.',
    rarity: 'rare',
    cost: 8,
    slotType: 'standard',
    // Duas duplas seguidas: triplica o mult na 2a.
    trigger: {
      kind: 'and',
      preds: [
        { kind: 'has_tag', tag: 'is_double' },
        { kind: 'memory_flag', field: 'prevWasDouble' },
      ],
    },
    effects: [{ op: 'mul_mult', args: [3] }],
  },
  {
    id: 'mirror_engine',
    name: 'Motor Espelho',
    description: 'Cada dupla ja jogada na rodada multiplica por 1,6 (acumula).',
    rarity: 'rare',
    cost: 8,
    slotType: 'standard',
    // Cada dupla ja jogada na rodada escala o mult em 1.6 (bola de neve de duplas).
    trigger: { kind: 'always' },
    effects: [{ op: 'mul_mult_pow', args: [1.6], memoryField: 'doubles' }],
  },
]

/** O pool completo (portavel + topologico + memoria + eventos + regras). 21 mods. */
export const DOMINO_POOL: Modifier[] = [
  ...DOMINO_POOL_PORTABLE,
  ...DOMINO_POOL_TOPOLOGICAL,
  ...DOMINO_POOL_MEMORY,
  ...DOMINO_POOL_EVENTS,
  ...DOMINO_POOL_RULE,
]

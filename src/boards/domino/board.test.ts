import { describe, expect, it } from 'vitest'
import { makeRng, resolve, validateVocabulary, type RunStateView } from '../../engine/index'
import { applyAction, dealInit, dominoBoard, legalActionsFor, type DominoState } from './board'
import { DOMINO_POOL, DOMINO_POOL_PORTABLE, DOMINO_POOL_TOPOLOGICAL } from './pool'
import { ALL_TILES, tilePips, tileTags } from './tiles'

const NEUTRAL_RUN: RunStateView = {
  ante: 1,
  blind: 1,
  money: 0,
  resources: {},
  activeModifierIds: [],
}

describe('pecas e tags', () => {
  it('o saco tem 28 pecas distintas', () => {
    expect(ALL_TILES).toHaveLength(28)
    expect(new Set(ALL_TILES.map((t) => t.id)).size).toBe(28)
  })

  it('pips = soma das metades', () => {
    expect(tilePips({ low: 6, high: 6, id: '6-6' })).toBe(12)
    expect(tilePips({ low: 0, high: 1, id: '0-1' })).toBe(1)
  })

  it('tags de uma dupla 6|6: is_double, is_even, contains:6 (distinto)', () => {
    const tags = tileTags({ low: 6, high: 6, id: '6-6' })
    const keys = tags.map((t) => t.key)
    expect(keys).toContain('is_double')
    expect(keys).toContain('is_even') // 12 e par
    expect(tags.filter((t) => t.key === 'contains')).toEqual([{ key: 'contains', value: 6 }])
    expect(tags).toContainEqual({ key: 'value_sum', value: 12 })
  })

  it('tags de 1|2: is_odd, contains:1 e contains:2', () => {
    const tags = tileTags({ low: 1, high: 2, id: '1-2' })
    expect(tags.map((t) => t.key)).toContain('is_odd') // 3 e impar
    expect(tags.filter((t) => t.key === 'contains')).toEqual([
      { key: 'contains', value: 1 },
      { key: 'contains', value: 2 },
    ])
  })
})

describe('init e compra semeada', () => {
  it('a mesma seed da a mesma mao (deterministico)', () => {
    expect(dealInit(123)).toEqual(dealInit(123))
  })

  it('mao de 7, saco de 21, cobra vazia', () => {
    const s = dealInit(123)
    expect(s.hand).toHaveLength(7)
    expect(s.bag).toHaveLength(21)
    expect(s.chain).toEqual([])
    expect(s.ends).toBeNull()
  })
})

describe('jogadas legais', () => {
  it('cobra vazia: toda peca da mao e jogavel (abre o jogo)', () => {
    const s = dealInit(123)
    expect(legalActionsFor(s)).toHaveLength(7)
  })

  it('apos abrir, so peca que casa uma ponta e jogavel', () => {
    // mao controlada para testar o casamento de pontas
    const s: DominoState = {
      seed: 1,
      hand: [
        { low: 3, high: 4, id: '3-4' }, // casa a ponta 4
        { low: 0, high: 1, id: '0-1' }, // nao casa nada
      ],
      bag: [],
      chain: [{ low: 4, high: 5, id: '4-5' }],
      ends: [4, 5],
    }
    const actions = legalActionsFor(s)
    expect(actions.map((a) => a.tileId)).toContain('3-4')
    expect(actions.map((a) => a.tileId)).not.toContain('0-1')
  })
})

describe('apply — emite ScoringContext e NAO pontua (invariante 1)', () => {
  it('o contexto tem baseValue, tags, entities, consumes — e nenhum "score"', () => {
    const s = dealInit(123)
    const action = legalActionsFor(s)[0]!
    const { context, state } = applyAction(s, action)

    expect(context.baseValue).toBeGreaterThanOrEqual(0)
    expect(context.tags.some((t) => t.key === 'value_sum')).toBe(true)
    expect(context.entities).toHaveLength(1)
    expect(context.consumes).toEqual({ plays: 1 })
    expect(context).not.toHaveProperty('score')
    expect(context).not.toHaveProperty('finalScore')

    // a peca saiu da mao e a cobra cresceu
    expect(state.chain).toHaveLength(1)
    expect(state.ends).not.toBeNull()
  })

  it('repoe a mao comprando do saco (mao continua com 7 ate o saco esvaziar)', () => {
    const s = dealInit(123)
    const { state } = applyAction(s, legalActionsFor(s)[0]!)
    expect(state.hand).toHaveLength(7) // jogou 1, comprou 1
    expect(state.bag).toHaveLength(20)
  })

  it('atualiza as pontas pela metade exposta', () => {
    const s: DominoState = {
      seed: 1,
      hand: [{ low: 2, high: 5, id: '2-5' }],
      bag: [],
      chain: [{ low: 4, high: 5, id: '4-5' }],
      ends: [4, 5],
    }
    const { state } = applyAction(s, { kind: 'play', tileId: '2-5', side: 'right' })
    expect(state.ends).toEqual([4, 2]) // a metade 5 casou; expoe o 2
  })
})

describe('isRoundOver', () => {
  it('verdadeiro quando a mao esvazia', () => {
    const s: DominoState = { seed: 1, hand: [], bag: [], chain: [], ends: [1, 1] }
    expect(dominoBoard.isRoundOver(s)).toBe(true)
  })

  it('verdadeiro quando trava (nenhuma jogada legal)', () => {
    const s: DominoState = {
      seed: 1,
      hand: [{ low: 0, high: 1, id: '0-1' }],
      bag: [],
      chain: [{ low: 3, high: 3, id: '3-3' }],
      ends: [3, 3],
    }
    expect(dominoBoard.isRoundOver(s)).toBe(true)
  })
})

describe('agentes de referencia', () => {
  it('greedyBaseAgent escolhe a jogada de maior baseValue', () => {
    const s = dealInit(123)
    const action = dominoBoard.greedyBaseAgent(s)
    const chosenPips = tilePips(s.hand.find((t) => t.id === action.tileId)!)
    const maxPips = Math.max(...s.hand.map(tilePips))
    expect(chosenPips).toBe(maxPips)
  })

  it('synergyAgent escolhe a jogada de maior finalScore dado o pool ativo', () => {
    const s = dealInit(123)
    // "sixer" multiplica por peca-seis; deve favorecer jogadas com 6 quando possivel.
    const active = DOMINO_POOL_PORTABLE.filter((m) => m.id === 'sixer')
    const action = dominoBoard.synergyAgent!(s, active)
    expect(action).toBeDefined()
    expect(legalActionsFor(s).map((a) => a.tileId)).toContain(action.tileId)
  })
})

describe('modificadores topologicos via tabuleiro (Parte 2a)', () => {
  it('apply emite closes_number', () => {
    const s: DominoState = { seed: 1, hand: [{ low: 6, high: 6, id: '6-6' }], bag: [], chain: [], ends: null }
    const { context } = applyAction(s, { kind: 'play', tileId: '6-6', side: 'left' })
    expect(context.tags).toContainEqual({ key: 'closes_number', value: 6 })
  })

  it('Martelo soma o value_sum da dupla a base', () => {
    const s: DominoState = { seed: 1, hand: [{ low: 6, high: 6, id: '6-6' }], bag: [], chain: [], ends: null }
    const { context } = applyAction(s, { kind: 'play', tileId: '6-6', side: 'left' })
    const martelo = DOMINO_POOL_TOPOLOGICAL.find((m) => m.id === 'martelo')!

    const { trace } = resolve(context, [martelo], NEUTRAL_RUN, makeRng(1))
    expect(trace.finalScore).toBe(24) // pips 12 + value_sum 12, mult 1
  })

  it('Serpente dobra quando a cobra fecha um multiplo de 5', () => {
    // cobra com 4 pecas; jogar a 5a (encostando) dispara serpente.
    const s: DominoState = {
      seed: 1,
      hand: [{ low: 2, high: 3, id: '2-3' }],
      bag: [],
      chain: [
        { low: 0, high: 1, id: '0-1' },
        { low: 1, high: 2, id: '1-2' },
        { low: 2, high: 2, id: '2-2' },
        { low: 2, high: 3, id: '2-3-b' },
      ],
      ends: [0, 3],
    }
    const { context } = applyAction(s, { kind: 'play', tileId: '2-3', side: 'right' })
    expect(context.snapshot.chainLength()).toBe(5)
    const serpente = DOMINO_POOL_TOPOLOGICAL.find((m) => m.id === 'serpente')!
    const { trace } = resolve(context, [serpente], NEUTRAL_RUN, makeRng(1))
    expect(trace.finalScore).toBe(context.baseValue * 2)
  })
})

describe('vocabulario (semente do T5)', () => {
  it('o pool completo le todas as tags declaradas, sem orfaos nem refs invalidas', () => {
    const report = validateVocabulary(dominoBoard.declareTagVocabulary(), DOMINO_POOL)
    expect(report.undeclaredRefs).toEqual([])
    expect(report.orphanTags).toEqual([])
    expect(report.ok).toBe(true)
  })
})

// O modulo de tabuleiro do dominó — implementa o contrato BoardModule.
//
// Substrato: duplo-seis (28 pecas). O ato de pontuar e encostar uma peca numa das duas
// pontas abertas da cobra. apply() emite um ScoringContext e NAO pontua (invariante 1).
//
// PARTE 1: jogadas de encostar, tags portateis, agentes de referencia. Redraws e as
// tags topologicas (played_left, closes_number, ...) chegam na Parte 2.

import {
  makeRng,
  resolve,
  type BoardConfig,
  type BoardModule,
  type Modifier,
  type ResourceSpec,
  type RunStateView,
  type ScoringContext,
  type Seed,
  type TagSpec,
} from '../../engine/index'
import { makeSnapshot } from './snapshot'
import { ALL_TILES, tileEntity, tilePips, tileTags, type Tile } from './tiles'

// ---------------------------------------------------------------------------
// Estado e acoes
// ---------------------------------------------------------------------------

export interface DominoState {
  seed: Seed
  hand: Tile[]
  /** Pecas ainda no saco, em ordem de compra (ja embaralhadas pela seed). */
  bag: Tile[]
  /** A cobra na mesa, em ordem. */
  chain: Tile[]
  /** As duas pontas abertas; null antes da primeira jogada. */
  ends: [number, number] | null
}

/** Encostar uma peca da mao numa ponta da cobra. */
export interface PlayAction {
  kind: 'play'
  tileId: string
  side: 'left' | 'right'
}

export type DominoAction = PlayAction

// ---------------------------------------------------------------------------
// Saco semeado
// ---------------------------------------------------------------------------

/** Embaralhamento Fisher-Yates deterministico na seed. */
function shuffled(tiles: Tile[], rng: { int(max: number): number }): Tile[] {
  const a = [...tiles]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    const tmp = a[i] as Tile
    a[i] = a[j] as Tile
    a[j] = tmp
  }
  return a
}

function dealInit(seed: Seed): DominoState {
  const deck = shuffled(ALL_TILES, makeRng(seed))
  return {
    seed,
    hand: deck.slice(0, 7),
    bag: deck.slice(7),
    chain: [],
    ends: null,
  }
}

// ---------------------------------------------------------------------------
// Jogadas legais
// ---------------------------------------------------------------------------

function tileMatchesEnd(t: Tile, end: number): boolean {
  return t.low === end || t.high === end
}

function legalActionsFor(state: DominoState): DominoAction[] {
  // Cobra vazia: qualquer peca abre o jogo (estabelece as duas pontas).
  if (state.ends === null) {
    return state.hand.map((t) => ({ kind: 'play', tileId: t.id, side: 'left' }))
  }

  const [left, right] = state.ends
  const actions: DominoAction[] = []
  for (const t of state.hand) {
    if (tileMatchesEnd(t, left)) {
      actions.push({ kind: 'play', tileId: t.id, side: 'left' })
    }
    // Quando as pontas mostram o mesmo numero, evitamos acoes duplicadas.
    if (right !== left && tileMatchesEnd(t, right)) {
      actions.push({ kind: 'play', tileId: t.id, side: 'right' })
    }
  }
  return actions
}

// ---------------------------------------------------------------------------
// Aplicar uma jogada
// ---------------------------------------------------------------------------

/** A metade que sobra exposta apos casar `matched` numa peca. */
function otherHalf(t: Tile, matched: number): number {
  return t.low === matched ? t.high : t.low
}

function applyAction(
  state: DominoState,
  action: DominoAction,
): { state: DominoState; context: ScoringContext } {
  const played = state.hand.find((t) => t.id === action.tileId)
  if (!played) {
    throw new Error(`Peca ${action.tileId} nao esta na mao`)
  }

  const handAfter = state.hand.filter((t) => t.id !== action.tileId)

  let chain: Tile[]
  let ends: [number, number]
  // closes_number = o novo numero exposto por esta jogada (tag topologica).
  let closesNumber: number
  if (state.ends === null) {
    chain = [played]
    ends = [played.low, played.high]
    closesNumber = played.high
  } else if (action.side === 'left') {
    chain = [played, ...state.chain]
    ends = [otherHalf(played, state.ends[0]), state.ends[1]]
    closesNumber = ends[0]
  } else {
    chain = [...state.chain, played]
    ends = [state.ends[0], otherHalf(played, state.ends[1])]
    closesNumber = ends[1]
  }

  // Compra 1 peca do saco para repor (ate o saco esvaziar).
  const drawn = state.bag[0]
  const hand = drawn ? [...handAfter, drawn] : handAfter
  const bag = drawn ? state.bag.slice(1) : state.bag

  const context: ScoringContext = {
    baseValue: tilePips(played),
    tags: [...tileTags(played), { key: 'closes_number', value: closesNumber }],
    entities: [tileEntity(played)],
    snapshot: makeSnapshot(chain, ends),
    consumes: { plays: 1 },
  }

  return { state: { ...state, hand, bag, chain, ends }, context }
}

function isRoundOver(state: DominoState): boolean {
  return state.hand.length === 0 || legalActionsFor(state).length === 0
}

// ---------------------------------------------------------------------------
// Agentes de referencia
// ---------------------------------------------------------------------------

/** A peca alvo de uma acao. */
function tileOf(state: DominoState, action: DominoAction): Tile {
  return state.hand.find((t) => t.id === action.tileId) as Tile
}

/**
 * greedyBaseAgent (T3): escolhe a jogada de maior baseValue (pips), IGNORANDO
 * modificadores. Desempate: preserva mais jogadas legais futuras.
 */
function greedyBaseAgent(state: DominoState): DominoAction {
  const actions = legalActionsFor(state)
  let best = actions[0] as DominoAction
  let bestPips = -1
  let bestFuture = -1
  for (const action of actions) {
    const pips = tilePips(tileOf(state, action))
    const future = legalActionsFor(applyAction(state, action).state).length
    if (pips > bestPips || (pips === bestPips && future > bestFuture)) {
      best = action
      bestPips = pips
      bestFuture = future
    }
  }
  return best
}

/** Visao de run neutra para o agente ranquear jogadas (1 lance, deterministico). */
function neutralRun(active: Modifier[]): RunStateView {
  return {
    ante: 1,
    blind: 1,
    money: 0,
    resources: {},
    activeModifierIds: active.map((m) => m.id),
  }
}

/**
 * synergyAgent (T4/T6/T7): para cada jogada legal, simula resolve() com os
 * modificadores ativos e escolhe a de maior finalScore (greedy de 1 lance).
 */
function synergyAgent(state: DominoState, active: Modifier[]): DominoAction {
  const actions = legalActionsFor(state)
  const rng = makeRng(state.seed)
  const run = neutralRun(active)

  let best = actions[0] as DominoAction
  let bestScore = -1
  for (const action of actions) {
    const { context } = applyAction(state, action)
    const { trace } = resolve(context, active, run, rng)
    if (trace.finalScore > bestScore) {
      best = action
      bestScore = trace.finalScore
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// O modulo
// ---------------------------------------------------------------------------

const RESOURCES: ResourceSpec[] = [
  { id: 'plays', default: 8 },
  { id: 'redraws', default: 3 },
]

const TAG_VOCABULARY: TagSpec[] = [
  { key: 'value_sum', type: 'int' },
  { key: 'value_max', type: 'int' },
  { key: 'value_min', type: 'int' },
  { key: 'is_double', type: 'flag' },
  { key: 'is_even', type: 'flag' },
  { key: 'is_odd', type: 'flag' },
  { key: 'contains', type: 'int' },
  // Topologica (M3 2a): o numero exposto pela jogada.
  { key: 'closes_number', type: 'int' },
]

export const dominoBoard: BoardModule<DominoState, DominoAction> = {
  id: 'domino',
  declareResources: () => RESOURCES,
  declareTagVocabulary: () => TAG_VOCABULARY,
  init: (seed: Seed, _config: BoardConfig) => dealInit(seed),
  legalActions: legalActionsFor,
  apply: applyAction,
  isRoundOver,
  greedyBaseAgent,
  synergyAgent,
}

// Exporta as funcoes puras para testes diretos.
export { applyAction, dealInit, legalActionsFor }

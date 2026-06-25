// RunManager — dono da estrutura da run e dos contadores.
//
// Responsabilidades: a sequencia antes x blinds e a curva de limiares; os recursos
// da rodada; win/loss da rodada e da run; permadeath. Tudo como funcoes puras sobre
// um RunState serializavel — o motor roda headless.

import type { BlindType, RunConfig, ThresholdCurveConfig } from './config'
import type { ModifierId, ResourceId, RunStateView, Seed, StateDeltas } from './types'

/** Ordem dos blinds dentro de um ante. */
const BLIND_ORDER: BlindType[] = ['small', 'big', 'boss']

export type RunStatus = 'playing' | 'won' | 'dead'

/** Estado central da run (serializavel; o config fica fora, passado as funcoes). */
export interface RunState {
  seed: Seed
  /** Indice global da blind atual, 1..totalBlinds. */
  blindIndex: number
  money: number
  resources: Record<ResourceId, number>
  /** A colecao inteira que o jogador possui. */
  ownedModifierIds: ModifierId[]
  /** Os modificadores nos slots, EM ORDEM (no maximo `config.slots`). */
  activeModifierIds: ModifierId[]
  /** Soma das pontuacoes das jogadas na blind atual. */
  roundScore: number
  status: RunStatus
}

/** Numero total de blinds da run. */
export function totalBlinds(curve: ThresholdCurveConfig): number {
  return curve.antes * curve.blindsPerAnte
}

/** Limiar da blind de indice global `i` (1-based): round(base * growth^(i-1)). */
export function thresholdFor(curve: ThresholdCurveConfig, i: number): number {
  return Math.round(curve.base * Math.pow(curve.growth, i - 1))
}

/** Tipo da blind de indice `i` (small/big/boss), pela posicao dentro do ante. */
export function blindTypeFor(curve: ThresholdCurveConfig, i: number): BlindType {
  const pos = (i - 1) % curve.blindsPerAnte
  // BLIND_ORDER[pos] e seguro porque pos < blindsPerAnte; o fallback cobre configs > 3.
  return BLIND_ORDER[pos] ?? 'boss'
}

/** Ante (1-based) e blind dentro do ante (1-based) para o indice global `i`. */
export function anteBlindOf(
  curve: ThresholdCurveConfig,
  i: number,
): { ante: number; blind: number } {
  return {
    ante: Math.floor((i - 1) / curve.blindsPerAnte) + 1,
    blind: ((i - 1) % curve.blindsPerAnte) + 1,
  }
}

/** Cria o estado inicial da run — deterministico na seed. */
export function createRun(config: RunConfig, seed: Seed): RunState {
  return {
    seed,
    blindIndex: 1,
    money: 0,
    resources: { ...config.resources },
    ownedModifierIds: [],
    activeModifierIds: [],
    roundScore: 0,
    status: 'playing',
  }
}

/** Limiar da blind que o estado esta jogando agora. */
export function currentThreshold(config: RunConfig, state: RunState): number {
  return thresholdFor(config.thresholdCurve, state.blindIndex)
}

/** Visao read-only para os triggers do Resolver. */
export function runStateView(config: RunConfig, state: RunState): RunStateView {
  const { ante, blind } = anteBlindOf(config.thresholdCurve, state.blindIndex)
  return {
    ante,
    blind,
    money: state.money,
    resources: { ...state.resources },
    activeModifierIds: [...state.activeModifierIds],
  }
}

/** Aplica os StateDeltas de um Trace ao estado (dinheiro e recursos). Puro: retorna novo estado. */
export function applyDeltas(state: RunState, deltas: StateDeltas): RunState {
  const resources = { ...state.resources }
  if (deltas.resources) {
    for (const [id, n] of Object.entries(deltas.resources)) {
      resources[id] = (resources[id] ?? 0) + n
    }
  }
  return {
    ...state,
    money: state.money + (deltas.money ?? 0),
    resources,
  }
}

/** Soma a pontuacao de uma jogada ao placar da rodada. Puro: retorna novo estado. */
export function addRoundScore(state: RunState, score: number): RunState {
  return { ...state, roundScore: state.roundScore + score }
}

/** A blind atual foi vencida? (placar da rodada >= limiar). */
export function isBlindWon(config: RunConfig, state: RunState): boolean {
  return state.roundScore >= currentThreshold(config, state)
}

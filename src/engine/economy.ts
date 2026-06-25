// Economy — dinheiro por vitoria e a transicao de fim de blind.
//
// A recompensa = base por tipo de blind + juros sobre o dinheiro retido (com teto)
// + sobra de recursos nao usados. A tensao central "gastar agora vs. guardar (juros)"
// nasce daqui. Funcoes puras; o RunManager (run.ts) define a estrutura, a Economy a
// preenche com numeros.

import type { BlindType, RunConfig } from './config'
import type { ResourceId } from './types'
import {
  blindTypeFor,
  currentThreshold,
  isBlindWon,
  totalBlinds,
  type RunState,
} from './run'

/** Juros: +1 a cada `per` de dinheiro retido, limitado a `cap`. */
export function interest(money: number, per: number, cap: number): number {
  if (per <= 0) return 0
  return Math.min(cap, Math.floor(money / per))
}

/** Sobra: +1 por recurso da rodada nao usado (soma dos recursos restantes). */
export function resourceLeftover(resources: Record<ResourceId, number>): number {
  return Object.values(resources).reduce((sum, n) => sum + Math.max(0, n), 0)
}

/** Recompensa-base do tipo de blind. */
export function blindReward(config: RunConfig, type: BlindType): number {
  return config.economy.blindReward[type]
}

/** Recompensa total que uma vitoria nesta blind pagaria, dado o estado atual. */
export function totalBlindReward(config: RunConfig, state: RunState): number {
  const type = blindTypeFor(config.thresholdCurve, state.blindIndex)
  const base = blindReward(config, type)
  const juros = interest(state.money, config.economy.interestPer, config.economy.interestCap)
  const sobra = resourceLeftover(state.resources)
  return base + juros + sobra
}

export interface SettleResult {
  state: RunState
  won: boolean
  /** Recompensa paga (apenas quando `won`). */
  reward: number
}

/**
 * Resolve o fim de uma blind: vitoria paga a recompensa e avanca para a proxima
 * blind (recursos resetados aos defaults); se era a ultima, a run e vencida. Derrota
 * encerra a run (permadeath).
 */
export function settleBlind(config: RunConfig, state: RunState): SettleResult {
  if (!isBlindWon(config, state)) {
    return { state: { ...state, status: 'dead' }, won: false, reward: 0 }
  }

  const reward = totalBlindReward(config, state)
  const nextIndex = state.blindIndex + 1
  const runComplete = nextIndex > totalBlinds(config.thresholdCurve)

  return {
    state: {
      ...state,
      money: state.money + reward,
      blindIndex: runComplete ? state.blindIndex : nextIndex,
      resources: { ...config.resources }, // recursos resetam a cada blind
      roundScore: 0,
      status: runComplete ? 'won' : 'playing',
    },
    won: true,
    reward,
  }
}

/** Reexporta para conveniencia de quem so importa a Economy. */
export { currentThreshold }

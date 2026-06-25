// Tipos de configuracao da run (o "shape do config" de DOMINOTRON.md).
//
// O config e dado puro, versionavel e diffavel: descreve a curva de limiares, a
// economia, os recursos da rodada, os slots e o pool de modificadores. O RunManager
// e a Economy leem daqui — nenhuma constante de jogo fica embutida no codigo do motor.

import type { Modifier, ModifierId, Rarity, ResourceId } from './types'

/** Os tres tipos de blind dentro de um ante (small / big / boss). */
export type BlindType = 'small' | 'big' | 'boss'

/** Curva exponencial de limiares: target(i) = round(base * growth^(i-1)). */
export interface ThresholdCurveConfig {
  base: number
  growth: number
  antes: number
  blindsPerAnte: number
}

export interface EconomyConfig {
  /** Recompensa-base por tipo de blind. */
  blindReward: Record<BlindType, number>
  /** Juros: +1 a cada `interestPer` de dinheiro retido... */
  interestPer: number
  /** ...com teto de `interestCap`. */
  interestCap: number
  /** Precos de compra por raridade (venda devolve metade). */
  prices: Record<Rarity, number>
}

export interface RunConfig {
  board: string
  /** Recursos da rodada e seus defaults (ex.: { plays: 8, redraws: 3 }). */
  resources: Record<ResourceId, number>
  thresholdCurve: ThresholdCurveConfig
  economy: EconomyConfig
  /** Slots ativos (escassez — Lei 9). */
  slots: number
  /** O pool de modificadores disponivel (dados declarativos). */
  modifiers: Modifier[]
}

/** Atalho de lookup de um modificador do pool por id. */
export function modifierById(config: RunConfig, id: ModifierId): Modifier | undefined {
  return config.modifiers.find((m) => m.id === id)
}

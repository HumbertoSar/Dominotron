// Config padrao do dominó (o shape do DOMINOTRON.md), reutilizado pelo harness e testes.
// Os numeros sao o ponto de partida de calibracao — T3/T7 e quem os afina.

import type { RunConfig } from '../../engine/index'
import { DOMINO_POOL } from './pool'

export function defaultDominoConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  return {
    board: 'domino',
    resources: { plays: 8, redraws: 3 },
    thresholdCurve: { base: 18, growth: 1.3, antes: 8, blindsPerAnte: 3 },
    economy: {
      blindReward: { small: 3, big: 4, boss: 5 },
      interestPer: 5,
      interestCap: 5,
      prices: { common: 4, uncommon: 6, rare: 8 },
    },
    slots: 5,
    modifiers: DOMINO_POOL,
    ...overrides,
  }
}

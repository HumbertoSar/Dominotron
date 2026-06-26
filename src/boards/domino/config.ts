// Config padrao do dominó (o shape do DOMINOTRON.md), reutilizado pelo harness e testes.
// CALIBRADO via harness (M4): plays 8->12 e growth 1.30->1.12 para T3/T4/T7 passarem
// e o motor ser de fato multiplicativo (T2). Ver docs/DOMINOTRON.md (nota de calibracao).

import type { RunConfig } from '../../engine/index'
import { DOMINO_POOL } from './pool'

export function defaultDominoConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  return {
    board: 'domino',
    resources: { plays: 12, redraws: 3 },
    thresholdCurve: { base: 18, growth: 1.12, antes: 8, blindsPerAnte: 3 },
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

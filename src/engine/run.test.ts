import { describe, expect, it } from 'vitest'
import {
  addRoundScore,
  anteBlindOf,
  applyDeltas,
  blindTypeFor,
  createRun,
  currentThreshold,
  isBlindWon,
  runStateView,
  thresholdFor,
  totalBlinds,
} from './run'
import { makeConfig } from './test-helpers'

const config = makeConfig()
const curve = config.thresholdCurve

describe('curva de limiares (DoD: bate a tabela de DOMINOTRON.md)', () => {
  it('reproduz a tabela para a formula round(18 * 1.30^(i-1))', () => {
    // NOTA: a tabela do doc lista i=4 como 39, mas a formula da 40
    // (18 * 1.3^3 = 39.546 -> round = 40). Seguimos a FORMULA, que e a espec;
    // o "39" do doc e um erro de arredondamento. Os demais valores conferem.
    const expected: Record<number, number> = {
      1: 18,
      2: 23,
      3: 30,
      4: 40, // doc diz 39 (typo); formula = 40
      5: 51,
      6: 67,
      7: 87,
      8: 113,
      9: 147,
      10: 191,
    }
    for (const [i, target] of Object.entries(expected)) {
      expect(thresholdFor(curve, Number(i))).toBe(target)
    }
  })

  it('a run tem 24 blinds (8 antes x 3)', () => {
    expect(totalBlinds(curve)).toBe(24)
  })

  it('cresce de forma estritamente monotona', () => {
    for (let i = 2; i <= totalBlinds(curve); i++) {
      expect(thresholdFor(curve, i)).toBeGreaterThan(thresholdFor(curve, i - 1))
    }
  })
})

describe('sequencia antes x blinds', () => {
  it('os tipos ciclam small / big / boss', () => {
    expect(blindTypeFor(curve, 1)).toBe('small')
    expect(blindTypeFor(curve, 2)).toBe('big')
    expect(blindTypeFor(curve, 3)).toBe('boss')
    expect(blindTypeFor(curve, 4)).toBe('small') // proximo ante
  })

  it('mapeia indice global -> (ante, blind)', () => {
    expect(anteBlindOf(curve, 1)).toEqual({ ante: 1, blind: 1 })
    expect(anteBlindOf(curve, 3)).toEqual({ ante: 1, blind: 3 })
    expect(anteBlindOf(curve, 4)).toEqual({ ante: 2, blind: 1 })
    expect(anteBlindOf(curve, 24)).toEqual({ ante: 8, blind: 3 })
  })
})

describe('estado da run', () => {
  it('createRun e deterministico e parte do comeco', () => {
    const s = createRun(config, 42)
    expect(s).toEqual(createRun(config, 42))
    expect(s.blindIndex).toBe(1)
    expect(s.money).toBe(0)
    expect(s.resources).toEqual({ plays: 8, redraws: 3 })
    expect(s.status).toBe('playing')
  })

  it('runStateView expoe ante/blind/money/resources/active', () => {
    const s = createRun(config, 1)
    expect(runStateView(config, s)).toEqual({
      ante: 1,
      blind: 1,
      money: 0,
      resources: { plays: 8, redraws: 3 },
      activeModifierIds: [],
    })
  })

  it('applyDeltas move dinheiro e recursos (DoD)', () => {
    const s = createRun(config, 1)
    const next = applyDeltas(s, { money: 5, resources: { plays: -1, redraws: 2 } })
    expect(next.money).toBe(5)
    expect(next.resources).toEqual({ plays: 7, redraws: 5 })
    // pureza: o estado original nao muda
    expect(s.money).toBe(0)
    expect(s.resources).toEqual({ plays: 8, redraws: 3 })
  })

  it('addRoundScore acumula o placar da rodada', () => {
    const s = addRoundScore(addRoundScore(createRun(config, 1), 10), 8)
    expect(s.roundScore).toBe(18)
  })

  it('isBlindWon compara placar com o limiar atual', () => {
    const base = createRun(config, 1) // blind 1, limiar 18
    expect(currentThreshold(config, base)).toBe(18)
    expect(isBlindWon(config, addRoundScore(base, 17))).toBe(false)
    expect(isBlindWon(config, addRoundScore(base, 18))).toBe(true)
  })
})

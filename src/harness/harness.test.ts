import { describe, expect, it } from 'vitest'
import { defaultDominoConfig } from '../boards/domino/config'
import { dominoBoard } from '../boards/domino/board'
import { formatReportCard } from './report'
import {
  isSynergistic,
  runCheapSanitySuite,
  testT2Multiplicative,
  testT3CleanDeath,
  testT5Synergy,
  testT8Order,
  testT9Determinism,
} from './sanity'
import { cleanStrategy, randomStrategy, simulateRun } from './simulate'

const config = defaultDominoConfig()

describe('simulateRun', () => {
  it('uma run termina (vence ou morre) e e deterministica na seed', () => {
    const a = simulateRun(config, 42, cleanStrategy)
    const b = simulateRun(config, 42, cleanStrategy)
    expect(a).toEqual(b)
    expect(['won', 'dead']).toContain(a.status)
    expect(a.progress).toBeGreaterThanOrEqual(0)
    expect(a.progress).toBeLessThanOrEqual(1)
  })

  it('a estrategia random adquire modificadores ao longo da run', () => {
    // em varias seeds, ao menos uma deve ter ativado algum modificador
    const anyActive = [1, 2, 3, 4, 5].some(
      (s) => simulateRun(config, s, randomStrategy(1)).finalActiveIds.length > 0,
    )
    expect(anyActive).toBe(true)
  })
})

describe('classificacao de sinergia (T5)', () => {
  it('mod chapado (always + add_mult) nao e sinergico', () => {
    expect(
      isSynergistic({
        id: 'flat',
        name: 'flat',
        rarity: 'common',
        cost: 0,
        slotType: 'standard',
        trigger: { kind: 'always' },
        effects: [{ op: 'add_mult', args: [4] }],
      }),
    ).toBe(false)
  })

  it('mod com trigger condicional e sinergico', () => {
    expect(
      isSynergistic({
        id: 'cond',
        name: 'cond',
        rarity: 'common',
        cost: 0,
        slotType: 'standard',
        trigger: { kind: 'has_tag', tag: 'is_double' },
        effects: [{ op: 'add_mult', args: [4] }],
      }),
    ).toBe(true)
  })
})

describe('os sanity checks rodam e retornam vereditos', () => {
  it('T9 determinismo passa', () => {
    expect(testT9Determinism(config).verdict).toBe('green')
  })

  it('T5 sinergia: vocabulario ok e densidade >= 1/3', () => {
    const r = testT5Synergy(dominoBoard.declareTagVocabulary(), config.modifiers)
    expect(r.verdict).not.toBe('red') // vocabulario nao pode estar quebrado
    expect(r.detail).toContain('sinergicos')
  })

  it('T8 ordem importa e verde (nao-comutatividade comprovada)', () => {
    expect(testT8Order(config).verdict).toBe('green')
  })

  it('T2 e T3 retornam um veredito e um detalhe medido', () => {
    const t2 = testT2Multiplicative(config, 12)
    const t3 = testT3CleanDeath(config, 12)
    expect(t2.detail).toContain('p95/p50')
    expect(t3.detail).toContain('% da run')
  })
})

describe('report-card', () => {
  it('formata as 5 linhas de teste + o veredito geral', () => {
    const card = formatReportCard('teste', runCheapSanitySuite(config, 8))
    expect(card).toContain('VEREDITO:')
    for (const id of ['T2', 'T3', 'T5', 'T8', 'T9']) {
      expect(card).toContain(id)
    }
  })
})

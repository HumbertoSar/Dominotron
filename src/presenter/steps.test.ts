import { describe, expect, it } from 'vitest'
import type { Trace } from '../engine/index'
import { COLORS, colorFor, traceToSteps } from './steps'

const sampleTrace: Trace = {
  entries: [
    { source: 'base', op: 'add_base', args: [12], accAfter: { chips: 12, mult: 1 } },
    { source: 'even_steven', op: 'add_mult', args: [4], accAfter: { chips: 12, mult: 5 } },
    { source: 'serpente', op: 'mul_mult', args: [2], accAfter: { chips: 12, mult: 10 } },
    { source: 'polish', op: 'add_money', args: [1], accAfter: { chips: 12, mult: 10 } },
  ],
  finalScore: 120,
}

describe('mapa de cores fixo', () => {
  it('base=azul, mult=vermelho, dinheiro=dourado, recurso=verde', () => {
    expect(colorFor('base')).toBe('#3b82f6')
    expect(colorFor('mult')).toBe('#ef4444')
    expect(colorFor('money')).toBe('#f59e0b')
    expect(colorFor('resource')).toBe('#22c55e')
    expect(COLORS.final).toBe('#f59e0b')
  })
})

describe('traceToSteps', () => {
  it('gera um passo por entry + a explosao final', () => {
    const steps = traceToSteps(sampleTrace)
    expect(steps).toHaveLength(5) // 4 entries + final
    expect(steps.at(-1)).toMatchObject({ kind: 'final', isFinal: true, label: '= 120' })
  })

  it('classifica cada passo na cor certa', () => {
    const steps = traceToSteps(sampleTrace)
    expect(steps[0]).toMatchObject({ kind: 'base', color: '#3b82f6' })
    expect(steps[1]).toMatchObject({ kind: 'mult', color: '#ef4444' }) // add_mult
    expect(steps[2]).toMatchObject({ kind: 'mult', color: '#ef4444' }) // mul_mult
    expect(steps[3]).toMatchObject({ kind: 'money', color: '#f59e0b' }) // add_money
  })

  it('a intensidade cresce de 0 a 1 ao longo do Trace', () => {
    const steps = traceToSteps(sampleTrace)
    expect(steps[0]?.intensity).toBe(0)
    expect(steps.at(-1)?.intensity).toBe(1)
  })

  it('e deterministico: mesmo Trace -> mesmos passos', () => {
    expect(traceToSteps(sampleTrace)).toEqual(traceToSteps(sampleTrace))
  })
})

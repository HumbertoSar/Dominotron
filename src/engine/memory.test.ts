// Testes da memoria de rodada (M3 Parte 2b): o avanco da memoria e os modificadores
// que dependem dela — Crescente, Gemeos, Motor Espelho.

import { describe, expect, it } from 'vitest'
import { advanceRoundMemory, initialRoundMemory } from './memory'
import { resolve } from './resolve'
import { fakeRng, makeCtx, makeMod, makeRun, tag } from './test-helpers'
import type { RoundMemory } from './types'

const run = makeRun()

describe('advanceRoundMemory', () => {
  it('comeca zerada', () => {
    expect(initialRoundMemory()).toEqual({
      plays: 0,
      prevValueSum: null,
      doubles: 0,
      prevWasDouble: false,
    })
  })

  it('conta jogadas, duplas e lembra a anterior', () => {
    let m = initialRoundMemory()
    m = advanceRoundMemory(m, makeCtx({ tags: [tag('value_sum', 8), tag('is_double')] }))
    expect(m).toEqual({ plays: 1, prevValueSum: 8, doubles: 1, prevWasDouble: true })

    m = advanceRoundMemory(m, makeCtx({ tags: [tag('value_sum', 3)] }))
    expect(m).toEqual({ plays: 2, prevValueSum: 3, doubles: 1, prevWasDouble: false })
  })
})

describe('Crescente — tag_vs_memory', () => {
  const crescente = makeMod('crescente', [{ op: 'add_mult', args: [2] }], {
    kind: 'tag_vs_memory',
    tag: 'value_sum',
    field: 'prevValueSum',
    cmp: '>',
  })

  it('dispara quando a jogada vale mais que a anterior', () => {
    const memory: RoundMemory = { plays: 1, prevValueSum: 5, doubles: 0, prevWasDouble: false }
    const ctx = makeCtx({ baseValue: 10, tags: [tag('value_sum', 8)] })
    expect(resolve(ctx, [crescente], run, fakeRng, memory).trace.finalScore).toBe(30) // 10 * 3
  })

  it('nao dispara na primeira jogada (sem anterior)', () => {
    const ctx = makeCtx({ baseValue: 10, tags: [tag('value_sum', 8)] })
    expect(resolve(ctx, [crescente], run, fakeRng, initialRoundMemory()).trace.finalScore).toBe(10)
  })
})

describe('Gemeos — memory_flag', () => {
  const gemeos = makeMod('gemeos', [{ op: 'mul_mult', args: [2] }], {
    kind: 'and',
    preds: [
      { kind: 'has_tag', tag: 'is_double' },
      { kind: 'memory_flag', field: 'prevWasDouble' },
    ],
  })

  it('dobra quando e a 2a dupla seguida', () => {
    const memory: RoundMemory = { plays: 1, prevValueSum: 6, doubles: 1, prevWasDouble: true }
    const ctx = makeCtx({ baseValue: 8, tags: [tag('is_double')] })
    expect(resolve(ctx, [gemeos], run, fakeRng, memory).trace.finalScore).toBe(16)
  })

  it('nao dobra se a anterior nao foi dupla', () => {
    const memory: RoundMemory = { plays: 1, prevValueSum: 6, doubles: 0, prevWasDouble: false }
    const ctx = makeCtx({ baseValue: 8, tags: [tag('is_double')] })
    expect(resolve(ctx, [gemeos], run, fakeRng, memory).trace.finalScore).toBe(8)
  })
})

describe('Motor Espelho — mul_mult_pow', () => {
  const mirror = makeMod('mirror', [{ op: 'mul_mult_pow', args: [1.2], memoryField: 'doubles' }])

  it('escala por 1.2 a cada dupla ja jogada na rodada', () => {
    const ctx = makeCtx({ baseValue: 10 })
    // 0 duplas: mult *= 1.2^0 = 1
    expect(resolve(ctx, [mirror], run, fakeRng, initialRoundMemory()).trace.finalScore).toBe(10)
    // 2 duplas: mult *= 1.2^2 = 1.44
    const m2: RoundMemory = { plays: 3, prevValueSum: 4, doubles: 2, prevWasDouble: false }
    expect(resolve(ctx, [mirror], run, fakeRng, m2).trace.finalScore).toBeCloseTo(14.4)
  })
})

describe('back-compat: resolve sem memoria continua valendo', () => {
  it('chamar resolve com 4 args usa memoria zerada', () => {
    const mod = makeMod('m', [{ op: 'add_mult', args: [3] }])
    const { trace } = resolve(makeCtx({ baseValue: 10 }), [mod], run, fakeRng)
    expect(trace.finalScore).toBe(40)
  })
})

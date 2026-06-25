// Testes das extensoes de DSL do M3 Parte 2a: ops tag-valued, queries de snapshot e
// o predicado de snapshot (comprimento da cobra com modulo).

import { describe, expect, it } from 'vitest'
import { resolve } from './resolve'
import { fakeRng, fakeSnapshot, makeCtx, makeMod, makeRun, tag } from './test-helpers'

const run = makeRun()

describe('add_base_tag / add_mult_tag — quantidade vinda do valor de uma tag', () => {
  it('add_base_tag soma o valor da tag a base', () => {
    const mod = makeMod('martelo', [{ op: 'add_base_tag', tag: 'value_sum', args: [1] }])
    const ctx = makeCtx({ baseValue: 0, tags: [tag('value_sum', 12)] })
    expect(resolve(ctx, [mod], run, fakeRng).trace.finalScore).toBe(12)
  })

  it('escala pelo args[0]', () => {
    const mod = makeMod('m', [{ op: 'add_mult_tag', tag: 'value_max', args: [2] }])
    const ctx = makeCtx({ baseValue: 10, tags: [tag('value_max', 3)] })
    expect(resolve(ctx, [mod], run, fakeRng).trace.finalScore).toBe(70) // mult 1 + 2*3 = 7
  })

  it('tag ausente nao faz nada', () => {
    const mod = makeMod('m', [{ op: 'add_base_tag', tag: 'value_sum', args: [1] }])
    expect(resolve(makeCtx({ baseValue: 5 }), [mod], run, fakeRng).trace.finalScore).toBe(5)
  })
})

describe('matchCount snapshot — contar na cobra', () => {
  it('add_base_per com snapshot conta pecas da cobra (numero fixo)', () => {
    const mod = makeMod('colecionador', [
      { op: 'add_base_per', args: [2], query: { target: 'snapshot', key: 'contains', value: 6 } },
    ])
    const ctx = makeCtx({ baseValue: 0, snapshot: fakeSnapshot({ count: (k) => (k === '6' ? 3 : 0) }) })
    expect(resolve(ctx, [mod], run, fakeRng).trace.finalScore).toBe(6) // 2 * 3
  })

  it('fromTag pega o numero do valor de uma tag (numerologo)', () => {
    const mod = makeMod('numerologo', [
      { op: 'add_mult_per', args: [3], query: { target: 'snapshot', key: 'contains', fromTag: 'closes_number' } },
    ])
    const ctx = makeCtx({
      baseValue: 10,
      tags: [tag('closes_number', 4)],
      snapshot: fakeSnapshot({ count: (k) => (k === '4' ? 2 : 0) }),
    })
    expect(resolve(ctx, [mod], run, fakeRng).trace.finalScore).toBe(70) // mult 1 + 3*2 = 7
  })

  it('fromTag ausente conta zero', () => {
    const mod = makeMod('numerologo', [
      { op: 'add_mult_per', args: [3], query: { target: 'snapshot', key: 'contains', fromTag: 'closes_number' } },
    ])
    const ctx = makeCtx({ baseValue: 10, snapshot: fakeSnapshot({ count: () => 5 }) })
    expect(resolve(ctx, [mod], run, fakeRng).trace.finalScore).toBe(10)
  })
})

describe('predicate snapshot — comprimento da cobra com modulo (serpente)', () => {
  const serpente = makeMod('serpente', [{ op: 'mul_mult', args: [2] }], {
    kind: 'snapshot',
    metric: 'chainLength',
    mod: 5,
    cmp: '==',
    value: 0,
  })

  it('dispara quando o comprimento e multiplo de 5', () => {
    const at5 = makeCtx({ baseValue: 10, snapshot: fakeSnapshot({ chainLength: () => 5 }) })
    expect(resolve(at5, [serpente], run, fakeRng).trace.finalScore).toBe(20)
  })

  it('nao dispara fora do multiplo', () => {
    const at7 = makeCtx({ baseValue: 10, snapshot: fakeSnapshot({ chainLength: () => 7 }) })
    expect(resolve(at7, [serpente], run, fakeRng).trace.finalScore).toBe(10)
  })
})

import { describe, expect, it } from 'vitest'
import { resolve } from './resolve'
import { fakeRng, makeCtx, makeMod, makeRun, tag } from './test-helpers'

const run = makeRun()

describe('resolve — base e o nucleo da DSL', () => {
  it('sem modificadores, a pontuacao e a base e o Trace tem so a linha base', () => {
    const { trace } = resolve(makeCtx({ baseValue: 12 }), [], run, fakeRng)

    expect(trace.finalScore).toBe(12)
    expect(trace.entries).toHaveLength(1)
    expect(trace.entries[0]).toEqual({
      source: 'base',
      op: 'add_base',
      args: [12],
      accAfter: { chips: 12, mult: 1 },
    })
  })

  it('add_base soma aos chips', () => {
    const mod = makeMod('m', [{ op: 'add_base', args: [8] }])
    const { trace } = resolve(makeCtx({ baseValue: 4 }), [mod], run, fakeRng)

    expect(trace.entries.at(-1)?.accAfter).toEqual({ chips: 12, mult: 1 })
    expect(trace.finalScore).toBe(12) // (4 + 8) * 1
  })

  it('add_mult soma ao multiplicador', () => {
    const mod = makeMod('m', [{ op: 'add_mult', args: [4] }])
    const { trace } = resolve(makeCtx({ baseValue: 10 }), [mod], run, fakeRng)

    expect(trace.entries.at(-1)?.accAfter).toEqual({ chips: 10, mult: 5 })
    expect(trace.finalScore).toBe(50) // 10 * (1 + 4)
  })

  it('mul_mult multiplica o multiplicador', () => {
    const mod = makeMod('m', [
      { op: 'add_mult', args: [4] }, // mult = 5
      { op: 'mul_mult', args: [3] }, // mult = 15
    ])
    const { trace } = resolve(makeCtx({ baseValue: 2 }), [mod], run, fakeRng)

    expect(trace.entries.at(-1)?.accAfter).toEqual({ chips: 2, mult: 15 })
    expect(trace.finalScore).toBe(30) // 2 * 15
  })

  it('empurra uma TraceEntry por op, na ordem', () => {
    const mod = makeMod('m', [
      { op: 'add_base', args: [3] },
      { op: 'add_mult', args: [2] },
    ])
    const { trace } = resolve(makeCtx({ baseValue: 5 }), [mod], run, fakeRng)

    expect(trace.entries.map((e) => e.op)).toEqual(['add_base', 'add_base', 'add_mult'])
    expect(trace.entries.map((e) => e.source)).toEqual(['base', 'm', 'm'])
  })
})

describe('resolve — ordem dos slots importa (semente do T8)', () => {
  // mesma colecao, ordens diferentes -> finalScore diferente (nao comutatividade).
  const addMult = makeMod('add', [{ op: 'add_mult', args: [4] }])
  const mulMult = makeMod('mul', [{ op: 'mul_mult', args: [2] }])
  const ctx = makeCtx({ baseValue: 10 })

  it('add_mult depois mul_mult: (1+4)*2 = 10', () => {
    const { trace } = resolve(ctx, [addMult, mulMult], run, fakeRng)
    expect(trace.finalScore).toBe(100) // 10 * 10
  })

  it('mul_mult depois add_mult: (1*2)+4 = 6', () => {
    const { trace } = resolve(ctx, [mulMult, addMult], run, fakeRng)
    expect(trace.finalScore).toBe(60) // 10 * 6
  })

  it('trocar a ordem muda o resultado materialmente', () => {
    const a = resolve(ctx, [addMult, mulMult], run, fakeRng).trace.finalScore
    const b = resolve(ctx, [mulMult, addMult], run, fakeRng).trace.finalScore
    expect(a).not.toBe(b)
  })
})

describe('resolve — determinismo (semente do T9)', () => {
  it('mesma entrada chamada duas vezes produz Trace deep-equal', () => {
    const mods = [
      makeMod('a', [{ op: 'add_base', args: [3] }]),
      makeMod('b', [{ op: 'mul_mult', args: [2] }]),
    ]
    const ctx = makeCtx({ baseValue: 7, tags: [tag('is_double')] })

    const first = resolve(ctx, mods, run, fakeRng)
    const second = resolve(ctx, mods, run, fakeRng)

    expect(first).toEqual(second)
  })

  it('nao muta os argumentos de entrada (pureza)', () => {
    const ctx = makeCtx({ baseValue: 5 })
    const mods = [makeMod('a', [{ op: 'add_base', args: [1] }])]
    resolve(ctx, mods, run, fakeRng)

    expect(ctx.baseValue).toBe(5)
    expect(mods[0]?.effects[0]?.args).toEqual([1])
  })
})

describe('resolve — gating por trigger', () => {
  it('um modificador so dispara quando seu trigger e verdadeiro', () => {
    const mod = makeMod('double-bonus', [{ op: 'add_mult', args: [4] }], {
      kind: 'has_tag',
      tag: 'is_double',
    })

    const semTag = resolve(makeCtx({ baseValue: 6 }), [mod], run, fakeRng)
    expect(semTag.trace.finalScore).toBe(6) // trigger falso: mult fica 1

    const comTag = resolve(makeCtx({ baseValue: 6, tags: [tag('is_double')] }), [mod], run, fakeRng)
    expect(comTag.trace.finalScore).toBe(30) // trigger verdadeiro: 6 * 5
  })
})

describe('resolve — ops _per contam matches', () => {
  it('add_mult_per soma n por tag que casa', () => {
    // peca com dois "seis": duas tags contains:6 -> count 2, +3 cada -> +6 no mult.
    const mod = makeMod('seis', [
      { op: 'add_mult_per', args: [3], query: { target: 'tag', key: 'contains', value: 6 } },
    ])
    const ctx = makeCtx({ baseValue: 12, tags: [tag('contains', 6), tag('contains', 6)] })

    const { trace } = resolve(ctx, [mod], run, fakeRng)
    expect(trace.entries.at(-1)?.accAfter.mult).toBe(7) // 1 + 3*2
    expect(trace.finalScore).toBe(84) // 12 * 7
  })

  it('add_base_per conta entities que casam', () => {
    const mod = makeMod('col', [
      { op: 'add_base_per', args: [2], query: { target: 'entity', key: 'contains', value: 6 } },
    ])
    const ctx = makeCtx({
      baseValue: 0,
      entities: [
        { id: 't1', tags: [tag('contains', 6)] },
        { id: 't2', tags: [tag('contains', 3)] },
        { id: 't3', tags: [tag('contains', 6)] },
      ],
    })

    const { trace } = resolve(ctx, [mod], run, fakeRng)
    expect(trace.finalScore).toBe(4) // chips 0 + 2*2 matches
  })
})

describe('resolve — economia via deltas (Resolver nao muta a run)', () => {
  it('add_money acumula em deltas, nao no acumulador', () => {
    const mod = makeMod('polish', [{ op: 'add_money', args: [3] }])
    const { trace, deltas } = resolve(makeCtx({ baseValue: 8 }), [mod], run, fakeRng)

    expect(deltas.money).toBe(3)
    expect(trace.finalScore).toBe(8) // dinheiro nao afeta a pontuacao
  })

  it('add_resource acumula no recurso nomeado', () => {
    const mod = makeMod('ferrolho', [{ op: 'add_resource', args: [1], resource: 'plays' }])
    const { deltas } = resolve(makeCtx({ baseValue: 0 }), [mod], run, fakeRng)

    expect(deltas.resources).toEqual({ plays: 1 })
  })
})

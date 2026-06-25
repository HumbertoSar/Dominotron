// Testes do sistema de eventos (M3 Parte 2c): resolveEvent, ops run/resource-valued,
// e os helpers de regra (thinning / two-ends).

import { describe, expect, it } from 'vitest'
import { hasTwoEndsPlay, resolveEvent, totalShopThinning } from './events'
import { resolve } from './resolve'
import { fakeRng, makeCtx, makeMod, makeRun } from './test-helpers'
import type { EventHook, Modifier } from './types'

function withHooks(id: string, hooks: EventHook[]): Modifier {
  return { ...makeMod(id, []), hooks }
}

describe('resolveEvent', () => {
  const run = makeRun({ money: 10, resources: { redraws: 3, plays: 2 } })

  it('round_start: Aposta paga a entrada (dinheiro negativo)', () => {
    const aposta = withHooks('aposta', [{ on: 'round_start', effects: [{ op: 'add_money', args: [-3] }] }])
    expect(resolveEvent('round_start', [aposta], run).money).toBe(-3)
  })

  it('lock: Ferrolho da dinheiro e devolve uma jogada', () => {
    const ferrolho = withHooks('ferrolho', [
      {
        on: 'lock',
        effects: [
          { op: 'add_money', args: [6] },
          { op: 'add_resource', resource: 'plays', args: [1] },
        ],
      },
    ])
    expect(resolveEvent('lock', [ferrolho], run)).toEqual({ money: 6, resources: { plays: 1 } })
  })

  it('round_end: Economia Circular paga por redraw nao usado', () => {
    const econ = withHooks('economia_circular', [
      { on: 'round_end', effects: [{ op: 'add_money_per_resource', resource: 'redraws', args: [1] }] },
    ])
    expect(resolveEvent('round_end', [econ], run).money).toBe(3) // 1 * 3 redraws
  })

  it('so dispara o evento correspondente', () => {
    const ferrolho = withHooks('ferrolho', [{ on: 'lock', effects: [{ op: 'add_money', args: [6] }] }])
    expect(resolveEvent('round_start', [ferrolho], run)).toEqual({})
  })
})

describe('add_mult_run — Aposta escala por dinheiro retido (per-play)', () => {
  it('mult += dinheiro da run', () => {
    const aposta = makeMod('aposta', [{ op: 'add_mult_run', runField: 'money', args: [1] }])
    const run = makeRun({ money: 5 })
    expect(resolve(makeCtx({ baseValue: 10 }), [aposta], run, fakeRng).trace.finalScore).toBe(60) // 10 * (1+5)
  })
})

describe('helpers de regra', () => {
  it('totalShopThinning soma o thinning dos mods de regra', () => {
    const penteFino: Modifier = { ...makeMod('pente_fino', []), rule: { kind: 'shop_thinning', amount: 2 } }
    expect(totalShopThinning([penteFino])).toBe(2)
    expect(totalShopThinning([])).toBe(0)
  })

  it('hasTwoEndsPlay detecta Canhoto', () => {
    const canhoto: Modifier = { ...makeMod('canhoto', []), rule: { kind: 'two_ends_play' } }
    expect(hasTwoEndsPlay([canhoto])).toBe(true)
    expect(hasTwoEndsPlay([makeMod('x', [])])).toBe(false)
  })
})

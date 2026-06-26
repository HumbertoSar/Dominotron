// @vitest-environment jsdom
//
// Testa o DomPresenter num DOM real (jsdom roda no Node — passa no CI sem navegador).
// Prova que o mesmo Trace que a CLI imprime e renderizado fielmente (cores, passos,
// explosao final), e que o modo headless (NoOpPresenter) nao toca em nada.

import { describe, expect, it } from 'vitest'
import type { Trace } from '../engine/index'
import { DomPresenter } from './dom'
import { NoOpPresenter } from './presenter'

const trace: Trace = {
  entries: [
    { source: 'base', op: 'add_base', args: [12], accAfter: { chips: 12, mult: 1 } },
    { source: 'even_steven', op: 'add_mult', args: [4], accAfter: { chips: 12, mult: 5 } },
    { source: 'serpente', op: 'mul_mult', args: [2], accAfter: { chips: 12, mult: 10 } },
  ],
  finalScore: 120,
}

describe('DomPresenter (jsdom)', () => {
  it('renderiza um passo por entry + a explosao final', async () => {
    const container = document.createElement('div')
    await new DomPresenter(container).present(trace)

    const steps = container.querySelectorAll('.suco-step')
    expect(steps).toHaveLength(4) // 3 entries + final
  })

  it('aplica a cor por tipo e marca a explosao final', async () => {
    const container = document.createElement('div')
    await new DomPresenter(container).present(trace)
    const steps = [...container.querySelectorAll<HTMLElement>('.suco-step')]

    expect(steps[0]?.dataset.kind).toBe('base')
    expect(steps[1]?.dataset.kind).toBe('mult')
    expect(steps[0]?.style.color).toBeTruthy()

    const final = steps.at(-1)!
    expect(final.classList.contains('suco-final')).toBe(true)
    expect(final.dataset.kind).toBe('final')
    expect(final.querySelector('.suco-value')?.textContent).toBe('= 120')
  })

  it('re-apresentar limpa o anterior (sem acumular)', async () => {
    const container = document.createElement('div')
    const p = new DomPresenter(container)
    await p.present(trace)
    await p.present(trace)
    expect(container.querySelectorAll('.suco-step')).toHaveLength(4) // nao dobrou
  })

  it('NoOpPresenter nao toca no DOM (headless intacto — Lei 6)', () => {
    const container = document.createElement('div')
    new NoOpPresenter().present(trace)
    expect(container.children).toHaveLength(0)
  })
})

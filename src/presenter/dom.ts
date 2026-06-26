// O suco visual — DomPresenter. Consome o Trace (via traceToSteps) e o anima no DOM:
// revelacao sequencial, cor por tipo de numero, escalada de intensidade e explosao final.
//
// Construido por ULTIMO (Leis 6 e 11). Em teste/CLI usa-se o NoOpPresenter; este so entra
// no navegador. A logica de "quais passos, que cor" e pura (steps.ts) e testada a parte.

import type { Trace } from '../engine/index'
import type { Presenter } from './presenter'
import { traceToSteps, type PresentationStep } from './steps'

export interface DomPresenterOptions {
  /** Atraso entre revelar cada passo (ms). 0/ausente = instantaneo (para testes). */
  stepDelayMs?: number
}

export class DomPresenter implements Presenter {
  constructor(
    private readonly container: Element,
    private readonly opts: DomPresenterOptions = {},
  ) {}

  async present(trace: Trace): Promise<void> {
    const steps = traceToSteps(trace)
    this.container.replaceChildren()

    const row = document.createElement('div')
    row.className = 'suco-row'
    this.container.appendChild(row)

    for (const step of steps) {
      const el = this.renderStep(step)
      row.appendChild(el)
      // for o reflow e entao revela (a animacao CSS cuida do resto)
      void el.offsetWidth
      el.classList.add('suco-visible')
      if (this.opts.stepDelayMs && this.opts.stepDelayMs > 0) {
        await delay(this.opts.stepDelayMs)
      }
    }
  }

  private renderStep(step: PresentationStep): HTMLElement {
    const el = document.createElement('div')
    el.className = step.isFinal ? 'suco-step suco-final' : 'suco-step'
    el.dataset.kind = step.kind
    el.style.color = step.color
    el.style.setProperty('--intensity', step.intensity.toFixed(3))

    const source = document.createElement('span')
    source.className = 'suco-source'
    source.textContent = step.source

    const value = document.createElement('span')
    value.className = 'suco-value'
    value.textContent = step.label

    el.append(source, value)
    return el
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

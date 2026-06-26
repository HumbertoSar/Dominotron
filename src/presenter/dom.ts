// O suco visual — DomPresenter. Consome o Trace (via traceToSteps) e o anima no DOM:
// revelacao sequencial, cor por tipo de numero, escalada de intensidade e explosao final.
// Com "juice": faiscas nos passos de multiplicador, bump por passo, e screen-shake no
// final proporcional ao multiplicador alcancado.
//
// Construido por ULTIMO (Leis 6 e 11). Em teste/CLI usa-se o NoOpPresenter; este so entra
// no navegador. A logica de "quais passos, que cor" e pura (steps.ts) e testada a parte.
// (Math.random aqui e OK: e camada de apresentacao, nao o engine — Lei 3 vale para engine/.)

import type { Trace } from '../engine/index'
import type { Presenter } from './presenter'
import { traceToSteps, type PresentationStep } from './steps'

export interface DomPresenterOptions {
  /** Atraso entre revelar cada passo (ms). 0/ausente = instantaneo (para testes). */
  stepDelayMs?: number
  /** Elemento a tremer (screen-shake) na explosao final. Sem ele, nao treme. */
  shakeTarget?: HTMLElement
  /** Liga faiscas/bump/shake. Default true. */
  juice?: boolean
}

export class DomPresenter implements Presenter {
  constructor(
    private readonly container: Element,
    private readonly opts: DomPresenterOptions = {},
  ) {}

  async present(trace: Trace): Promise<void> {
    const juice = this.opts.juice ?? true
    if (juice) ensureJuiceStyles()

    const steps = traceToSteps(trace)
    this.container.replaceChildren()

    const row = document.createElement('div')
    row.className = 'suco-row'
    this.container.appendChild(row)

    for (const step of steps) {
      const el = this.renderStep(step)
      row.appendChild(el)
      // forca o reflow e entao revela (a animacao CSS cuida do resto)
      void el.offsetWidth
      el.classList.add('suco-visible')

      if (juice) {
        // mais faiscas quanto mais a jogada cresce; explosao final solta um buque.
        if (step.isFinal) {
          emitSparks(el, 14, step.color)
          this.shake(step.mult)
        } else if (step.kind === 'mult' || step.kind === 'money') {
          emitSparks(el, 2 + Math.round(step.intensity * 4), step.color)
        }
      }

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

  /** Treme o alvo, com magnitude proporcional ao multiplicador (combos grandes tremem mais). */
  private shake(mult: number): void {
    const target = this.opts.shakeTarget
    if (!target) return
    const mag = Math.max(1, Math.min(3, Math.log2(Math.max(1, mult) + 1)))
    target.style.setProperty('--shake-mag', mag.toFixed(2))
    target.classList.remove('shaking')
    void target.offsetWidth
    target.classList.add('shaking')
    setTimeout(() => target.classList.remove('shaking'), 480)
  }
}

/** Solta `n` faiscas da cor dada saindo do elemento. */
function emitSparks(el: HTMLElement, n: number, color: string): void {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div')
    s.className = 'spark'
    const angle = Math.random() * Math.PI * 2
    const dist = 18 + Math.random() * 44
    s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`)
    s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`)
    s.style.background = color
    el.appendChild(s)
    setTimeout(() => s.remove(), 680)
  }
}

let stylesInjected = false
/** Injeta os keyframes do suco uma vez (serve a pagina do suco E o jogo, sem duplicar CSS). */
function ensureJuiceStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return
  stylesInjected = true
  const style = document.createElement('style')
  style.id = 'suco-juice-styles'
  style.textContent = `
    .suco-step { position: relative; }
    .suco-step.suco-visible { animation: suco-bump 0.3s ease; }
    .suco-final.suco-visible { animation: suco-explode 0.55s ease; }
    @keyframes suco-bump { 0% { transform: translateY(0) scale(1.35); } 100% { transform: translateY(0) scale(1); } }
    @keyframes suco-explode { 0% { transform: scale(0.5); } 45% { transform: scale(1.5) rotate(-2deg); } 100% { transform: scale(1) rotate(0); } }
    .spark {
      position: absolute; left: 50%; top: 50%;
      width: 7px; height: 7px; border-radius: 50%;
      pointer-events: none; box-shadow: 0 0 6px currentColor;
      animation: spark-fly 0.66s ease-out forwards;
    }
    @keyframes spark-fly {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0); opacity: 0; }
    }
    .shaking { animation: screen-shake 0.46s ease; }
    @keyframes screen-shake {
      10%, 90% { transform: translateX(calc(-2px * var(--shake-mag, 1))); }
      20%, 80% { transform: translateX(calc(3px * var(--shake-mag, 1))); }
      30%, 50%, 70% { transform: translateX(calc(-6px * var(--shake-mag, 1))) rotate(calc(-0.3deg * var(--shake-mag, 1))); }
      40%, 60% { transform: translateX(calc(6px * var(--shake-mag, 1))) rotate(calc(0.3deg * var(--shake-mag, 1))); }
    }`
  document.head.appendChild(style)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

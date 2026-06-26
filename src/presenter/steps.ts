// O nucleo do suco — transformacao PURA do Trace em passos de apresentacao.
//
// O Presenter consome o Trace; nunca o produz (Lei 6). Esta parte e pura e testavel:
// converte cada TraceEntry num passo com cor, rotulo e intensidade. A animacao no DOM
// (dom.ts) so consome esses passos.

import type { Trace, TraceEntry } from '../engine/index'

export type StepKind = 'base' | 'mult' | 'money' | 'resource' | 'final'

/** Mapa de cores FIXO (ARCHITECTURE.md / DOMINOTRON.md). A cor e o rotulo — sem texto. */
export const COLORS: Record<StepKind, string> = {
  base: '#3b82f6', // azul
  mult: '#ef4444', // vermelho
  money: '#f59e0b', // dourado
  resource: '#22c55e', // verde
  final: '#f59e0b', // dourado (explosao)
}

export function colorFor(kind: StepKind): string {
  return COLORS[kind]
}

export interface PresentationStep {
  kind: StepKind
  source: string
  /** ex.: "+4 mult", "x2 mult", "= 1240". */
  label: string
  color: string
  chips: number
  mult: number
  /** posicao na escalada 0..1 (tamanho/som crescentes ao longo do Trace). */
  intensity: number
  isFinal: boolean
}

/** A categoria (cor) de uma op. */
function kindOf(op: string): StepKind {
  if (op === 'add_money' || op === 'add_money_per_resource') return 'money'
  if (op === 'add_resource') return 'resource'
  if (op.includes('mult')) return 'mult'
  return 'base'
}

/** Rotulo curto e legivel de uma entrada do Trace. */
function labelOf(e: TraceEntry): string {
  const a = e.args.join(',')
  switch (e.op) {
    case 'add_base':
      return e.source === 'base' ? `${a} base` : `+${a} base`
    case 'add_mult':
      return `+${a} mult`
    case 'mul_mult':
      return `x${a} mult`
    case 'mul_mult_pow':
      return `x(${a}^duplas) mult`
    case 'add_base_tag':
      return `+base`
    case 'add_mult_tag':
      return `+mult`
    case 'add_base_per':
      return `+${a} base /match`
    case 'add_mult_per':
      return `+${a} mult /match`
    case 'add_mult_run':
      return `+mult /$`
    case 'add_money':
      return `+${a} $`
    case 'add_resource':
      return `+${a} recurso`
    case 'add_money_per_resource':
      return `+$ /recurso`
    default:
      return e.op
  }
}

/**
 * Converte um Trace na sequencia de passos do suco. O ultimo passo e a "explosao"
 * dourada do finalScore. Determinista: mesmo Trace -> mesmos passos.
 */
export function traceToSteps(trace: Trace): PresentationStep[] {
  const n = trace.entries.length
  const steps: PresentationStep[] = trace.entries.map((e, i) => {
    const kind: StepKind = e.source === 'base' ? 'base' : kindOf(e.op)
    return {
      kind,
      source: e.source,
      label: labelOf(e),
      color: colorFor(kind),
      chips: e.accAfter.chips,
      mult: e.accAfter.mult,
      intensity: n > 1 ? i / (n - 1) : 0,
      isFinal: false,
    }
  })

  const last = trace.entries[n - 1]
  steps.push({
    kind: 'final',
    source: 'final',
    label: `= ${trace.finalScore}`,
    color: colorFor('final'),
    chips: last?.accAfter.chips ?? trace.finalScore,
    mult: last?.accAfter.mult ?? 1,
    intensity: 1,
    isFinal: true,
  })
  return steps
}

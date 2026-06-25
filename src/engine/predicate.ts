// Avaliador de Predicate — puro e sem efeitos colaterais.
//
// O trigger de um modificador e uma arvore declarativa (Lei 7). Aqui a percorremos
// contra (ctx, run) e devolvemos um booleano. Nenhuma execucao de codigo arbitrario.

import type { Comparison, Predicate, RunStateView, ScoringContext } from './types'

/** Compara dois numeros segundo o operador declarado. */
export function compare(a: number, cmp: Comparison, b: number): boolean {
  switch (cmp) {
    case '==':
      return a === b
    case '!=':
      return a !== b
    case '>':
      return a > b
    case '>=':
      return a >= b
    case '<':
      return a < b
    case '<=':
      return a <= b
  }
}

/** Avalia o gatilho contra a jogada (ctx) e o estado da run. */
export function evaluatePredicate(
  pred: Predicate,
  ctx: ScoringContext,
  run: RunStateView,
): boolean {
  switch (pred.kind) {
    case 'always':
      return true

    case 'has_tag':
      return ctx.tags.some((t) => t.key === pred.tag)

    case 'tag_value': {
      const tag = ctx.tags.find((t) => t.key === pred.tag)
      if (tag?.value === undefined) return false
      return compare(tag.value, pred.cmp, pred.value)
    }

    case 'entity_count': {
      const n = ctx.entities.filter((e) => e.tags.some((t) => t.key === pred.key)).length
      return compare(n, pred.cmp, pred.value)
    }

    case 'run':
      return compare(run[pred.field], pred.cmp, pred.value)

    case 'snapshot': {
      // Unica metrica por ora: o comprimento da cobra. `mod` permite "multiplo de N".
      const metric = pred.metric === 'chainLength' ? ctx.snapshot.chainLength() : 0
      const lhs = pred.mod !== undefined ? metric % pred.mod : metric
      return compare(lhs, pred.cmp, pred.value)
    }

    case 'and':
      return pred.preds.every((p) => evaluatePredicate(p, ctx, run))

    case 'or':
      return pred.preds.some((p) => evaluatePredicate(p, ctx, run))

    case 'not':
      return !evaluatePredicate(pred.pred, ctx, run)
  }
}

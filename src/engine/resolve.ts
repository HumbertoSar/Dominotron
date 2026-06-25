// O Resolver — o nucleo puro e deterministico (Leis 2, 3, 5, 10).
//
// Transforma o que o board emitiu (ScoringContext) + os modificadores ativos (em ordem
// de slot) num Trace: um log ordenado de operacoes cujo fim e a pontuacao final.
//
// Puro: nenhuma escrita fora do retorno. Os `deltas` DESCREVEM mudancas (dinheiro,
// recursos) que o RunManager aplica — o Resolver nao muta a run.

import { evaluatePredicate } from './predicate'
import type {
  Accumulator,
  Effect,
  MatchQuery,
  Modifier,
  Rng,
  RunStateView,
  ScoringContext,
  StateDeltas,
  Trace,
  TraceEntry,
  TraceSource,
} from './types'

/** O valor da primeira tag do ctx com a chave dada (ou undefined). */
function tagValue(ctx: ScoringContext, key: string): number | undefined {
  return ctx.tags.find((t) => t.key === key)?.value
}

/** Conta quantas tags do ctx, entities da jogada, ou pecas da cobra casam a consulta. */
function matchCount(query: MatchQuery, ctx: ScoringContext): number {
  if (query.target === 'tag') {
    return ctx.tags.filter(
      (t) => t.key === query.key && (query.value === undefined || t.value === query.value),
    ).length
  }
  if (query.target === 'entity') {
    return ctx.entities.filter((e) =>
      e.tags.some(
        (t) => t.key === query.key && (query.value === undefined || t.value === query.value),
      ),
    ).length
  }
  // snapshot: conta pecas na cobra que contem um numero. O numero vem de `fromTag`
  // (ex.: closes_number) ou e fixo em `value`.
  const num = query.fromTag !== undefined ? tagValue(ctx, query.fromTag) : query.value
  if (num === undefined) return 0
  return ctx.snapshot.count(String(num))
}

/** Aplica um unico efeito ao acumulador/deltas e empurra uma TraceEntry. */
function applyEffect(
  effect: Effect,
  source: TraceSource,
  acc: Accumulator,
  deltas: StateDeltas,
  ctx: ScoringContext,
  entries: TraceEntry[],
): void {
  const n = effect.args[0] ?? 0

  switch (effect.op) {
    case 'add_base':
      acc.chips += n
      break

    case 'add_mult':
      acc.mult += n
      break

    case 'mul_mult':
      acc.mult *= n
      break

    case 'add_money':
      deltas.money = (deltas.money ?? 0) + n
      break

    case 'add_resource': {
      // O resource alvo vem no proprio efeito (dado declarativo).
      if (effect.resource !== undefined) {
        const resources = (deltas.resources ??= {})
        resources[effect.resource] = (resources[effect.resource] ?? 0) + n
      }
      break
    }

    case 'add_base_per':
      if (effect.query !== undefined) {
        acc.chips += n * matchCount(effect.query, ctx)
      }
      break

    case 'add_mult_per':
      if (effect.query !== undefined) {
        acc.mult += n * matchCount(effect.query, ctx)
      }
      break

    case 'add_base_tag':
      if (effect.tag !== undefined) {
        const v = tagValue(ctx, effect.tag)
        if (v !== undefined) acc.chips += (effect.args[0] ?? 1) * v
      }
      break

    case 'add_mult_tag':
      if (effect.tag !== undefined) {
        const v = tagValue(ctx, effect.tag)
        if (v !== undefined) acc.mult += (effect.args[0] ?? 1) * v
      }
      break
  }

  // accAfter e uma COPIA: o Trace e um historico imutavel de snapshots.
  entries.push({ source, op: effect.op, args: [...effect.args], accAfter: { ...acc } })
}

/**
 * Resolve uma jogada num Trace.
 *
 * @param ctx     o que o board emitiu para esta jogada
 * @param active  os modificadores nos slots, EM ORDEM (a ordem importa — Lei 10)
 * @param run     leitura read-only do estado da run, para os triggers
 * @param _rng    RNG semeado, reservado para efeitos que precisem (nenhum ainda; ver M2)
 */
export function resolve(
  ctx: ScoringContext,
  active: Modifier[],
  run: RunStateView,
  _rng: Rng,
): { trace: Trace; deltas: StateDeltas } {
  const entries: TraceEntry[] = []
  const deltas: StateDeltas = {}

  // Inicializa o acumulador a partir da jogada: chips = baseValue, mult = 1.
  // A base entra como a primeira linha do Trace (origem 'base') — o suco a pinta de azul.
  const acc: Accumulator = { chips: ctx.baseValue, mult: 1 }
  entries.push({ source: 'base', op: 'add_base', args: [ctx.baseValue], accAfter: { ...acc } })

  // Itera os modificadores na ordem dos slots, sequencialmente.
  for (const mod of active) {
    if (!evaluatePredicate(mod.trigger, ctx, run)) continue
    for (const effect of mod.effects) {
      applyEffect(effect, mod.id, acc, deltas, ctx, entries)
    }
  }

  const finalScore = acc.chips * acc.mult
  return { trace: { entries, finalScore }, deltas }
}

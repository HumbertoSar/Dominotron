// Eventos de rodada (M3 Parte 2c) — efeitos disparados por MOMENTOS da rodada
// (inicio, travamento, fim), nao por uma jogada.
//
// Diferente do Resolver (que produz pontuacao chips x mult), eventos so movem o estado
// da run: dinheiro e recursos. Por isso devolvem StateDeltas, nao um Trace.

import type { Effect, Modifier, RoundEvent, RunStateView, StateDeltas } from './types'

/** Aplica um efeito de evento aos deltas (apenas ops que fazem sentido fora de uma jogada). */
function applyEventEffect(effect: Effect, deltas: StateDeltas, run: RunStateView): void {
  const n = effect.args[0] ?? 0
  switch (effect.op) {
    case 'add_money':
      deltas.money = (deltas.money ?? 0) + n
      break
    case 'add_resource':
      if (effect.resource !== undefined) {
        const resources = (deltas.resources ??= {})
        resources[effect.resource] = (resources[effect.resource] ?? 0) + n
      }
      break
    case 'add_money_per_resource':
      if (effect.resource !== undefined) {
        deltas.money = (deltas.money ?? 0) + n * (run.resources[effect.resource] ?? 0)
      }
      break
    default:
      // Demais ops (de pontuacao) nao se aplicam a eventos — ignoradas.
      break
  }
}

/**
 * Resolve um evento de rodada: percorre os hooks dos modificadores ativos que casam o
 * evento e acumula seus efeitos em StateDeltas. Puro e deterministico.
 */
export function resolveEvent(
  event: RoundEvent,
  active: Modifier[],
  run: RunStateView,
): StateDeltas {
  const deltas: StateDeltas = {}
  for (const mod of active) {
    if (!mod.hooks) continue
    for (const hook of mod.hooks) {
      if (hook.on !== event) continue
      for (const effect of hook.effects) {
        applyEventEffect(effect, deltas, run)
      }
    }
  }
  return deltas
}

/** Soma o thinning (remocao de pecas na loja) dos modificadores de regra ativos. */
export function totalShopThinning(active: Modifier[]): number {
  return active.reduce(
    (sum, m) => sum + (m.rule?.kind === 'shop_thinning' ? (m.rule.amount ?? 0) : 0),
    0,
  )
}

/** Algum modificador ativo habilita jogar nas duas pontas (Canhoto)? */
export function hasTwoEndsPlay(active: Modifier[]): boolean {
  return active.some((m) => m.rule?.kind === 'two_ends_play')
}

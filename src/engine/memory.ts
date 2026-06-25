// Memoria de rodada — o que o Resolver lembra ENTRE jogadas da mesma rodada.
//
// Ate o M3 2a, o Resolver pontuava cada jogada isolada. Modificadores como Crescente,
// Gemeos e Motor Espelho dependem do que veio antes na rodada. A memoria quebra esse
// isolamento DE PROPOSITO — e e threaded pelo chamador (run loop), nao mutada pelo
// Resolver. Continua tudo puro e deterministico.

import type { RoundMemory, ScoringContext } from './types'

/** Estado de memoria no inicio de uma rodada (nenhuma jogada ainda). */
export const INITIAL_ROUND_MEMORY: RoundMemory = {
  plays: 0,
  prevValueSum: null,
  doubles: 0,
  prevWasDouble: false,
}

/** Cria uma memoria de rodada zerada (copia fresca). */
export function initialRoundMemory(): RoundMemory {
  return { ...INITIAL_ROUND_MEMORY }
}

/**
 * Avanca a memoria DEPOIS de resolver uma jogada, lendo as tags padrao do ctx.
 * Board-agnostico: usa value_sum e is_double, que qualquer board pode emitir.
 */
export function advanceRoundMemory(memory: RoundMemory, ctx: ScoringContext): RoundMemory {
  const sum = ctx.tags.find((t) => t.key === 'value_sum')?.value ?? null
  const wasDouble = ctx.tags.some((t) => t.key === 'is_double')
  return {
    plays: memory.plays + 1,
    prevValueSum: sum,
    doubles: memory.doubles + (wasDouble ? 1 : 0),
    prevWasDouble: wasDouble,
  }
}

// O BoardQuery do dominó: visao read-only e consultavel da cobra, para modificadores
// topologicos. Na Parte 1 expomos o essencial; consultas mais ricas (mostCommonNumber,
// etc.) chegam na Parte 2 junto dos mods que as usam.

import type { BoardQuery } from '../../engine/index'
import { type Tile } from './tiles'

/** Constroi a visao read-only da cobra atual e suas pontas. */
export function makeSnapshot(chain: Tile[], ends: readonly [number, number] | null): BoardQuery {
  return {
    /** Quantas pecas da cobra contem o numero `key` (interpretado como inteiro). */
    count: (key: string): number => {
      const n = Number(key)
      return chain.filter((t) => t.low === n || t.high === n).length
    },
    endsValues: (): number[] => (ends ? [ends[0], ends[1]] : []),
    chainLength: (): number => chain.length,
    mostCommonNumber: (): number | null => {
      const counts = new Map<number, number>()
      for (const t of chain) {
        for (const n of new Set([t.low, t.high])) {
          counts.set(n, (counts.get(n) ?? 0) + 1)
        }
      }
      let best: number | null = null
      let bestCount = 0
      for (const [n, c] of counts) {
        // desempate deterministico: maior contagem, depois menor numero.
        if (c > bestCount || (c === bestCount && best !== null && n < best)) {
          best = n
          bestCount = c
        }
      }
      return best
    },
  }
}

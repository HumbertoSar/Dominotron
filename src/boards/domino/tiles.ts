// As pecas do dominó duplo-seis e as tags PORTAVEIS que cada jogada emite.
//
// "Portavel" = quantitativa, funciona em qualquer board (valor, paridade, contagem).
// As tags TOPOLOGICAS (qual ponta, numero exposto) sao especificas do dominó e chegam
// na Parte 2 do M3, junto dos modificadores que as leem.

import type { Entity, Tag } from '../../engine/index'

/** Uma peca: dois lados (low <= high), de 0|0 a 6|6. */
export interface Tile {
  low: number
  high: number
  id: string
}

/** Cria uma peca normalizada (low <= high) com id estavel. */
export function tile(a: number, b: number): Tile {
  const low = Math.min(a, b)
  const high = Math.max(a, b)
  return { low, high, id: `${low}-${high}` }
}

/** As 28 pecas do saco duplo-seis. */
export const ALL_TILES: Tile[] = (() => {
  const tiles: Tile[] = []
  for (let low = 0; low <= 6; low++) {
    for (let high = low; high <= 6; high++) {
      tiles.push(tile(low, high))
    }
  }
  return tiles
})()

/** Pips = base da jogada (Lei 2: e a "qualidade" nas regras originais). 6|6 -> 12. */
export function tilePips(t: Tile): number {
  return t.low + t.high
}

export function isDouble(t: Tile): boolean {
  return t.low === t.high
}

/** Os numeros distintos presentes na peca (1 para dupla, 2 caso contrario). */
export function tileNumbers(t: Tile): number[] {
  return isDouble(t) ? [t.high] : [t.low, t.high]
}

/** As tags portateis emitidas por jogar esta peca (do vocabulario declarado). */
export function tileTags(t: Tile): Tag[] {
  const sum = tilePips(t)
  const tags: Tag[] = [
    { key: 'value_sum', value: sum },
    { key: 'value_max', value: t.high },
    { key: 'value_min', value: t.low },
  ]
  if (isDouble(t)) tags.push({ key: 'is_double' })
  tags.push(sum % 2 === 0 ? { key: 'is_even' } : { key: 'is_odd' })
  for (const n of tileNumbers(t)) tags.push({ key: 'contains', value: n })
  return tags
}

/** A peca jogada como entity, com as duas metades como tags `contains` (para ops _per). */
export function tileEntity(t: Tile): Entity {
  return {
    id: t.id,
    tags: [
      { key: 'contains', value: t.low },
      { key: 'contains', value: t.high },
    ],
  }
}

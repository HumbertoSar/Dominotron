// RngService — o unico servico de aleatoriedade do motor (Lei 4).
//
// Toda aleatoriedade vem de uma seed explicita: runs sao reproduziveis. Nenhum
// Math.random solto no engine. Usamos mulberry32 — um PRNG pequeno, rapido e de
// boa distribuicao, suficiente para um jogo (nao e criptografico).

import type { Rng, Seed } from './types'

/** Cria um RNG semeado e deterministico a partir de uma seed inteira. */
export function makeRng(seed: Seed): Rng {
  let a = seed >>> 0

  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int: (maxExclusive: number): number => Math.floor(next() * maxExclusive),
  }
}

/**
 * Combina varios inteiros numa unica seed (hash FNV-1a de 32 bits).
 *
 * Util para derivar streams independentes e deterministicos a partir da seed da run
 * — ex.: a oferta da loja na blind `i` usa `hashSeed(runSeed, i)`, de modo que cada
 * loja tenha seu proprio fluxo sem correlacao com as jogadas.
 */
export function hashSeed(...nums: number[]): Seed {
  let h = 0x811c9dc5 >>> 0 // offset basis FNV-1a
  for (const n of nums) {
    h ^= n >>> 0
    h = Math.imul(h, 0x01000193) >>> 0 // prime FNV-1a
  }
  return h >>> 0
}

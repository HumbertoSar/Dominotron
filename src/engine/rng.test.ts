import { describe, expect, it } from 'vitest'
import { hashSeed, makeRng } from './rng'

describe('makeRng — determinismo e forma', () => {
  it('mesma seed produz a mesma sequencia', () => {
    const a = makeRng(12345)
    const b = makeRng(12345)
    const seqA = Array.from({ length: 8 }, () => a.next())
    const seqB = Array.from({ length: 8 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('seeds diferentes produzem sequencias diferentes', () => {
    const a = Array.from({ length: 8 }, makeRng(1).next)
    const b = Array.from({ length: 8 }, makeRng(2).next)
    expect(a).not.toEqual(b)
  })

  it('next() fica em [0, 1)', () => {
    const rng = makeRng(7)
    for (let i = 0; i < 1000; i++) {
      const x = rng.next()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('int(max) fica em [0, max)', () => {
    const rng = makeRng(99)
    for (let i = 0; i < 1000; i++) {
      const x = rng.int(6)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(6)
      expect(Number.isInteger(x)).toBe(true)
    }
  })
})

describe('hashSeed', () => {
  it('e deterministico', () => {
    expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3))
  })

  it('depende da ordem dos argumentos', () => {
    expect(hashSeed(1, 2)).not.toBe(hashSeed(2, 1))
  })

  it('devolve um inteiro nao-negativo de 32 bits', () => {
    const h = hashSeed(42, 7)
    expect(Number.isInteger(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(2 ** 32)
  })
})

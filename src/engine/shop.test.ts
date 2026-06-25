import { describe, expect, it } from 'vitest'
import { createRun } from './run'
import {
  activateModifier,
  BASE_REROLL_COST,
  buyModifier,
  deactivateModifier,
  generateShopOffer,
  priceOf,
  rerollShop,
  sellModifier,
} from './shop'
import { makeConfig } from './test-helpers'

const config = makeConfig()

describe('oferta da loja (DoD: deterministica por seed)', () => {
  it('a mesma seed produz a mesma oferta', () => {
    expect(generateShopOffer(config, 777)).toEqual(generateShopOffer(config, 777))
  })

  it('oferece 2 modificadores distintos', () => {
    const offer = generateShopOffer(config, 777)
    expect(offer.modifierIds).toHaveLength(2)
    expect(new Set(offer.modifierIds).size).toBe(2)
    expect(offer.rerollCost).toBe(BASE_REROLL_COST)
  })

  it('a seed realmente importa (varias seeds geram ofertas distintas)', () => {
    const distinct = new Set(
      Array.from({ length: 50 }, (_, i) => JSON.stringify(generateShopOffer(config, i).modifierIds)),
    )
    expect(distinct.size).toBeGreaterThan(1)
  })
})

describe('precos', () => {
  it('preco por raridade', () => {
    expect(priceOf(config, 'heavyweight')).toBe(4) // common
    expect(priceOf(config, 'numerologo')).toBe(6) // uncommon
    expect(priceOf(config, 'serpente')).toBe(8) // rare
    expect(priceOf(config, 'inexistente')).toBeUndefined()
  })
})

describe('comprar / vender', () => {
  it('compra deduz o preco e adiciona a colecao', () => {
    const s = { ...createRun(config, 1), money: 10 }
    const out = buyModifier(config, s, 'serpente') // preco 8
    expect(out.ok).toBe(true)
    expect(out.state.money).toBe(2)
    expect(out.state.ownedModifierIds).toContain('serpente')
  })

  it('compra falha sem dinheiro suficiente', () => {
    const s = { ...createRun(config, 1), money: 3 }
    const out = buyModifier(config, s, 'serpente') // preco 8
    expect(out.ok).toBe(false)
    expect(out.state).toBe(s)
  })

  it('nao compra duplicado', () => {
    const s = { ...createRun(config, 1), money: 100, ownedModifierIds: ['serpente'] }
    expect(buyModifier(config, s, 'serpente').ok).toBe(false)
  })

  it('venda devolve metade e remove da colecao e dos slots', () => {
    const s = {
      ...createRun(config, 1),
      money: 0,
      ownedModifierIds: ['serpente'],
      activeModifierIds: ['serpente'],
    }
    const out = sellModifier(config, s, 'serpente') // metade de 8 = 4
    expect(out.ok).toBe(true)
    expect(out.state.money).toBe(4)
    expect(out.state.ownedModifierIds).not.toContain('serpente')
    expect(out.state.activeModifierIds).not.toContain('serpente')
  })
})

describe('reroll', () => {
  it('paga o custo, gera nova oferta e sobe o custo do proximo', () => {
    const s = { ...createRun(config, 1), money: 5 }
    const offer = generateShopOffer(config, 1)
    const out = rerollShop(config, s, offer, 2)
    expect(out.ok).toBe(true)
    expect(out.state.money).toBe(5 - offer.rerollCost)
    expect(out.offer.rerollCost).toBe(offer.rerollCost + 1)
  })

  it('falha sem dinheiro', () => {
    const s = { ...createRun(config, 1), money: 1 }
    const offer = generateShopOffer(config, 1)
    expect(rerollShop(config, s, offer, 2).ok).toBe(false)
  })
})

describe('slots (Lei 9: escassez)', () => {
  it('ativa um modificador possuido', () => {
    const s = { ...createRun(config, 1), ownedModifierIds: ['serpente'] }
    const out = activateModifier(config, s, 'serpente')
    expect(out.ok).toBe(true)
    expect(out.state.activeModifierIds).toEqual(['serpente'])
  })

  it('respeita o limite de slots', () => {
    const owned = ['a', 'b', 'c', 'd', 'e', 'f']
    const s = {
      ...createRun({ ...config, slots: 5 }, 1),
      ownedModifierIds: owned,
      activeModifierIds: ['a', 'b', 'c', 'd', 'e'], // 5 = cheio
    }
    expect(activateModifier({ ...config, slots: 5 }, s, 'f').ok).toBe(false)
  })

  it('desativa sem vender', () => {
    const s = {
      ...createRun(config, 1),
      ownedModifierIds: ['serpente'],
      activeModifierIds: ['serpente'],
    }
    const out = deactivateModifier(s, 'serpente')
    expect(out.ok).toBe(true)
    expect(out.state.activeModifierIds).toEqual([])
    expect(out.state.ownedModifierIds).toEqual(['serpente']) // continua na colecao
  })
})

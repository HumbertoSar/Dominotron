// Economy / Shop — a oferta da loja e as transacoes.
//
// A oferta e uma amostra SEMEADA do pool por raridade: deterministica por seed (DoD).
// Compras/vendas/reroll e ativacao de slots sao funcoes puras sobre o RunState.

import { modifierById, type RunConfig } from './config'
import { makeRng } from './rng'
import type { RunState } from './run'
import type { Modifier, ModifierId, Rarity, Seed } from './types'

/** Custo-base de um reroll; sobe +1 a cada uso na mesma loja (DOMINOTRON.md). */
export const BASE_REROLL_COST = 2

/** Peso de amostragem por raridade: comuns aparecem muito mais que raras. */
const RARITY_WEIGHT: Record<Rarity, number> = { common: 100, uncommon: 40, rare: 15 }

/** Quantos modificadores a loja oferece por vez. */
const OFFER_SIZE = 2

export interface ShopOffer {
  /** Os modificadores oferecidos (ids), em ordem de exibicao. */
  modifierIds: ModifierId[]
  /** Custo do proximo reroll desta loja. */
  rerollCost: number
}

/** Sorteio ponderado por raridade de um item da lista (consome 1 numero do rng). */
function weightedPick(rng: { next(): number }, items: Modifier[]): Modifier {
  const total = items.reduce((sum, m) => sum + RARITY_WEIGHT[m.rarity], 0)
  let r = rng.next() * total
  for (const m of items) {
    r -= RARITY_WEIGHT[m.rarity]
    if (r < 0) return m
  }
  return items[items.length - 1] as Modifier // fallback por erro de ponto flutuante
}

/**
 * Gera a oferta da loja, deterministica na seed. Amostra `OFFER_SIZE` modificadores
 * distintos do pool, ponderados por raridade.
 */
export function generateShopOffer(
  config: RunConfig,
  seed: Seed,
  rerollCost: number = BASE_REROLL_COST,
): ShopOffer {
  const rng = makeRng(seed)
  const pool = [...config.modifiers]
  const picked: ModifierId[] = []

  for (let k = 0; k < OFFER_SIZE && pool.length > 0; k++) {
    const chosen = weightedPick(rng, pool)
    picked.push(chosen.id)
    pool.splice(pool.indexOf(chosen), 1) // sem repeticao na mesma oferta
  }

  return { modifierIds: picked, rerollCost }
}

/** Preco de compra de um modificador, pela raridade. */
export function priceOf(config: RunConfig, id: ModifierId): number | undefined {
  const mod = modifierById(config, id)
  return mod ? config.economy.prices[mod.rarity] : undefined
}

export interface TxResult {
  state: RunState
  ok: boolean
}

/** Compra um modificador da oferta: deduz o preco e o adiciona a colecao. */
export function buyModifier(config: RunConfig, state: RunState, id: ModifierId): TxResult {
  const price = priceOf(config, id)
  if (price === undefined || state.money < price || state.ownedModifierIds.includes(id)) {
    return { state, ok: false }
  }
  return {
    state: {
      ...state,
      money: state.money - price,
      ownedModifierIds: [...state.ownedModifierIds, id],
    },
    ok: true,
  }
}

/** Vende um modificador da colecao: devolve metade do preco (arredondado pra baixo). */
export function sellModifier(config: RunConfig, state: RunState, id: ModifierId): TxResult {
  const price = priceOf(config, id)
  if (price === undefined || !state.ownedModifierIds.includes(id)) {
    return { state, ok: false }
  }
  return {
    state: {
      ...state,
      money: state.money + Math.floor(price / 2),
      ownedModifierIds: state.ownedModifierIds.filter((x) => x !== id),
      activeModifierIds: state.activeModifierIds.filter((x) => x !== id),
    },
    ok: true,
  }
}

export interface RerollResult {
  state: RunState
  offer: ShopOffer
  ok: boolean
}

/** Reroll: paga o custo atual, gera nova oferta e sobe o custo do proximo reroll. */
export function rerollShop(
  config: RunConfig,
  state: RunState,
  offer: ShopOffer,
  seed: Seed,
): RerollResult {
  if (state.money < offer.rerollCost) {
    return { state, offer, ok: false }
  }
  const newState: RunState = { ...state, money: state.money - offer.rerollCost }
  const newOffer = generateShopOffer(config, seed, offer.rerollCost + 1)
  return { state: newState, offer: newOffer, ok: true }
}

/** Ativa um modificador num slot (respeita o limite `config.slots` — Lei 9). */
export function activateModifier(config: RunConfig, state: RunState, id: ModifierId): TxResult {
  const ownsIt = state.ownedModifierIds.includes(id)
  const alreadyActive = state.activeModifierIds.includes(id)
  const slotsFull = state.activeModifierIds.length >= config.slots
  if (!ownsIt || alreadyActive || slotsFull) {
    return { state, ok: false }
  }
  return {
    state: { ...state, activeModifierIds: [...state.activeModifierIds, id] },
    ok: true,
  }
}

/** Remove um modificador dos slots (sem vende-lo). */
export function deactivateModifier(state: RunState, id: ModifierId): TxResult {
  if (!state.activeModifierIds.includes(id)) {
    return { state, ok: false }
  }
  return {
    state: { ...state, activeModifierIds: state.activeModifierIds.filter((x) => x !== id) },
    ok: true,
  }
}

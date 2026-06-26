// Synergy-climber — busca uma colecao FORTE de modificadores (<= slots).
//
// O SANITY_TESTS.md avisa: um synergy-climber fraco subestima tetos e gera falso-negativo
// em T4/T6. Aqui usamos um hill-climb guloso: parte do vazio e, a cada passo, adiciona o
// modificador que mais aumenta a pontuacao avaliada num limiar-alvo. Simples, mas honesto.

import { type RunConfig } from '../engine/index'
import { scoreBlind } from './simulate'

/** Seeds fixas para avaliar uma build (media, para nao depender de uma mao sortuda). */
const EVAL_SEEDS = [11, 23, 37, 59]

/** Pontuacao media de uma build num limiar (blindIndex), sobre as seeds de avaliacao. */
function evalBuild(config: RunConfig, ids: string[], blindIndex: number): number {
  const total = EVAL_SEEDS.reduce((sum, seed) => sum + scoreBlind(config, seed, ids, blindIndex), 0)
  return total / EVAL_SEEDS.length
}

export interface BuildResult {
  ids: string[]
  score: number
}

/**
 * Hill-climb guloso ate `slots` modificadores. A cada passo, testa adicionar cada
 * candidato e fica com o melhor; para quando nenhum acrescimo melhora. A ordem em que
 * sao adicionados respeita a nao-comutatividade (Lei 10).
 */
export function climbBuild(config: RunConfig, blindIndex: number, slots = config.slots): BuildResult {
  const pool = config.modifiers.map((m) => m.id)
  let current: string[] = []
  let currentScore = evalBuild(config, current, blindIndex)

  while (current.length < slots) {
    let bestAdd: { id: string; score: number } | null = null
    for (const id of pool) {
      if (current.includes(id)) continue
      const score = evalBuild(config, [...current, id], blindIndex)
      if (bestAdd === null || score > bestAdd.score) bestAdd = { id, score }
    }
    if (bestAdd === null || bestAdd.score <= currentScore) break
    current = [...current, bestAdd.id]
    currentScore = bestAdd.score
  }

  return { ids: current, score: currentScore }
}

/** Custo total de comprar uma build (soma dos custos dos modificadores). */
export function buildCost(config: RunConfig, ids: string[]): number {
  return ids.reduce((sum, id) => sum + (config.modifiers.find((m) => m.id === id)?.cost ?? 0), 0)
}

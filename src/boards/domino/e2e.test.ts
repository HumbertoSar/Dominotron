// Uma run end-to-end rodando HEADLESS (sem CLI, sem suco) com seed fixa.
//
// Prova que as pecas se encaixam: board (jogada) -> Resolver (Trace) -> RunManager
// (placar/recursos/economia). E o ensaio geral do que o M5 (CLI) vai orquestrar.

import { describe, expect, it } from 'vitest'
import {
  addRoundScore,
  applyDeltas,
  createRun,
  isBlindWon,
  makeRng,
  resolve,
  runStateView,
  settleBlind,
  type Modifier,
  type RunConfig,
  type RunState,
} from '../../engine/index'
import { dominoBoard } from './board'
import { DOMINO_POOL_PORTABLE } from './pool'

function dominoConfig(): RunConfig {
  return {
    board: 'domino',
    resources: { plays: 8, redraws: 3 },
    thresholdCurve: { base: 18, growth: 1.3, antes: 8, blindsPerAnte: 3 },
    economy: {
      blindReward: { small: 3, big: 4, boss: 5 },
      interestPer: 5,
      interestCap: 5,
      prices: { common: 4, uncommon: 6, rare: 8 },
    },
    slots: 5,
    modifiers: DOMINO_POOL_PORTABLE,
  }
}

/** Joga uma blind inteira de forma headless com o greedyBaseAgent. Determinista na seed. */
function playOneBlind(seed: number, active: Modifier[]): RunState {
  const config = dominoConfig()
  let run: RunState = {
    ...createRun(config, seed),
    ownedModifierIds: active.map((m) => m.id),
    activeModifierIds: active.map((m) => m.id),
  }
  let board = dominoBoard.init(seed, { resources: config.resources })
  const rng = makeRng(seed)

  while ((run.resources.plays ?? 0) > 0 && !dominoBoard.isRoundOver(board)) {
    const action = dominoBoard.greedyBaseAgent(board)
    const { state, context } = dominoBoard.apply(board, action)
    board = state

    const { trace, deltas } = resolve(context, active, runStateView(config, run), rng)
    run = addRoundScore(run, trace.finalScore)
    run = applyDeltas(run, deltas) // dinheiro de mods (ex.: Lustro)
    run = applyDeltas(run, { resources: { plays: -(context.consumes.plays ?? 0) } })
  }
  return run
}

describe('run headless end-to-end (DoD do M3)', () => {
  it('uma blind roda ate o fim e produz pontuacao', () => {
    const run = playOneBlind(2026, [])
    expect(run.roundScore).toBeGreaterThan(0)
    expect(run.resources.plays).toBeLessThan(8) // consumiu jogadas
  })

  it('e deterministica na seed (mesma seed -> mesmo resultado)', () => {
    expect(playOneBlind(2026, [])).toEqual(playOneBlind(2026, []))
  })

  it('seeds diferentes geram runs diferentes', () => {
    expect(playOneBlind(1, []).roundScore).not.toBe(playOneBlind(99, []).roundScore)
  })

  it('modificadores ativos elevam a pontuacao vs. jogar limpo', () => {
    const limpo = playOneBlind(2026, []).roundScore
    const comMods = playOneBlind(2026, DOMINO_POOL_PORTABLE).roundScore
    expect(comMods).toBeGreaterThan(limpo)
  })

  it('o ciclo de blind fecha: com pontuacao suficiente, vence e paga recompensa', () => {
    // injeta um placar acima do limiar e resolve a blind
    const config = dominoConfig()
    const run = addRoundScore({ ...createRun(config, 7), money: 0 }, 1000)
    expect(isBlindWon(config, run)).toBe(true)
    const out = settleBlind(config, run)
    expect(out.won).toBe(true)
    expect(out.state.money).toBeGreaterThan(0) // recompensa + sobra de recursos
    expect(out.state.blindIndex).toBe(2)
  })
})

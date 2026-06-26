// Simulador de partidas headless — o motor do harness.
//
// Joga uma run INTEIRA (blinds + loja entre elas) com uma estrategia, sem renderizar
// nada. Deterministico na seed. Os testes de sanidade (SANITY_TESTS.md) rodam centenas
// destes em Monte Carlo e leem as estatisticas.

import {
  activateModifier,
  addRoundScore,
  advanceRoundMemory,
  applyDeltas,
  buyModifier,
  createRun,
  generateShopOffer,
  hashSeed,
  initialRoundMemory,
  makeRng,
  resolve,
  resolveEvent,
  runStateView,
  settleBlind,
  totalBlinds,
  type Modifier,
  type Rng,
  type RunConfig,
  type RunState,
} from '../engine/index'
import { dominoBoard, type DominoAction, type DominoState } from '../boards/domino/board'

/** Como uma estrategia joga e compra. */
export interface Strategy {
  /** Escolhe a jogada, dado o estado do tabuleiro e os modificadores ativos. */
  pick(state: DominoState, active: Modifier[]): DominoAction
  /** Fase de loja apos vencer uma blind: pode comprar/ativar modificadores. */
  shop(run: RunState, config: RunConfig, seed: number): RunState
}

/** Resultado de uma run simulada. */
export interface RunOutcome {
  status: 'won' | 'dead'
  /** Blinds efetivamente vencidas. */
  blindsCleared: number
  totalBlinds: number
  /** Fracao da run cumprida (0..1) — o numero que o T3 mede. */
  progress: number
  /** Pontuacao de cada blind jogada (para o T2). */
  perBlindScore: number[]
  /** Modificadores ativos ao fim (para clusterizar arquetipos no T6). */
  finalActiveIds: string[]
}

/** Resolve os ids ativos da run para os objetos Modifier do config. */
function activeModifiers(run: RunState, config: RunConfig): Modifier[] {
  return run.activeModifierIds
    .map((id) => config.modifiers.find((m) => m.id === id))
    .filter((m): m is Modifier => m !== undefined)
}

/** Joga uma blind ate o fim, devolvendo a run atualizada (com placar e eventos aplicados). */
function playBlind(run: RunState, config: RunConfig, seed: number): RunState {
  const active = activeModifiers(run, config)
  const blindSeed = hashSeed(seed, run.blindIndex)
  const rng: Rng = makeRng(blindSeed)
  let state: DominoState = dominoBoard.init(blindSeed, { resources: config.resources })
  let memory = initialRoundMemory()

  run = applyDeltas(run, resolveEvent('round_start', active, runStateView(config, run)))

  while ((run.resources.plays ?? 0) > 0 && !dominoBoard.isRoundOver(state)) {
    const action =
      active.length > 0 && dominoBoard.synergyAgent
        ? dominoBoard.synergyAgent(state, active)
        : dominoBoard.greedyBaseAgent(state)
    const applied = dominoBoard.apply(state, action)
    state = applied.state

    const { trace, deltas } = resolve(applied.context, active, runStateView(config, run), rng, memory)
    run = addRoundScore(run, trace.finalScore)
    run = applyDeltas(run, deltas)
    run = applyDeltas(run, { resources: { plays: -(applied.context.consumes.plays ?? 0) } })
    memory = advanceRoundMemory(memory, applied.context)
  }

  if (state.hand.length > 0 && dominoBoard.isRoundOver(state)) {
    run = applyDeltas(run, resolveEvent('lock', active, runStateView(config, run)))
  }
  run = applyDeltas(run, resolveEvent('round_end', active, runStateView(config, run)))
  return run
}

/** Joga uma run inteira com a estrategia dada. Deterministico na seed. */
export function simulateRun(config: RunConfig, seed: number, strategy: Strategy): RunOutcome {
  const total = totalBlinds(config.thresholdCurve)
  let run = createRun(config, seed)
  const perBlindScore: number[] = []

  while (run.status === 'playing') {
    run = playBlind(run, config, seed)
    perBlindScore.push(run.roundScore)

    const settled = settleBlind(config, run)
    run = settled.state

    if (settled.won && run.status === 'playing') {
      run = strategy.shop(run, config, hashSeed(seed, 9000 + run.blindIndex))
    }
  }

  const blindsCleared = run.status === 'won' ? total : run.blindIndex - 1
  return {
    status: run.status,
    blindsCleared,
    totalBlinds: total,
    progress: blindsCleared / total,
    perBlindScore,
    finalActiveIds: [...run.activeModifierIds],
  }
}

// ---------------------------------------------------------------------------
// Estrategias de referencia
// ---------------------------------------------------------------------------

/** Joga UMA blind com uma colecao ativa fixa (sem loja) e devolve a pontuacao.
 *  Base do synergy-climber e do T4: avalia o teto de uma build num limiar especifico. */
export function scoreBlind(
  config: RunConfig,
  seed: number,
  activeIds: string[],
  blindIndex = 1,
): number {
  let run: RunState = {
    ...createRun(config, seed),
    blindIndex,
    ownedModifierIds: [...activeIds],
    activeModifierIds: [...activeIds],
  }
  run = playBlind(run, config, seed)
  return run.roundScore
}

/** "Jogar limpo": greedy de base, ZERO modificadores, nunca compra (T3). */
export const cleanStrategy: Strategy = {
  pick: (state) => dominoBoard.greedyBaseAgent(state),
  shop: (run) => run,
}

/** Sinergia: joga com o synergyAgent e compra/ativa o que a loja oferecer (T6/T7). */
export const synergyStrategy: Strategy = {
  pick: (state, active) =>
    active.length > 0 && dominoBoard.synergyAgent
      ? dominoBoard.synergyAgent(state, active)
      : dominoBoard.greedyBaseAgent(state),
  shop: (run, config, seed) => {
    const offer = generateShopOffer(config, seed)
    for (const id of offer.modifierIds) {
      if (run.activeModifierIds.length >= config.slots) break
      const bought = buyModifier(config, run, id)
      if (!bought.ok) continue
      run = bought.state
      const activated = activateModifier(config, run, id)
      if (activated.ok) run = activated.state
    }
    return run
  },
}

/** Aquisicao aleatoria semeada: compra/ativa modificadores da oferta (T2). */
export function randomStrategy(buyChance = 0.7): Strategy {
  return {
    pick: (state, active) =>
      active.length > 0 && dominoBoard.synergyAgent
        ? dominoBoard.synergyAgent(state, active)
        : dominoBoard.greedyBaseAgent(state),
    shop: (run, config, seed) => {
      const rng = makeRng(seed)
      const offer = generateShopOffer(config, seed)
      for (const id of offer.modifierIds) {
        if (rng.next() >= buyChance) continue
        const bought = buyModifier(config, run, id)
        if (!bought.ok) continue
        run = bought.state
        const activated = activateModifier(config, run, id)
        if (activated.ok) run = activated.state
      }
      return run
    },
  }
}

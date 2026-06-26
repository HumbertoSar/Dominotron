// A sessao de jogo da CLI (M5) — joga uma run inteira em TEXTO PURO.
//
// Dirigida por um IO injetavel: em producao, readline; em teste, inputs roteirizados.
// O modo `auto` faz o agente jogar (para demo/verificacao sem digitar nada).
//
// Continua headless quanto a apresentacao: nada de cores/animacao (isso e o M6). Mas
// imprime o Trace textual, provando que a fonte de verdade do suco ja existe.

import {
  activateModifier,
  addRoundScore,
  advanceRoundMemory,
  anteBlindOf,
  applyDeltas,
  blindTypeFor,
  buyModifier,
  createRun,
  currentThreshold,
  generateShopOffer,
  hashSeed,
  initialRoundMemory,
  makeRng,
  modifierById,
  resolve,
  resolveEvent,
  rerollShop,
  runStateView,
  settleBlind,
  type Modifier,
  type RunConfig,
  type RunState,
  type ShopOffer,
} from '../engine/index'
import {
  applyAction,
  dominoBoard,
  legalActionsFor,
  redraw,
  type DominoState,
} from '../boards/domino/board'
import { renderHand, renderEnds, renderShop, renderStatus, renderTrace } from './render'

export interface CliIO {
  print(line: string): void
  ask(question: string): Promise<string>
}

export interface SessionOptions {
  auto?: boolean
}

function activeMods(run: RunState, config: RunConfig): Modifier[] {
  return run.activeModifierIds
    .map((id) => modifierById(config, id))
    .filter((m): m is Modifier => m !== undefined)
}

function activeNames(run: RunState, config: RunConfig): string[] {
  return activeMods(run, config).map((m) => m.name)
}

function printStatus(config: RunConfig, run: RunState, state: DominoState, io: CliIO): void {
  const { ante, blind } = anteBlindOf(config.thresholdCurve, run.blindIndex)
  io.print('')
  io.print(
    renderStatus({
      ante,
      blind,
      blindType: blindTypeFor(config.thresholdCurve, run.blindIndex),
      threshold: currentThreshold(config, run),
      roundScore: run.roundScore,
      money: run.money,
      resources: run.resources,
      activeNames: activeNames(run, config),
    }),
  )
  io.print(renderEnds(state))
  io.print(`mao: ${renderHand(state.hand)}`)
}

/** Joga uma blind ate o fim e a resolve. Retorna a run pos-settle. */
async function runOneBlind(
  config: RunConfig,
  seed: number,
  run: RunState,
  io: CliIO,
  auto: boolean,
): Promise<RunState> {
  const active = activeMods(run, config)
  const blindSeed = hashSeed(seed, run.blindIndex)
  let state = dominoBoard.init(blindSeed, { resources: config.resources })
  const rng = makeRng(blindSeed)
  let memory = initialRoundMemory()

  run = applyDeltas(run, resolveEvent('round_start', active, runStateView(config, run)))

  while ((run.resources.plays ?? 0) > 0 && !dominoBoard.isRoundOver(state)) {
    const actions = legalActionsFor(state)
    printStatus(config, run, state, io)

    let chosenIndex: number
    if (auto) {
      const action =
        active.length > 0 && dominoBoard.synergyAgent
          ? dominoBoard.synergyAgent(state, active)
          : dominoBoard.greedyBaseAgent(state)
      chosenIndex = actions.findIndex(
        (a) => a.tileId === action.tileId && a.side === action.side,
      )
      if (chosenIndex < 0) chosenIndex = 0
    } else {
      io.print('')
      actions.forEach((a, i) => {
        io.print(`  ${i + 1}) jogar ${a.tileId} na ponta ${a.side}`)
      })
      const canRedraw = (run.resources.redraws ?? 0) > 0
      const answer = (
        await io.ask(`jogada (1-${actions.length}${canRedraw ? ", 'r' redraw" : ''}): `)
      ).trim()

      if (answer.toLowerCase() === 'r' && canRedraw) {
        const which = await io.ask('descartar quais da mao? (ex: 1 3): ')
        const ids = which
          .split(/\s+/)
          .map((s) => Number(s) - 1)
          .filter((i) => i >= 0 && i < state.hand.length)
          .map((i) => state.hand[i]!.id)
        state = redraw(state, ids)
        run = applyDeltas(run, { resources: { redraws: -1 } })
        io.print(`(redraw: ${ids.length} pecas trocadas)`)
        continue
      }
      const n = Number(answer)
      chosenIndex = Number.isInteger(n) && n >= 1 && n <= actions.length ? n - 1 : 0
    }

    const action = actions[chosenIndex]!
    const { state: nextState, context } = applyAction(state, action)
    state = nextState

    const { trace, deltas } = resolve(context, active, runStateView(config, run), rng, memory)
    io.print(`jogou ${action.tileId}:`)
    io.print(renderTrace(trace))

    run = addRoundScore(run, trace.finalScore)
    run = applyDeltas(run, deltas)
    run = applyDeltas(run, { resources: { plays: -(context.consumes.plays ?? 0) } })
    memory = advanceRoundMemory(memory, context)
  }

  if (state.hand.length > 0 && dominoBoard.isRoundOver(state)) {
    run = applyDeltas(run, resolveEvent('lock', active, runStateView(config, run)))
    io.print('(travou! evento de lock disparado)')
  }
  run = applyDeltas(run, resolveEvent('round_end', active, runStateView(config, run)))

  const threshold = currentThreshold(config, run)
  const finalScore = run.roundScore
  const settled = settleBlind(config, run)
  if (settled.won) {
    io.print(`\n✅ blind vencida: ${finalScore} >= ${threshold}  (+$${settled.reward})`)
  } else {
    io.print(`\n❌ blind perdida: ${finalScore} < ${threshold}`)
  }
  return settled.state
}

/** Fase de loja entre blinds: comprar/ativar modificadores. */
async function shopPhase(
  config: RunConfig,
  seed: number,
  run: RunState,
  io: CliIO,
  auto: boolean,
): Promise<RunState> {
  let offer: ShopOffer = generateShopOffer(config, hashSeed(seed, 9000 + run.blindIndex))

  const tryBuyActivate = (id: string): void => {
    const bought = buyModifier(config, run, id)
    if (!bought.ok) {
      io.print('  (sem dinheiro ou ja possui)')
      return
    }
    run = bought.state
    const mod = modifierById(config, id)
    if (run.activeModifierIds.length < config.slots) {
      const act = activateModifier(config, run, id)
      if (act.ok) run = act.state
      io.print(`  comprou e ativou ${mod?.name}`)
    } else {
      io.print(`  comprou ${mod?.name} (slots cheios — fica na colecao)`)
    }
  }

  if (auto) {
    for (const id of offer.modifierIds) {
      if (run.activeModifierIds.length >= config.slots) break
      tryBuyActivate(id)
    }
    return run
  }

  // interativo
  for (;;) {
    io.print('')
    io.print(renderShop(offer, config, run.money))
    const answer = (await io.ask('loja: ')).trim().toLowerCase()
    if (answer === '' || answer === 'q') break
    if (answer === 'r') {
      const rolled = rerollShop(config, run, offer, hashSeed(seed, run.blindIndex * 31 + run.money))
      if (rolled.ok) {
        run = rolled.state
        offer = rolled.offer
      } else {
        io.print('  (sem dinheiro p/ reroll)')
      }
      continue
    }
    const n = Number(answer)
    if (Number.isInteger(n) && n >= 1 && n <= offer.modifierIds.length) {
      tryBuyActivate(offer.modifierIds[n - 1]!)
    }
  }
  return run
}

/** Joga uma run inteira. Retorna o desfecho. */
export async function playSession(
  config: RunConfig,
  seed: number,
  io: CliIO,
  opts: SessionOptions = {},
): Promise<'won' | 'dead'> {
  const auto = opts.auto ?? false
  io.print(`\n=== DOMINOTRON — seed ${seed}${auto ? ' (auto)' : ''} ===`)

  let run = createRun(config, seed)
  while (run.status === 'playing') {
    run = await runOneBlind(config, seed, run, io, auto)
    if (run.status === 'dead') {
      io.print('\n💀 Fim da run (permadeath).')
      return 'dead'
    }
    if (run.status === 'won') {
      io.print('\n🏆 Run completa — voce venceu!')
      return 'won'
    }
    run = await shopPhase(config, seed, run, io, auto)
  }
  return 'dead'
}

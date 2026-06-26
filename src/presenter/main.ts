// Ponto de entrada da pagina do suco (M6). Gera um Trace REAL (board + Resolver) e o
// anima com o DomPresenter. E o mesmo Trace que a CLI imprime em texto — aqui, fogos.

import {
  advanceRoundMemory,
  createRun,
  hashSeed,
  initialRoundMemory,
  makeRng,
  resolve,
  runStateView,
  type Modifier,
  type Trace,
} from '../engine/index'
import { defaultDominoConfig } from '../boards/domino/config'
import { dominoBoard } from '../boards/domino/board'
import { DomPresenter } from './dom'

const config = defaultDominoConfig()
const ACTIVE_IDS = ['even_steven', 'martelo', 'serpente', 'mirror_engine', 'colecionador']
const activeMods: Modifier[] = config.modifiers.filter((m) => ACTIVE_IDS.includes(m.id))

/** Joga algumas pecas (construindo cobra e memoria) e devolve o Trace da ULTIMA jogada. */
function generateTrace(seed: number): { trace: Trace; tileId: string } {
  let state = dominoBoard.init(hashSeed(seed, 1), { resources: config.resources })
  const run = {
    ...createRun(config, seed),
    activeModifierIds: [...ACTIVE_IDS],
    ownedModifierIds: [...ACTIVE_IDS],
  }
  const rng = makeRng(seed)
  let memory = initialRoundMemory()
  let last: { trace: Trace; tileId: string } | null = null

  for (let i = 0; i < 7 && !dominoBoard.isRoundOver(state); i++) {
    const action = dominoBoard.synergyAgent
      ? dominoBoard.synergyAgent(state, activeMods)
      : dominoBoard.greedyBaseAgent(state)
    const applied = dominoBoard.apply(state, action)
    state = applied.state
    const { trace } = resolve(applied.context, activeMods, runStateView(config, run), rng, memory)
    memory = advanceRoundMemory(memory, applied.context)
    last = { trace, tileId: action.tileId }
  }
  return last ?? { trace: { entries: [], finalScore: 0 }, tileId: '-' }
}

const app = document.querySelector<HTMLElement>('#app')
if (app) {
  app.innerHTML = `
    <h1>🁫 Dominotron — suco</h1>
    <p class="hint">mods ativos: ${activeMods.map((m) => m.name).join(' · ')}</p>
    <div id="suco"></div>
    <button id="play">nova jogada</button>
  `
  // ?instant zera o atraso (util para verificacao/screenshot); default anima.
  const instant = new URLSearchParams(location.search).has('instant')
  const presenter = new DomPresenter(document.querySelector('#suco')!, {
    stepDelayMs: instant ? 0 : 380,
    shakeTarget: document.body,
  })
  let seed = 1
  const go = async (): Promise<void> => {
    const { trace } = generateTrace(seed++)
    await presenter.present(trace)
  }
  document.querySelector('#play')?.addEventListener('click', () => void go())
  void go()
}

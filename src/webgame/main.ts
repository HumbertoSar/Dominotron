// Entry da aplicacao jogavel (M7.2). Monta a GameUI sobre um GameController.
// ?seed=N escolhe a seed (default 1).

import { GameController } from './controller'
import { GameUI } from './view'

const root = document.querySelector<HTMLElement>('#app')
if (root) {
  const seedParam = new URLSearchParams(location.search).get('seed')
  const seed = seedParam ? Number(seedParam) || 1 : 1
  const ui = new GameUI(root, new GameController(seed))
  ui.mount()
}

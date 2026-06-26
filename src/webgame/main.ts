// Entry da aplicacao jogavel (M7.2). Monta a GameUI sobre um GameController.
// ?seed=N escolhe a seed (default 1).

import { GameController } from './controller'
import { GameUI } from './view'

const root = document.querySelector<HTMLElement>('#app')
if (root) {
  const params = new URLSearchParams(location.search)
  const seedParam = params.get('seed')
  const seed = seedParam ? Number(seedParam) || 1 : 1
  const ui = new GameUI(root, new GameController(seed))
  ui.mount()

  // ?demo: fecha o tutorial e auto-joga algumas pecas (para "ver a cobra crescer").
  if (params.has('demo')) {
    root.querySelector<HTMLElement>('[data-action="close-tutorial"]')?.click()
    let n = 0
    const step = (): void => {
      if (n++ > 11) return
      const chooser = root.querySelector<HTMLElement>('[data-action="play"]')
      if (chooser) {
        chooser.click()
        setTimeout(step, 80)
        return
      }
      const tile = root.querySelector<HTMLElement>('.hand-dom.playable')
      if (tile) {
        tile.click()
        setTimeout(step, 120)
      }
    }
    step()
  }
}

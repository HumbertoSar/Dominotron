// @vitest-environment jsdom
//
// Testa a GameUI num DOM real (jsdom): clicar uma peca joga e atualiza a tela. Prova
// que a UI esta de fato ligada ao controller — a interatividade que faltava (M7).

import { describe, expect, it } from 'vitest'
import { GameController } from './controller'
import { GameUI } from './view'

function mountGame(seed = 7): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  new GameUI(root, new GameController(seed)).mount()
  return root
}

describe('GameUI (jsdom)', () => {
  it('renderiza a mao com 7 pecas clicaveis', () => {
    const root = mountGame()
    expect(root.querySelectorAll('.tile')).toHaveLength(7)
    // cobra vazia -> todas jogaveis
    expect(root.querySelectorAll('.tile.playable').length).toBe(7)
  })

  it('clicar numa peca a joga: a cobra cresce e o placar sobe', () => {
    const root = mountGame()
    const score = () => Number(root.querySelector('.score')?.textContent?.trim().split('/')[0])
    expect(score()).toBe(0)

    root.querySelector<HTMLElement>('.tile')!.click()

    expect(root.querySelector('.chain')).toBeTruthy() // a cobra apareceu
    expect(score()).toBeGreaterThan(0) // pontuou
  })

  it('jogar mostra o suco (Trace) — a revelacao sequencial comeca na hora', () => {
    const root = mountGame()
    root.querySelector<HTMLElement>('.tile')!.click()
    // o suco anima (1 passo por vez); ao menos o primeiro aparece sincronamente.
    expect(root.querySelectorAll('.suco-area .suco-step').length).toBeGreaterThan(0)
  })

  it('jogar a blind ate o fim leva a loja ou ao fim, com botoes', () => {
    const root = mountGame()
    let guard = 0
    while (guard++ < 400) {
      // peca em 2 pontas abre o seletor: clique a ponta se ela aparecer
      const chooser = root.querySelector<HTMLElement>('[data-action="play"]')
      if (chooser) {
        chooser.click()
        continue
      }
      const tile = root.querySelector<HTMLElement>('.tile.playable')
      if (!tile) break
      tile.click()
    }
    // ou abriu a loja (proxima blind) ou acabou a run (nova run)
    const hasShop = !!root.querySelector('[data-action="leave-shop"]')
    const hasEnd = !!root.querySelector('[data-action="new-run"]')
    expect(hasShop || hasEnd).toBe(true)
  })
})

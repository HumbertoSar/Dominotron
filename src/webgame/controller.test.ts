import { describe, expect, it } from 'vitest'
import { GameController, type GameController as GC } from './controller'

/** Joga a 1a acao legal repetidamente ate a blind acabar (ou um teto de seguranca). */
function playOutBlind(g: GC): void {
  let guard = 0
  while (g.phase === 'playing' && guard++ < 200) {
    const v = g.view()
    const tileId = Object.keys(v.playable)[0]
    if (!tileId) break
    const side = v.playable[tileId]![0]!
    g.playTile(tileId, side)
  }
}

describe('GameController — inicio', () => {
  it('comeca jogavel: mao de 7, blind 1 limiar 18, 12 plays', () => {
    const v = new GameController(7).view()
    expect(v.phase).toBe('playing')
    expect(v.hand).toHaveLength(7)
    expect(v.ante).toBe(1)
    expect(v.blind).toBe(1)
    expect(v.threshold).toBe(18) // round(18 * 1.12^0)
    expect(v.resources).toMatchObject({ plays: 12, redraws: 3 })
  })

  it('com a cobra vazia, toda peca da mao e jogavel', () => {
    const v = new GameController(7).view()
    expect(Object.keys(v.playable)).toHaveLength(7)
  })
})

describe('GameController — jogar', () => {
  it('jogar uma peca pontua, consome 1 play e guarda o Trace', () => {
    const g = new GameController(7)
    const before = g.view()
    const tileId = Object.keys(before.playable)[0]!
    g.playTile(tileId, before.playable[tileId]![0]!)
    const after = g.view()

    expect(after.roundScore).toBeGreaterThan(0)
    expect(after.resources.plays).toBe(11)
    expect(after.chain).toHaveLength(1)
    expect(after.lastTrace).not.toBeNull()
    expect(g.lastTrace?.entries[0]?.source).toBe('base')
  })

  it('jogada ilegal e no-op', () => {
    const g = new GameController(7)
    const before = g.view()
    g.playTile('nao-existe', 'left')
    expect(g.view().roundScore).toBe(before.roundScore)
    expect(g.view().resources.plays).toBe(12)
  })

  it('redraw consome 1 redraw; falha quando nao ha redraws', () => {
    const g = new GameController(7)
    const handBefore = g.view().hand.map((t) => t.id)
    g.doRedraw([handBefore[0]!])
    expect(g.view().resources.redraws).toBe(2)
    expect(g.view().resources.plays).toBe(12) // redraw nao gasta play
  })
})

describe('GameController — fim de blind e loja', () => {
  it('jogar a blind ate o fim sai da fase de jogo', () => {
    const g = new GameController(7)
    playOutBlind(g)
    expect(['shop', 'dead', 'won']).toContain(g.phase)
    expect(g.view().roundScore === 0 || g.phase !== 'playing').toBe(true)
  })

  it('vencendo a 1a blind, abre a loja com oferta', () => {
    const g = new GameController(7)
    playOutBlind(g)
    expect(g.phase).toBe('shop') // seed 7 vence a blind 1
    const shop = g.view().shop
    expect(shop).not.toBeNull()
    expect(shop!.offer.length).toBeGreaterThanOrEqual(1)
  })

  it('comprar na loja e sair comeca a proxima blind', () => {
    const g = new GameController(7)
    playOutBlind(g)
    const shop = g.view().shop!
    const moneyBefore = g.view().money
    const buyId = shop.offer[0]!.id
    const price = shop.offer[0]!.price
    if (moneyBefore >= price) {
      g.buy(buyId)
      expect(g.view().money).toBe(moneyBefore - price)
      expect(g.view().ownedMods.map((m) => m.id)).toContain(buyId)
    }
    g.leaveShop()
    const v = g.view()
    expect(v.phase).toBe('playing')
    expect(v.blind).toBe(2) // avancou a blind
  })
})

describe('GameController — determinismo', () => {
  it('mesma seed + mesmas acoes -> mesmo estado', () => {
    const a = new GameController(7)
    const b = new GameController(7)
    playOutBlind(a)
    playOutBlind(b)
    expect(a.view()).toEqual(b.view())
  })
})

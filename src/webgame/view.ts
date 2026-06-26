// GameUI — a camada DOM sobre o GameController. Renderiza o snapshot view() e liga os
// cliques aos metodos do controller. Re-renderiza a cada acao (modelo reativo simples).
//
// O suco (DomPresenter) vive num container PERSISTENTE fora do re-render, para animar
// apenas quando o Trace muda. Toda a logica de jogo esta no controller; aqui e so view.

import type { Trace } from '../engine/index'
import { DomPresenter } from '../presenter/dom'
import type { Tile } from '../boards/domino/tiles'
import { GameController, type GameView, type Side } from './controller'

function tilePips(t: Tile): number {
  return t.low + t.high
}

// Posicoes dos pinos num grid 3x3 (1..9), no padrao de dominó.
const PIP_LAYOUT: Record<number, number[]> = {
  0: [],
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
}

/** Uma metade da peca, com os pinos (bolinhas) na cara. */
function face(value: number): string {
  const on = new Set(PIP_LAYOUT[value] ?? [])
  let cells = ''
  for (let i = 1; i <= 9; i++) cells += `<i class="pip${on.has(i) ? ' on' : ''}"></i>`
  return `<span class="face">${cells}</span>`
}

/** Peca da mao: dominó VERTICAL com pinos, clicavel. */
function handTileHtml(t: Tile, opts: { playable: boolean; selected: boolean }): string {
  const cls = ['dom', 'hand-dom']
  cls.push(opts.playable ? 'playable' : 'dim')
  if (opts.selected) cls.push('selected')
  return `<button class="${cls.join(' ')}" data-action="tile" data-tile="${t.id}" title="${tilePips(t)} pontos">
    ${face(t.low)}<span class="dom-bar"></span>${face(t.high)}
  </button>`
}

/** Peca na cobra: dominó HORIZONTAL; dupla fica ATRAVESSADA (perpendicular). */
function snakeTileHtml(t: Tile): string {
  const cls = ['dom', 'snake-dom']
  if (t.low === t.high) cls.push('double')
  return `<span class="${cls.join(' ')}">${face(t.low)}<span class="dom-bar"></span>${face(t.high)}</span>`
}

/** A cobra em ZIGUE-ZAGUE (boustrophedon): linhas alternam de direcao, como na mesa. */
function chainHtml(v: GameView): string {
  if (v.chain.length === 0) {
    return `<div class="snake empty">cobra vazia — jogue qualquer peca para abrir</div>`
  }
  const perRow = 7
  const rows: string[] = []
  for (let i = 0; i < v.chain.length; i += perRow) {
    const slice = v.chain.slice(i, i + perRow)
    const tiles = slice.map(snakeTileHtml).join('<span class="connector"></span>')
    const reversed = (i / perRow) % 2 === 1
    rows.push(`<div class="snake-row${reversed ? ' rev' : ''}">${tiles}</div>`)
  }
  const left = v.ends ? v.ends[0] : '?'
  const right = v.ends ? v.ends[1] : '?'
  return `<div class="snake-board">
    <span class="end-label">ponta ⟨ <b>${left}</b></span>
    <div class="snake-rows">${rows.join('')}</div>
    <span class="end-label"><b>${right}</b> ⟩ ponta</span>
  </div>`
}

function modChip(m: { id: string; name: string; description?: string }, action?: string, label?: string): string {
  const btn = action ? ` <button class="mini" data-action="${action}" data-id="${m.id}">${label}</button>` : ''
  return `<span class="mod-chip" title="${m.description ?? ''}">${m.name}${btn}</span>`
}

export class GameUI {
  private readonly root: HTMLElement
  private controller: GameController
  private suco: DomPresenter
  private sucoArea!: HTMLElement
  private gameArea!: HTMLElement
  private lastPresented: Trace | null = null

  // estado de interacao (UI-only)
  private pendingTile: string | null = null
  private discardMode = false
  private discardSel = new Set<string>()
  private showTutorial = true

  constructor(root: HTMLElement, controller: GameController) {
    this.root = root
    this.controller = controller
    // criado depois que sucoArea existir; placeholder ate mount()
    this.suco = new DomPresenter(document.createElement('div'))
  }

  mount(): void {
    this.root.innerHTML = `
      <div class="shell">
        <div class="topbar">
          <h1>🁫 Dominotron</h1>
          <button class="help" data-action="help">? como jogar</button>
        </div>
        <div id="suco-area" class="suco-area"></div>
        <div id="game-area"></div>
      </div>`
    this.sucoArea = this.root.querySelector('#suco-area')!
    this.gameArea = this.root.querySelector('#game-area')!
    const shell = this.root.querySelector<HTMLElement>('.shell') ?? this.root
    this.suco = new DomPresenter(this.sucoArea, { stepDelayMs: 260, shakeTarget: shell })
    this.root.addEventListener('click', (e) => this.onClick(e))
    this.render()
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  private render(): void {
    const v = this.controller.view()
    this.gameArea.innerHTML =
      this.statusHtml(v) +
      chainHtml(v) +
      (v.phase === 'playing' ? this.playingHtml(v) : '') +
      (v.phase === 'shop' ? this.shopHtml(v) : '') +
      (v.phase === 'won' || v.phase === 'dead' ? this.endHtml(v) : '') +
      (this.showTutorial ? this.tutorialHtml() : '')
    this.presentSuco(v.lastTrace)
  }

  private presentSuco(trace: Trace | null): void {
    if (!trace || trace === this.lastPresented) return
    this.lastPresented = trace
    void this.suco.present(trace)
  }

  private statusHtml(v: GameView): string {
    const res = Object.entries(v.resources)
      .map(([k, n]) => `${k} ${n}`)
      .join(' · ')
    const mods = v.activeMods.length
      ? v.activeMods.map((m) => `<span class="mod-chip on" title="${m.description}">${m.name}</span>`).join(' ')
      : '<span class="muted">nenhum mod ativo</span>'
    const pct = Math.min(100, Math.round((v.roundScore / Math.max(1, v.threshold)) * 100))
    return `<div class="status">
      <div class="row">
        <span class="badge">Ante ${v.ante} · blind ${v.blind} (${v.blindType})</span>
        <span class="money">$${v.money}</span>
        <span class="muted">${res}</span>
      </div>
      <div class="score">${v.roundScore} / ${v.threshold}
        <div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="mods">${mods} <span class="muted">(${v.activeMods.length}/${v.slots} slots)</span></div>
      ${v.message ? `<div class="msg">${v.message}</div>` : ''}
    </div>`
  }

  private playingHtml(v: GameView): string {
    const tiles = v.hand
      .map((t) => {
        const playable = (v.playable[t.id]?.length ?? 0) > 0
        const selected = this.discardMode ? this.discardSel.has(t.id) : this.pendingTile === t.id
        return handTileHtml(t, { playable: this.discardMode ? true : playable, selected })
      })
      .join('')

    let sideChooser = ''
    if (this.pendingTile && !this.discardMode) {
      const sides = v.playable[this.pendingTile] ?? []
      if (sides.length > 1) {
        sideChooser = `<div class="side-choose">Jogar a peca em qual ponta?
          <button data-action="play" data-tile="${this.pendingTile}" data-side="left">⟨ esquerda</button>
          <button data-action="play" data-tile="${this.pendingTile}" data-side="right">direita ⟩</button>
          <button data-action="cancel">cancelar</button>
        </div>`
      }
    }

    const redrawBtn =
      this.controller.canRedraw() && !this.discardMode
        ? `<button class="ctrl" data-action="redraw-start">trocar pecas (${v.resources.redraws ?? 0})</button>`
        : ''
    const discardBar = this.discardMode
      ? `<div class="discard-bar">selecione as pecas a trocar:
          <button data-action="redraw-confirm">confirmar (${this.discardSel.size})</button>
          <button data-action="redraw-cancel">cancelar</button>
        </div>`
      : ''

    const hint = this.discardMode
      ? 'clique nas pecas para marcar a troca'
      : 'clique numa peca acesa para joga-la'

    return `<div class="play">
      ${sideChooser}
      ${discardBar}
      <div class="hand">${tiles}</div>
      <div class="controls"><span class="muted">${hint}</span> ${redrawBtn}</div>
    </div>`
  }

  private shopHtml(v: GameView): string {
    const shop = v.shop!
    const items = shop.offer
      .map(
        (m) => `<div class="shop-item">
          <div><b>${m.name}</b> <span class="muted">(${m.rarity})</span></div>
          <div class="desc">${m.description}</div>
          <button data-action="buy" data-id="${m.id}">comprar $${m.price}</button>
        </div>`,
      )
      .join('')
    const owned = v.ownedMods.length
      ? v.ownedMods
          .map((m) => {
            const isActive = v.activeMods.some((a) => a.id === m.id)
            const toggle = isActive
              ? modChip(m, 'deactivate', 'desativar')
              : modChip(m, 'activate', 'ativar')
            return `<span class="own">${toggle} <button class="mini" data-action="sell" data-id="${m.id}">vender</button></span>`
          })
          .join(' ')
      : '<span class="muted">nada ainda</span>'

    return `<div class="shop">
      <h2>LOJA — $${v.money}</h2>
      <div class="shop-items">${items}</div>
      <div class="owned"><b>colecao:</b> ${owned}</div>
      <div class="controls">
        <button data-action="reroll">reroll $${shop.rerollCost}</button>
        <button class="primary" data-action="leave-shop">proxima blind ▶</button>
      </div>
    </div>`
  }

  private tutorialHtml(): string {
    return `<div class="tutorial">
      <div class="tut-card">
        <h2>Como jogar 🁫</h2>
        <ol>
          <li><b>Objetivo:</b> some pontos ate bater o <b>limiar</b> (o "X / alvo") antes que suas <b>jogadas</b> acabem.</li>
          <li><b>Jogar:</b> clique numa peca <span class="g">verde</span> da sua mao para encosta-la numa ponta da cobra. Se ela casar nas duas pontas, voce escolhe qual.</li>
          <li><b>Pontuacao:</b> cada jogada vale <b>fichas x multiplicador</b>. O "suco" colorido mostra de onde veio cada ponto (azul = fichas, vermelho = mult, dourado = total).</li>
          <li><b>Modificadores:</b> entre as rodadas, a <b>loja</b> vende modificadores que turbinam a pontuacao. Cada um tem a descricao do que faz — combine-os!</li>
          <li><b>Trocar pecas:</b> o botao "trocar pecas" gasta um <b>redraw</b> para descartar e comprar outras.</li>
          <li><b>Permadeath:</b> nao bateu o limiar = fim da run. Comece outra com nova seed.</li>
        </ol>
        <button class="primary" data-action="close-tutorial">comecar a jogar ▶</button>
      </div>
    </div>`
  }

  private endHtml(v: GameView): string {
    const win = v.phase === 'won'
    return `<div class="overlay ${win ? 'win' : 'lose'}">
      <div class="big">${win ? '🏆 VITORIA' : '💀 FIM DA RUN'}</div>
      <div>${v.message}</div>
      <button class="primary" data-action="new-run">nova run</button>
    </div>`
  }

  // -------------------------------------------------------------------------
  // Eventos
  // -------------------------------------------------------------------------

  private onClick(e: Event): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!target) return
    const action = target.dataset.action
    const tile = target.dataset.tile
    const id = target.dataset.id
    const side = target.dataset.side as Side | undefined

    switch (action) {
      case 'tile':
        this.onTileClick(tile!)
        break
      case 'play':
        if (tile && side) {
          this.controller.playTile(tile, side)
          this.pendingTile = null
        }
        break
      case 'cancel':
        this.pendingTile = null
        break
      case 'redraw-start':
        this.discardMode = true
        this.discardSel.clear()
        break
      case 'redraw-confirm':
        this.controller.doRedraw([...this.discardSel])
        this.discardMode = false
        this.discardSel.clear()
        break
      case 'redraw-cancel':
        this.discardMode = false
        this.discardSel.clear()
        break
      case 'buy':
        if (id) this.controller.buy(id)
        break
      case 'sell':
        if (id) this.controller.sell(id)
        break
      case 'activate':
        if (id) this.controller.activate(id)
        break
      case 'deactivate':
        if (id) this.controller.deactivate(id)
        break
      case 'reroll':
        this.controller.reroll()
        break
      case 'leave-shop':
        this.controller.leaveShop()
        break
      case 'new-run':
        this.controller = new GameController(this.controller.view().seed + 1)
        this.pendingTile = null
        this.lastPresented = null
        break
      case 'help':
        this.showTutorial = true
        break
      case 'close-tutorial':
        this.showTutorial = false
        break
    }
    this.render()
  }

  private onTileClick(tileId: string): void {
    if (this.discardMode) {
      if (this.discardSel.has(tileId)) this.discardSel.delete(tileId)
      else this.discardSel.add(tileId)
      return
    }
    const sides = this.controller.legalSidesFor(tileId)
    if (sides.length === 0) return
    if (sides.length === 1) {
      this.controller.playTile(tileId, sides[0]!)
      this.pendingTile = null
    } else {
      this.pendingTile = tileId // o chooser de ponta aparece no render
    }
  }
}

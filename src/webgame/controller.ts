// GameController — a maquina de estados de uma run JOGAVEL, dirigida por eventos.
//
// O terminal (M5) joga via "pergunta-resposta" (ask). Uma UI web joga via cliques: o
// usuario chama metodos (playTile, buy, ...) e le um snapshot (view()) para renderizar.
// Este controller orquestra board + Resolver + economia + loja + eventos — puro, sem DOM,
// 100% testavel no Node. A UI (M7.2) e so uma camada fina por cima.

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
  deactivateModifier,
  generateShopOffer,
  hashSeed,
  initialRoundMemory,
  makeRng,
  modifierById,
  rerollShop,
  resolve,
  resolveEvent,
  runStateView,
  sellModifier,
  settleBlind,
  type BlindType,
  type Modifier,
  type Rng,
  type RoundMemory,
  type RunConfig,
  type RunState,
  type ShopOffer,
  type Trace,
} from '../engine/index'
import { defaultDominoConfig } from '../boards/domino/config'
import {
  applyAction,
  dominoBoard,
  legalActionsFor,
  redraw,
  type DominoState,
} from '../boards/domino/board'
import type { Tile } from '../boards/domino/tiles'

export type Phase = 'playing' | 'shop' | 'won' | 'dead'
export type Side = 'left' | 'right'

export interface ModView {
  id: string
  name: string
  description: string
  rarity: string
  price: number
}

/** Snapshot read-only para a UI renderizar. Serializavel; nenhuma referencia interna viva. */
export interface GameView {
  phase: Phase
  message: string
  seed: number
  ante: number
  blind: number
  blindType: BlindType
  threshold: number
  roundScore: number
  money: number
  resources: Record<string, number>
  slots: number
  hand: Tile[]
  chain: Tile[]
  ends: [number, number] | null
  /** Por tileId da mao: em quais pontas ele e jogavel agora. */
  playable: Record<string, Side[]>
  activeMods: ModView[]
  ownedMods: ModView[]
  lastTrace: Trace | null
  /** Oferta da loja (so quando phase === 'shop'). */
  shop: { offer: ModView[]; rerollCost: number } | null
}

export class GameController {
  private readonly config: RunConfig
  private readonly seed: number
  private run: RunState
  private board!: DominoState
  private memory!: RoundMemory
  private rng!: Rng
  private offer: ShopOffer | null = null
  private _lastTrace: Trace | null = null
  private _phase: Phase = 'playing'
  private _message = ''

  constructor(seed: number, config: RunConfig = defaultDominoConfig()) {
    this.config = config
    this.seed = seed
    this.run = createRun(config, seed)
    this.startBlind()
  }

  // -------------------------------------------------------------------------
  // Helpers internos
  // -------------------------------------------------------------------------

  private active(): Modifier[] {
    return this.run.activeModifierIds
      .map((id) => modifierById(this.config, id))
      .filter((m): m is Modifier => m !== undefined)
  }

  private modView(id: string): ModView {
    const m = modifierById(this.config, id)
    return {
      id,
      name: m?.name ?? id,
      description: m?.description ?? '',
      rarity: m?.rarity ?? 'common',
      price: m ? this.config.economy.prices[m.rarity] : 0,
    }
  }

  private startBlind(): void {
    const blindSeed = hashSeed(this.seed, this.run.blindIndex)
    this.board = dominoBoard.init(blindSeed, { resources: this.config.resources })
    this.rng = makeRng(blindSeed)
    this.memory = initialRoundMemory()
    this.run = applyDeltas(this.run, resolveEvent('round_start', this.active(), runStateView(this.config, this.run)))
    this._phase = 'playing'
    this._message = ''
    this._lastTrace = null
  }

  private blindOver(): boolean {
    return (this.run.resources.plays ?? 0) <= 0 || dominoBoard.isRoundOver(this.board)
  }

  private checkBlindEnd(): void {
    if (this._phase !== 'playing' || !this.blindOver()) return

    if (this.board.hand.length > 0 && dominoBoard.isRoundOver(this.board)) {
      this.run = applyDeltas(this.run, resolveEvent('lock', this.active(), runStateView(this.config, this.run)))
    }
    this.run = applyDeltas(this.run, resolveEvent('round_end', this.active(), runStateView(this.config, this.run)))

    const threshold = currentThreshold(this.config, this.run)
    const score = this.run.roundScore
    const settled = settleBlind(this.config, this.run)
    this.run = settled.state

    if (!settled.won) {
      this._phase = 'dead'
      this._message = `Derrota: ${score} < ${threshold}. Fim da run.`
      return
    }
    if (this.run.status === 'won') {
      this._phase = 'won'
      this._message = 'Run completa — voce venceu!'
      return
    }
    this._message = `Blind vencida: ${score} >= ${threshold}  (+$${settled.reward})`
    this.offer = generateShopOffer(this.config, hashSeed(this.seed, 9000 + this.run.blindIndex))
    this._phase = 'shop'
  }

  // -------------------------------------------------------------------------
  // Acoes — jogar
  // -------------------------------------------------------------------------

  /** Em quais pontas a peca da mao e jogavel agora. */
  legalSidesFor(tileId: string): Side[] {
    return legalActionsFor(this.board)
      .filter((a) => a.tileId === tileId)
      .map((a) => a.side)
  }

  /** Joga uma peca da mao numa ponta. No-op se ilegal ou fora da fase de jogo. */
  playTile(tileId: string, side: Side): void {
    if (this._phase !== 'playing') return
    const legal = legalActionsFor(this.board).some((a) => a.tileId === tileId && a.side === side)
    if (!legal) return

    const { state, context } = applyAction(this.board, { kind: 'play', tileId, side })
    this.board = state

    const { trace, deltas } = resolve(context, this.active(), runStateView(this.config, this.run), this.rng, this.memory)
    this._lastTrace = trace
    this.run = addRoundScore(this.run, trace.finalScore)
    this.run = applyDeltas(this.run, deltas)
    this.run = applyDeltas(this.run, { resources: { plays: -(context.consumes.plays ?? 0) } })
    this.memory = advanceRoundMemory(this.memory, context)

    this.checkBlindEnd()
  }

  canRedraw(): boolean {
    return this._phase === 'playing' && (this.run.resources.redraws ?? 0) > 0
  }

  /** Descarta e repoe as pecas dadas (custa 1 redraw). */
  doRedraw(tileIds: string[]): void {
    if (!this.canRedraw() || tileIds.length === 0) return
    this.board = redraw(this.board, tileIds)
    this.run = applyDeltas(this.run, { resources: { redraws: -1 } })
    this.checkBlindEnd()
  }

  // -------------------------------------------------------------------------
  // Acoes — loja
  // -------------------------------------------------------------------------

  /** Compra um modificador da oferta; ativa automaticamente se houver slot livre. */
  buy(id: string): void {
    if (this._phase !== 'shop') return
    const bought = buyModifier(this.config, this.run, id)
    if (!bought.ok) return
    this.run = bought.state
    if (this.run.activeModifierIds.length < this.config.slots) {
      const act = activateModifier(this.config, this.run, id)
      if (act.ok) this.run = act.state
    }
  }

  sell(id: string): void {
    if (this._phase !== 'shop') return
    const r = sellModifier(this.config, this.run, id)
    if (r.ok) this.run = r.state
  }

  activate(id: string): void {
    const r = activateModifier(this.config, this.run, id)
    if (r.ok) this.run = r.state
  }

  deactivate(id: string): void {
    const r = deactivateModifier(this.run, id)
    if (r.ok) this.run = r.state
  }

  reroll(): void {
    if (this._phase !== 'shop' || this.offer === null) return
    const seed = hashSeed(this.seed, this.run.blindIndex * 31 + this.run.money)
    const rolled = rerollShop(this.config, this.run, this.offer, seed)
    if (rolled.ok) {
      this.run = rolled.state
      this.offer = rolled.offer
    }
  }

  /** Sai da loja e comeca a proxima blind. */
  leaveShop(): void {
    if (this._phase !== 'shop') return
    this.offer = null
    this.startBlind()
  }

  // -------------------------------------------------------------------------
  // Snapshot
  // -------------------------------------------------------------------------

  get phase(): Phase {
    return this._phase
  }

  get lastTrace(): Trace | null {
    return this._lastTrace
  }

  view(): GameView {
    const { ante, blind } = anteBlindOf(this.config.thresholdCurve, this.run.blindIndex)
    const playable: Record<string, Side[]> = {}
    for (const a of legalActionsFor(this.board)) {
      ;(playable[a.tileId] ??= []).push(a.side)
    }

    return {
      phase: this._phase,
      message: this._message,
      seed: this.seed,
      ante,
      blind,
      blindType: blindTypeFor(this.config.thresholdCurve, this.run.blindIndex),
      threshold: currentThreshold(this.config, this.run),
      roundScore: this.run.roundScore,
      money: this.run.money,
      resources: { ...this.run.resources },
      slots: this.config.slots,
      hand: [...this.board.hand],
      chain: [...this.board.chain],
      ends: this.board.ends ? [this.board.ends[0], this.board.ends[1]] : null,
      playable,
      activeMods: this.run.activeModifierIds.map((id) => this.modView(id)),
      ownedMods: this.run.ownedModifierIds.map((id) => this.modView(id)),
      lastTrace: this._lastTrace,
      shop:
        this._phase === 'shop' && this.offer
          ? { offer: this.offer.modifierIds.map((id) => this.modView(id)), rerollCost: this.offer.rerollCost }
          : null,
    }
  }
}

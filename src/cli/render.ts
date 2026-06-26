// Renderizadores de TEXTO PURO para a CLI (M5). Sem cores nem animacao — isso e o
// suco (M6). Aqui o objetivo e sentir as DECISOES e ver, no Trace textual, de onde veio
// cada ponto (prova de que a fonte de verdade do suco ja existe).

import type { Modifier, RunConfig, Trace } from '../engine/index'
import type { ShopOffer } from '../engine/index'
import { modifierById } from '../engine/index'
import type { DominoState } from '../boards/domino/board'
import type { Tile } from '../boards/domino/tiles'

export function renderTile(t: Tile): string {
  return `[${t.low}|${t.high}]`
}

export function renderHand(hand: Tile[]): string {
  return hand.map((t, i) => `${i + 1}:${renderTile(t)}`).join('  ')
}

export function renderEnds(state: DominoState): string {
  if (state.ends === null) return '(cobra vazia — qualquer peca abre)'
  return `pontas: <${state.ends[0]}  ...  ${state.ends[1]}>  (cobra: ${state.chain.length} pecas)`
}

/** Cabecalho do estado: onde estou, quanto falta, o que tenho. */
export function renderStatus(opts: {
  ante: number
  blind: number
  blindType: string
  threshold: number
  roundScore: number
  money: number
  resources: Record<string, number>
  activeNames: string[]
}): string {
  const res = Object.entries(opts.resources)
    .map(([k, v]) => `${k} ${v}`)
    .join(' | ')
  const mods = opts.activeNames.length ? opts.activeNames.join(', ') : '(nenhum)'
  return [
    `── Ante ${opts.ante} · blind ${opts.blind} (${opts.blindType}) ──`,
    `alvo: ${opts.roundScore}/${opts.threshold}    $${opts.money}    ${res}`,
    `mods: ${mods}`,
  ].join('\n')
}

/** Como cada op aparece no Trace textual. */
function opLabel(op: string, args: number[]): string {
  const a = args.join(',')
  switch (op) {
    case 'add_base':
      return `+${a} base`
    case 'add_mult':
      return `+${a} mult`
    case 'mul_mult':
      return `x${a} mult`
    case 'mul_mult_pow':
      return `x(${a}^duplas) mult`
    case 'add_base_tag':
      return `+base (valor de tag)`
    case 'add_mult_tag':
      return `+mult (valor de tag)`
    case 'add_base_per':
      return `+${a} base por match`
    case 'add_mult_per':
      return `+${a} mult por match`
    case 'add_mult_run':
      return `+mult por $`
    case 'add_money':
      return `+${a} $`
    case 'add_resource':
      return `+${a} recurso`
    case 'add_money_per_resource':
      return `+$ por recurso`
    default:
      return `${op}(${a})`
  }
}

/** O Trace como texto: cada linha mostra a origem e o acumulador resultante. */
export function renderTrace(trace: Trace): string {
  const lines = trace.entries.map((e) => {
    const src = e.source === 'base' ? 'BASE' : e.source
    const acc = `[chips ${e.accAfter.chips} x mult ${round(e.accAfter.mult)}]`
    return `  ${src.padEnd(16)} ${opLabel(e.op, e.args).padEnd(22)} ${acc}`
  })
  lines.push(`  = ${trace.finalScore} pontos`)
  return lines.join('\n')
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** A oferta da loja. */
export function renderShop(offer: ShopOffer, config: RunConfig, money: number): string {
  const items = offer.modifierIds.map((id, i) => {
    const mod = modifierById(config, id) as Modifier
    const price = config.economy.prices[mod.rarity]
    return `  ${i + 1}: ${mod.name} (${mod.rarity}) — $${price}`
  })
  return [
    `=== LOJA ===  (voce tem $${money})`,
    ...items,
    `  reroll: $${offer.rerollCost}    (digite o numero p/ comprar, 'r' reroll, enter p/ sair)`,
  ].join('\n')
}

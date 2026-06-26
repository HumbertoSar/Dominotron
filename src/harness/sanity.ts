// Testes de sanidade (SANITY_TESTS.md) — provam que um config NAO esta quebrado,
// nunca que e divertido (Lei 12). Esta e a leva barata/decisiva: T9, T5, T3, T2, T8.
// T4/T6/T7 (que dependem do synergy-climber) chegam na Parte 2.

import {
  resolve,
  thresholdFor,
  totalBlinds,
  validateVocabulary,
  type BoardQuery,
  type Modifier,
  type RunConfig,
  type RunStateView,
  type ScoringContext,
  type TagSpec,
} from '../engine/index'
import { dominoBoard } from '../boards/domino/board'
import { buildCost, climbBuild } from './climber'
import { cleanStrategy, simulateRun, synergyStrategy } from './simulate'

export type Verdict = 'green' | 'yellow' | 'red'

export interface SanityResult {
  id: string
  name: string
  verdict: Verdict
  detail: string
}

// ---------------------------------------------------------------------------
// Helpers estatisticos
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx] as number
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return percentile(sorted, 50)
}

function seeds(n: number): number[] {
  return Array.from({ length: n }, (_, i) => 1000 + i * 7)
}

// ---------------------------------------------------------------------------
// T9 — determinismo
// ---------------------------------------------------------------------------

export function testT9Determinism(config: RunConfig): SanityResult {
  let identical = true
  for (const seed of seeds(20)) {
    const a = simulateRun(config, seed, cleanStrategy)
    const b = simulateRun(config, seed, cleanStrategy)
    if (JSON.stringify(a) !== JSON.stringify(b)) identical = false
  }
  return {
    id: 'T9',
    name: 'determinismo',
    verdict: identical ? 'green' : 'red',
    detail: identical ? 'mesma seed -> mesma run' : 'NAO-determinismo detectado',
  }
}

// ---------------------------------------------------------------------------
// T5 — densidade de sinergia + vocabulario
// ---------------------------------------------------------------------------

/** Um modificador e sinergico se referencia tags/snapshot/memoria/run/evento/regra,
 *  e nao apenas um bonus chapado (`always` + add_base/add_mult/mul_mult constantes). */
export function isSynergistic(mod: Modifier): boolean {
  if (mod.trigger.kind !== 'always') return true
  if (mod.hooks?.length || mod.rule) return true
  return mod.effects.some(
    (e) =>
      e.query !== undefined ||
      e.tag !== undefined ||
      e.memoryField !== undefined ||
      e.runField !== undefined,
  )
}

export function testT5Synergy(vocabulary: TagSpec[], modifiers: Modifier[]): SanityResult {
  const vocab = validateVocabulary(vocabulary, modifiers)
  const synCount = modifiers.filter(isSynergistic).length
  const ratio = synCount / modifiers.length
  const ratioOk = ratio >= 1 / 3

  let verdict: Verdict = 'green'
  if (!vocab.ok) verdict = 'red'
  else if (!ratioOk) verdict = 'yellow'

  const vocabNote = vocab.ok
    ? 'vocabulario sem orfaos'
    : `vocab quebrado (orfas: ${vocab.orphanTags.join(',') || '-'}; refs: ${vocab.undeclaredRefs.join(',') || '-'})`
  return {
    id: 'T5',
    name: 'sinergia',
    verdict,
    detail: `${Math.round(ratio * 100)}% sinergicos; ${vocabNote}`,
  }
}

// ---------------------------------------------------------------------------
// T3 — "jogar limpo falha" (o teste mais importante)
// ---------------------------------------------------------------------------

export function testT3CleanDeath(config: RunConfig, n: number): SanityResult {
  const progresses = seeds(n).map((s) => simulateRun(config, s, cleanStrategy).progress)
  const med = median(progresses)

  let verdict: Verdict = 'red'
  if (med >= 0.25 && med <= 0.45) verdict = 'green'
  else if (med >= 0.15 && med <= 0.55) verdict = 'yellow'

  return {
    id: 'T3',
    name: 'morte limpa',
    verdict,
    detail: `morre em ${Math.round(med * 100)}% da run (alvo 25-45%)`,
  }
}

// ---------------------------------------------------------------------------
// T2 — motor multiplicativo, nao aditivo
// ---------------------------------------------------------------------------

/** Torna um pool ADITIVO: troca toda op multiplicativa por uma soma de mult equivalente. */
function additivize(modifiers: Modifier[]): Modifier[] {
  return modifiers.map((m) => ({
    ...m,
    effects: m.effects.map((e) =>
      e.op === 'mul_mult' || e.op === 'mul_mult_pow' ? { op: 'add_mult' as const, args: [4] } : e,
    ),
  }))
}

/**
 * T2 mede se o motor e MULTIPLICATIVO comparando o TETO de uma build com o pool real
 * contra o TETO com o mesmo pool "aditivado". Um motor multiplicativo gera teto bem
 * maior (cauda pesada); um aditivo, teto proporcional. A versao p95/p50 sobre aquisicao
 * aleatoria nao discriminava (ambos davam ~2.3x) — esta versao discrimina.
 */
export function testT2Multiplicative(config: RunConfig): SanityResult {
  const total = totalBlinds(config.thresholdCurve)
  const full = climbBuild(config, total).score
  const additive = climbBuild({ ...config, modifiers: additivize(config.modifiers) }, total).score
  const ratio = additive > 0 ? full / additive : 0

  const hasMulMult = config.modifiers.some((m) =>
    m.effects.some((e) => e.op === 'mul_mult' || e.op === 'mul_mult_pow'),
  )

  let verdict: Verdict = 'red'
  if (ratio >= 1.5 && hasMulMult) verdict = 'green'
  else if (ratio >= 1.25) verdict = 'yellow'

  return {
    id: 'T2',
    name: 'multiplicativo',
    verdict,
    detail: `teto mult/aditivo = ${ratio.toFixed(2)}x; mul_mult ${hasMulMult ? 'presente' : 'AUSENTE'}`,
  }
}

// ---------------------------------------------------------------------------
// T8 — sensibilidade a ordem (profundidade)
// ---------------------------------------------------------------------------

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const p of permutations(rest)) out.push([items[i] as T, ...p])
  }
  return out
}

/** Snapshot sintetico para o T8 (cobra de 5 pecas, para a Serpente disparar). */
function syntheticSnapshot(chainLen: number): BoardQuery {
  return {
    count: () => 0,
    endsValues: () => [],
    chainLength: () => chainLen,
    mostCommonNumber: () => null,
  }
}

export function testT8Order(config: RunConfig): SanityResult {
  const find = (id: string): Modifier | undefined => config.modifiers.find((m) => m.id === id)
  const evenSteven = find('even_steven')
  const serpente = find('serpente')
  if (!evenSteven || !serpente) {
    return { id: 'T8', name: 'ordem importa', verdict: 'yellow', detail: 'mods de teste ausentes' }
  }

  // Peca 6|6 (is_even, value_sum 12) com a cobra em 6 pecas -> ambos disparam.
  const ctx: ScoringContext = {
    baseValue: 12,
    tags: [{ key: 'value_sum', value: 12 }, { key: 'is_even' }],
    entities: [],
    snapshot: syntheticSnapshot(6),
    consumes: {},
  }
  const run: RunStateView = { ante: 1, blind: 1, money: 0, resources: {}, activeModifierIds: [] }
  const rng = { next: () => 0, int: () => 0 }

  const scores = permutations([evenSteven, serpente]).map(
    (perm) => resolve(ctx, perm, run, rng).trace.finalScore,
  )
  const distinct = new Set(scores)
  const matters = distinct.size > 1

  return {
    id: 'T8',
    name: 'ordem importa',
    verdict: matters ? 'green' : 'red',
    detail: matters ? `permutacoes geram ${distinct.size} placares distintos` : 'ordem nao muda nada',
  }
}

// ---------------------------------------------------------------------------
// T4 — existe build que quebra o jogo, e e alcancavel
// ---------------------------------------------------------------------------

export function testT4BreakingBuild(config: RunConfig): SanityResult {
  const total = totalBlinds(config.thresholdCurve)
  const finalThreshold = thresholdFor(config.thresholdCurve, total)
  const build = climbBuild(config, total)
  const margin = finalThreshold > 0 ? build.score / finalThreshold : 0
  const cost = buildCost(config, build.ids)

  let verdict: Verdict = 'red'
  if (margin >= 1.5) verdict = 'green'
  else if (margin >= 1) verdict = 'yellow'

  const label = build.ids.length > 0 ? `{${build.ids.join('+')}}` : '{vazio}'
  return {
    id: 'T4',
    name: 'build quebra',
    verdict,
    detail: `${label} -> ${margin.toFixed(1)}x o limiar final (custo ${cost})`,
  }
}

// ---------------------------------------------------------------------------
// T6 — diversidade de builds (sem estrategia dominante)
// ---------------------------------------------------------------------------

const ARCHETYPE: Record<string, string> = {
  martelo: 'duplas',
  mirror_engine: 'duplas',
  gemeos: 'duplas',
  polish: 'duplas',
  colecionador: 'mono',
  numerologo: 'mono',
  the_count: 'mono',
  sixer: 'mono',
  serpente: 'cobra',
  crescente: 'cobra',
  economia_circular: 'cobra',
  even_steven: 'paridade',
  odd_todd: 'paridade',
  heavyweight: 'valor',
  lightfingers: 'valor',
  high_roller: 'valor',
  low_baller: 'valor',
  canhoto: 'mono',
  pente_fino: 'econ',
  ferrolho: 'econ',
  aposta: 'econ',
}

function dominantArchetype(ids: string[]): string {
  const counts = new Map<string, number>()
  for (const id of ids) {
    const a = ARCHETYPE[id] ?? 'outro'
    counts.set(a, (counts.get(a) ?? 0) + 1)
  }
  let best = 'nenhum'
  let bestCount = 0
  for (const [a, c] of counts) {
    if (c > bestCount) {
      best = a
      bestCount = c
    }
  }
  return best
}

export function testT6Diversity(config: RunConfig, n: number): SanityResult {
  const winners = seeds(n)
    .map((s) => simulateRun(config, s, synergyStrategy))
    .filter((o) => o.status === 'won')

  if (winners.length < 3) {
    return { id: 'T6', name: 'diversidade', verdict: 'yellow', detail: `so ${winners.length} vitorias (poucas p/ medir)` }
  }

  const archetypes = new Set(winners.map((w) => dominantArchetype(w.finalActiveIds)))

  // frequencia do modificador mais presente nas vitorias
  const freq = new Map<string, number>()
  for (const w of winners) {
    for (const id of new Set(w.finalActiveIds)) freq.set(id, (freq.get(id) ?? 0) + 1)
  }
  const maxFreq = Math.max(0, ...freq.values())
  const maxRatio = maxFreq / winners.length

  let verdict: Verdict = 'green'
  if (archetypes.size < 3 || maxRatio > 0.9) verdict = 'yellow'

  return {
    id: 'T6',
    name: 'diversidade',
    verdict,
    detail: `${archetypes.size} arquetipos vencem; mod top em ${Math.round(maxRatio * 100)}% das vitorias`,
  }
}

// ---------------------------------------------------------------------------
// T7 — solvencia economica (win-rate)
// ---------------------------------------------------------------------------

export function testT7WinRate(config: RunConfig, n: number): SanityResult {
  const wins = seeds(n).filter((s) => simulateRun(config, s, synergyStrategy).status === 'won').length
  const rate = wins / n

  let verdict: Verdict = 'red'
  if (rate >= 0.2 && rate <= 0.6) verdict = 'green'
  else if (rate >= 0.05 && rate <= 0.8) verdict = 'yellow'

  return {
    id: 'T7',
    name: 'win-rate',
    verdict,
    detail: `${Math.round(rate * 100)}% (alvo 20-60%)`,
  }
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

export function runCheapSanitySuite(config: RunConfig, n: number): SanityResult[] {
  return [
    testT2Multiplicative(config),
    testT3CleanDeath(config, n),
    testT5Synergy(dominoBoard.declareTagVocabulary(), config.modifiers),
    testT8Order(config),
    testT9Determinism(config),
  ]
}

export function runFullSanitySuite(config: RunConfig, n: number): SanityResult[] {
  return [
    testT2Multiplicative(config),
    testT3CleanDeath(config, n),
    testT4BreakingBuild(config),
    testT5Synergy(dominoBoard.declareTagVocabulary(), config.modifiers),
    testT6Diversity(config, n),
    testT7WinRate(config, n),
    testT8Order(config),
    testT9Determinism(config),
  ]
}

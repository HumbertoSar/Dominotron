// Testes de sanidade (SANITY_TESTS.md) — provam que um config NAO esta quebrado,
// nunca que e divertido (Lei 12). Esta e a leva barata/decisiva: T9, T5, T3, T2, T8.
// T4/T6/T7 (que dependem do synergy-climber) chegam na Parte 2.

import {
  resolve,
  validateVocabulary,
  type BoardQuery,
  type Modifier,
  type RunConfig,
  type RunStateView,
  type ScoringContext,
  type TagSpec,
} from '../engine/index'
import { dominoBoard } from '../boards/domino/board'
import { cleanStrategy, randomStrategy, simulateRun } from './simulate'

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

export function testT2Multiplicative(config: RunConfig, n: number): SanityResult {
  const scores: number[] = []
  for (const s of seeds(n)) {
    scores.push(...simulateRun(config, s, randomStrategy()).perBlindScore)
  }
  const sorted = [...scores].sort((a, b) => a - b)
  const p50 = percentile(sorted, 50) || 1
  const p95 = percentile(sorted, 95)
  const ratio = p95 / p50

  const hasMulMult = config.modifiers.some((m) =>
    m.effects.some((e) => e.op === 'mul_mult' || e.op === 'mul_mult_pow'),
  )

  let verdict: Verdict = 'red'
  if (ratio >= 5 && hasMulMult) verdict = 'green'
  else if (ratio >= 2.5) verdict = 'yellow'

  return {
    id: 'T2',
    name: 'multiplicativo',
    verdict,
    detail: `p95/p50 = ${ratio.toFixed(1)}x; mul_mult ${hasMulMult ? 'presente' : 'AUSENTE'}`,
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

  // Peca 6|6 (is_even, value_sum 12) com a cobra em 5 pecas -> ambos disparam.
  const ctx: ScoringContext = {
    baseValue: 12,
    tags: [{ key: 'value_sum', value: 12 }, { key: 'is_even' }],
    entities: [],
    snapshot: syntheticSnapshot(5),
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
// Suite
// ---------------------------------------------------------------------------

export function runCheapSanitySuite(config: RunConfig, n: number): SanityResult[] {
  return [
    testT2Multiplicative(config, n),
    testT3CleanDeath(config, n),
    testT5Synergy(dominoBoard.declareTagVocabulary(), config.modifiers),
    testT8Order(config),
    testT9Determinism(config),
  ]
}

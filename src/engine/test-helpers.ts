// Fixtures sinteticas para os testes do engine. O M1 nao tem board ainda (Lei 11),
// entao fabricamos ScoringContext / RunStateView / Modifier a mao.

import type { RunConfig } from './config'
import type {
  BoardQuery,
  Effect,
  Modifier,
  Predicate,
  Rng,
  RunStateView,
  ScoringContext,
  Tag,
} from './types'

/** BoardQuery falso e read-only, com respostas fixas — suficiente para o nucleo. */
export function fakeSnapshot(overrides: Partial<BoardQuery> = {}): BoardQuery {
  return {
    count: () => 0,
    endsValues: () => [],
    chainLength: () => 0,
    ...overrides,
  }
}

/** RNG deterministico (sempre o mesmo valor). O M1 nao usa RNG; existe so para a assinatura. */
export const fakeRng: Rng = {
  next: () => 0,
  int: () => 0,
}

/** Constroi um ScoringContext com defaults sensatos. */
export function makeCtx(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    baseValue: 0,
    tags: [],
    entities: [],
    snapshot: fakeSnapshot(),
    consumes: {},
    ...overrides,
  }
}

/** Constroi uma RunStateView com defaults sensatos. */
export function makeRun(overrides: Partial<RunStateView> = {}): RunStateView {
  return {
    ante: 1,
    blind: 1,
    money: 0,
    resources: {},
    activeModifierIds: [],
    ...overrides,
  }
}

/** Constroi um Modifier minimo (trigger `always` por padrao). */
export function makeMod(id: string, effects: Effect[], trigger: Predicate = { kind: 'always' }): Modifier {
  return {
    id,
    name: id,
    rarity: 'common',
    cost: 0,
    slotType: 'standard',
    trigger,
    effects,
  }
}

/** Atalho para montar tags. */
export function tag(key: string, value?: number): Tag {
  return value === undefined ? { key } : { key, value }
}

/** Um pequeno pool de modificadores (uma de cada raridade) para os testes de loja. */
export function makePool(): Modifier[] {
  return [
    makeMod('heavyweight', [{ op: 'add_base', args: [8] }]), // common
    makeMod('numerologo', [{ op: 'add_mult', args: [3] }], { kind: 'always' }), // ver abaixo
    makeMod('serpente', [{ op: 'mul_mult', args: [2] }]),
  ].map((m, i) => ({ ...m, rarity: (['common', 'uncommon', 'rare'] as const)[i] ?? 'common' }))
}

/** Config no shape do DOMINOTRON.md, com defaults da espec. */
export function makeConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  return {
    board: 'domino',
    resources: { plays: 8, redraws: 3 },
    thresholdCurve: { base: 18, growth: 1.3, antes: 8, blindsPerAnte: 3 },
    economy: {
      blindReward: { small: 3, big: 4, boss: 5 },
      interestPer: 5,
      interestCap: 5,
      prices: { common: 4, uncommon: 6, rare: 8 },
    },
    slots: 5,
    modifiers: makePool(),
    ...overrides,
  }
}

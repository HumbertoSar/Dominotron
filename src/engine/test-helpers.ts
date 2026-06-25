// Fixtures sinteticas para os testes do engine. O M1 nao tem board ainda (Lei 11),
// entao fabricamos ScoringContext / RunStateView / Modifier a mao.

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

// Os tipos do contrato — a camada invariante (ver docs/ARCHITECTURE.md e
// docs/BOARD_CONTRACT.md). Convencao do projeto: "tipos primeiro", os tipos SAO a espec.
//
// Nada aqui importa I/O, DOM, relogio ou RNG global (Lei 3).

// ---------------------------------------------------------------------------
// Aliases de identidade
// ---------------------------------------------------------------------------

export type ModifierId = string
export type ResourceId = string
export type Seed = number

// ---------------------------------------------------------------------------
// Fronteira board -> engine (resumo; o detalhe vive em BOARD_CONTRACT.md)
// ---------------------------------------------------------------------------

/** Uma tag do vocabulario declarado pelo board. Ex.: 'value_sum:12' => { key:'value_sum', value:12 }. */
export interface Tag {
  key: string
  value?: number
}

/** Um objeto da jogada (peca/celula/bloco), com suas tags, para as ops "_per" iterarem. */
export interface Entity {
  id: string
  tags: Tag[]
}

/** Visao read-only e consultavel do board, para modificadores topologicos.
 *  Mantida minima aqui; cada board expoe as consultas que fizerem sentido. */
export interface BoardQuery {
  count(tagKey: string): number
  endsValues(): number[]
  chainLength(): number
}

/** A unica coisa que o board entrega ao Resolver por jogada. NAO contem pontuacao (Lei 1). */
export interface ScoringContext {
  /** A "qualidade" da jogada nas regras ORIGINAIS. So isso (ex.: pips da peca). */
  baseValue: number
  /** Tags emitidas, do vocabulario declarado. */
  tags: Tag[]
  /** Os objetos da jogada, para ops "_per". */
  entities: Entity[]
  /** Visao read-only do board, para mods topologicos. */
  snapshot: BoardQuery
  /** Intencao de consumo de recursos; quem decrementa e o RunManager (invariante 4). */
  consumes: Partial<Record<ResourceId, number>>
}

// ---------------------------------------------------------------------------
// Acumulador e Trace (a sacada central: pontuacao e um Trace, nao um numero)
// ---------------------------------------------------------------------------

/** Pontuacao e sempre chips x mult, separados ate a multiplicacao final (Lei 2). */
export interface Accumulator {
  chips: number
  mult: number
}

/** O conjunto COMPLETO e fechado de ops da DSL de efeitos (Lei 8). */
export type EffectOp =
  | 'add_base'
  | 'add_mult'
  | 'mul_mult'
  | 'add_money'
  | 'add_resource'
  | 'add_base_per'
  | 'add_mult_per'
  // Estendidos (M3 Parte 2a): quantidade vinda do VALOR de uma tag.
  | 'add_base_tag'
  | 'add_mult_tag'

/** De onde veio uma linha do Trace. */
export type TraceSource = ModifierId | 'base' | 'hand'

/** Uma linha do log ordenado: cada operacao anota sua origem e o acumulador resultante. */
export interface TraceEntry {
  source: TraceSource
  op: EffectOp
  args: number[]
  accAfter: Accumulator
}

/** O log ordenado de operacoes. O numero final e so a ultima linha (Lei 5). */
export interface Trace {
  entries: TraceEntry[]
  finalScore: number
}

// ---------------------------------------------------------------------------
// Sistema de modificadores (declarativo — Lei 7)
// ---------------------------------------------------------------------------

export type Rarity = 'common' | 'uncommon' | 'rare'

export type Comparison = '==' | '!=' | '>' | '>=' | '<' | '<='

/**
 * Consulta de contagem para as ops "_per".
 * - `tag`: casa tags do ctx.
 * - `entity`: casa tags das entities da jogada.
 * - `snapshot`: conta na cobra via `snapshot.count(numero)` — topologica (M3 2a).
 */
export interface MatchQuery {
  target: 'tag' | 'entity' | 'snapshot'
  key: string
  /** Se definido, casa tambem o valor da tag (alem da chave). */
  value?: number
  /** Para `snapshot`: o numero a contar vem do VALOR desta tag do ctx (ex.: closes_number). */
  fromTag?: string
}

/** Um efeito: uma op nomeada da DSL fechada + seus argumentos. Modificadores sao DADOS. */
export interface Effect {
  op: EffectOp
  args: number[]
  /** Usado por add_base_per / add_mult_per: o que contar. */
  query?: MatchQuery
  /** Usado por add_resource: qual recurso. */
  resource?: ResourceId
  /** Usado por add_base_tag / add_mult_tag: a tag cujo VALOR vira a quantidade. */
  tag?: string
}

/** Arvore declarativa de gatilho. Sem funcoes arbitrarias, sem eval (Leis 7 e 8). */
export type Predicate =
  | { kind: 'always' }
  | { kind: 'has_tag'; tag: string }
  | { kind: 'tag_value'; tag: string; cmp: Comparison; value: number }
  | { kind: 'entity_count'; key: string; cmp: Comparison; value: number }
  | { kind: 'run'; field: 'ante' | 'blind' | 'money'; cmp: Comparison; value: number }
  // Topologico (M3 2a): le uma metrica do snapshot, opcionalmente modulo `mod`.
  | { kind: 'snapshot'; metric: 'chainLength'; mod?: number; cmp: Comparison; value: number }
  | { kind: 'and'; preds: Predicate[] }
  | { kind: 'or'; preds: Predicate[] }
  | { kind: 'not'; pred: Predicate }

export interface Modifier {
  id: ModifierId
  name: string
  rarity: Rarity
  cost: number
  slotType: 'standard'
  trigger: Predicate
  effects: Effect[]
}

// ---------------------------------------------------------------------------
// Estado da run e deltas
// ---------------------------------------------------------------------------

/** Mudancas que o Resolver DESCREVE e o RunManager aplica (o Resolver nao muta a run). */
export interface StateDeltas {
  money?: number
  resources?: Record<ResourceId, number>
}

/** Leitura read-only do estado da run, para os triggers. */
export interface RunStateView {
  ante: number
  blind: number
  money: number
  resources: Record<ResourceId, number>
  activeModifierIds: ModifierId[]
}

// ---------------------------------------------------------------------------
// RNG semeado (interface; a implementacao — RngService — chega no M2)
// ---------------------------------------------------------------------------

/** Toda aleatoriedade vem de uma seed explicita, por um unico servico (Lei 4). */
export interface Rng {
  /** Proximo float em [0, 1). */
  next(): number
  /** Inteiro em [0, maxExclusive). */
  int(maxExclusive: number): number
}

// O contrato BoardModule — a interface que todo tabuleiro implementa (ver
// docs/BOARD_CONTRACT.md). Vive no engine porque e a costura INVARIANTE: o motor
// fala com qualquer board atraves dela. A logica concreta (dominó) mora em src/boards.
//
// O board NUNCA pontua (invariante 1): apply() devolve um ScoringContext
// (baseValue + tags + entities), e quem transforma isso em pontos e o Resolver.

import type { Modifier, ResourceId, ScoringContext, Seed } from './types'

/** Um recurso finito que a rodada consome (ex.: { id: 'plays', default: 8 }). */
export interface ResourceSpec {
  id: ResourceId
  default: number
}

/** Uma tag que o board PODE emitir. Usada para validar o vocabulario estaticamente (T5). */
export interface TagSpec {
  key: string
  type?: 'int' | 'flag'
}

/** Config que o board recebe em init (subconjunto do RunConfig relevante ao tabuleiro). */
export interface BoardConfig {
  resources: Record<ResourceId, number>
}

/**
 * O modulo de tabuleiro, generico sobre seu tipo de estado (S) e de acao (A).
 *
 * Implementar um jogo novo = implementar esta interface. O motor nao muda.
 */
export interface BoardModule<S, A> {
  id: string

  /** Recursos finitos que a rodada consome. */
  declareResources(): ResourceSpec[]

  /** O vocabulario de tags que este board pode emitir (validado por T5). */
  declareTagVocabulary(): TagSpec[]

  /** Estado inicial da rodada — deterministico na seed. */
  init(seed: Seed, config: BoardConfig): S

  /** O que o jogador pode fazer agora. */
  legalActions(state: S): A[]

  /** Aplica uma acao. Retorna o novo estado E o contexto de pontuacao. NAO pontua. */
  apply(state: S, action: A): { state: S; context: ScoringContext }

  /** A rodada acabou? (mao vazia / travado / etc.) */
  isRoundOver(state: S): boolean

  /** Agente que joga maximizando baseValue e ignorando sinergia. Obrigatorio (T3). */
  greedyBaseAgent(state: S): A

  /** Agente que joga buscando ativar os modificadores ativos. Opcional (T4/T6/T7). */
  synergyAgent?(state: S, active: Modifier[]): A
}

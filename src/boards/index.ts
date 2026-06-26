// boards/ — os modulos de tabuleiro plugaveis (ver docs/BOARD_CONTRACT.md).
//
// Tudo que muda entre dominó / sudoku / Tetris / memoria vive aqui, e SO aqui.
// Implementar um jogo novo = implementar a interface BoardModule. O motor nao muda.
//
// Modulo presente: dominó (M3). A espec esta em docs/DOMINOTRON.md.

export { dominoBoard } from './domino/board'
export type { DominoState, DominoAction, PlayAction } from './domino/board'
export { defaultDominoConfig } from './domino/config'
export {
  DOMINO_POOL_PORTABLE,
  DOMINO_POOL_TOPOLOGICAL,
  DOMINO_POOL_MEMORY,
  DOMINO_POOL_EVENTS,
  DOMINO_POOL_RULE,
  DOMINO_POOL,
} from './domino/pool'
export * as dominoTiles from './domino/tiles'

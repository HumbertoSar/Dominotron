// engine/ — a camada invariante (ver docs/ARCHITECTURE.md).
//
// Escrita UMA vez e reutilizada por todo tabuleiro: Resolver, Trace, sistema de
// modificadores, DSL de efeitos, RunManager, Economy/Shop, RngService.
//
// REGRA (Lei 3): este pacote NAO importa I/O, DOM, nem relogio/RNG global.
// Se voce se pegar escrevendo logica de dominó aqui, parou — isso pertence a src/boards.
//
// Conteudo presente: M1 (Resolver + Trace). Por vir: M2 (Run + Economy + Rng).

export * from './types'
export { resolve } from './resolve'
export { evaluatePredicate, compare } from './predicate'

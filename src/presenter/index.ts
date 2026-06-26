// presenter/ — o suco (ver M6 em docs/BUILD_PLAN.md).
//
// CONSTRUIDO POR ULTIMO (Leis 6 e 11). Consome o Trace e o transforma em fogos de
// artificio: revelacao sequencial, cor por tipo de numero (base=azul, mult=vermelho,
// dinheiro=dourado, recurso=verde), escalada e explosao final.
//
// NUNCA produz o Trace; so o consome. O modo headless no-op (NoOpPresenter) e usado em
// todos os testes e na CLI — o motor roda sem tocar no DOM.

export { traceToSteps, colorFor, COLORS, type PresentationStep, type StepKind } from './steps'
export { NoOpPresenter, type Presenter } from './presenter'
export { DomPresenter, type DomPresenterOptions } from './dom'

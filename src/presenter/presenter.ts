// O contrato do Presenter e a implementacao headless no-op (Lei 6).
//
// Em teste e na CLI, o apresentador e no-op — o motor roda headless. O suco visual
// (DomPresenter, em dom.ts) e um consumidor puro do Trace, construido por ULTIMO.

import type { Trace } from '../engine/index'

export interface Presenter {
  /** Consome um Trace e o apresenta. Em headless, no-op. */
  present(trace: Trace): void | Promise<void>
}

/** Apresentador no-op: usado em todos os testes e na CLI. Nao toca em DOM nem I/O. */
export class NoOpPresenter implements Presenter {
  present(_trace: Trace): void {
    // headless: intencionalmente nao faz nada (Lei 6).
  }
}

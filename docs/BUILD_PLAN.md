# BUILD_PLAN.md — ordem de construção

> Respeite a Lei 11: **headless-first, suco por último.** Cada milestone tem uma
> "definição de pronto" (DoD) amarrada a testes. Não avance com a DoD vermelha.
> Não construa o Presenter antes do motor passar em T2/T3/T4 com o dominó.

## M0 — Scaffold

**Meta:** projeto TypeScript rodando, vazio mas testável.
**Entrega:** `package.json` (TS strict + Vitest), estrutura `src/engine`, `src/boards`,
`src/harness`, `src/cli`, `src/presenter`; `npm test` roda (mesmo sem testes).
**DoD:** `npm install && npm test` verde com 0 testes. Tipos `strict: true`.

## M1 — Tipos do contrato + Resolver + Trace (o núcleo puro)

**Meta:** o coração da Lei 2/3/5/10. Nada de board ainda — use fixtures sintéticas.
**Entrega:**
- Tipos: `Accumulator`, `TraceEntry`, `Trace`, `ScoringContext`, `Modifier`, `Effect`,
  `EffectOp`, `Predicate`, `StateDeltas`, `RunStateView` (de `ARCHITECTURE.md` + `BOARD_CONTRACT.md`).
- `resolve(ctx, active, run, rng)` puro, com a DSL fechada (todas as ops da tabela).
- Avaliador de `Predicate` (tags, contagens de entities, campos da run).
**DoD (unit, com `ScoringContext` fabricado à mão):**
- `add_base`/`add_mult`/`mul_mult` produzem o `finalScore` correto e o `Trace` na ordem certa.
- Resolução **sequencial por slot** comprovada: trocar a ordem de dois mods muda o `finalScore`
  (semente do T8).
- Pureza: chamar `resolve` duas vezes com a mesma entrada dá `Trace` deep-equal (semente do T9).

## M2 — RunManager + Economy/Shop + RngService

**Meta:** a estrutura da run e a economia, ainda agnósticas de board.
**Entrega:**
- `RngService(seed)` único e semeado; nenhum `Math.random` no `engine/`.
- `RunManager`: antes×blinds, curva de limiares (lê `thresholdCurve`), recursos, win/loss,
  permadeath, transição para a loja.
- `Economy/Shop`: recompensa+juros+sobra, geração de oferta semeada, comprar/vender/reroll/remover.
**DoD (unit):**
- A curva de limiares bate a tabela de `DOMINOTRON.md` para a fórmula dada.
- Aplicar `StateDeltas` de um `Trace` move dinheiro/recursos corretamente.
- Oferta da loja é determinística por seed.

## M3 — Módulo de tabuleiro: dominó

**Meta:** implementar `BoardModule` para dominó (`BOARD_CONTRACT.md` + `DOMINOTRON.md`).
**Entrega:**
- `init/legalActions/apply/isRoundOver`, saco de 28 semeado, mão de 7, cobra de duas pontas.
- `declareResources()` = `{plays, redraws}`; `declareTagVocabulary()` = a tabela de tags.
- `apply()` emite `ScoringContext` (baseValue=pips, tags, entities, snapshot, consumes) e
  **NÃO pontua** (invariante 1).
- `greedyBaseAgent` (obrigatório) e `synergyAgent` de 1 lance.
- O pool dos 18 modificadores em forma declarativa (dados, não código).
**DoD:**
- Validação estática do vocabulário passa: todo trigger/efeito referencia tag declarada;
  nenhuma tag órfã (semente do T5).
- Uma run end-to-end roda headless via chamadas diretas (sem CLI ainda) com uma seed fixa.

## M4 — Harness de sanidade

**Meta:** os testes que decidem "vale jogar à mão?" (`SANITY_TESTS.md`).
**Ordem dentro do milestone (do mais barato/decisivo ao mais caro):**
1. T9 (determinismo) e T5 (densidade+vocabulário) — estáticos.
2. **T3** (jogar limpo falha) — o mais importante; usa `greedyBaseAgent`.
3. T2 (multiplicativo), T8 (ordem importa).
4. T4 (build quebra), T6 (diversidade), T7 (win-rate) — dependem do `synergyAgent`.
**Entrega:** runner Monte Carlo semeado (`--seeds N`), o synergy-climber para T4, e o
**report-card de uma tela** (formato em `SANITY_TESTS.md`).
**DoD:**
- `npm run harness -- --board domino --seeds 200` imprime o report-card.
- **Calibração:** ajustar `thresholdCurve.base/growth` e `resources` até **T3 passar**
  (morte limpa em 25–45%); depois mirar T7 (win-rate 20–60%) e T6 (≥3 arquétipos).
- Se T6 reprovar por dominância, achatar o expoente do `mirror_engine`/`serpente`.

> Este é o marco que destrava tudo: a partir daqui você gera/ajusta configs e o harness
> filtra os natimortos antes de você gastar feel-time.

## M5 — CLI de terminal (jogar sem suco)

**Meta:** sentir as **decisões** (não o suco) o quanto antes. Texto puro.
**Entrega:** `npm run play -- --seed 123` — mostra mão, pontas, limiar, mods ativos; aceita
jogar peça/redraw; abre a loja entre blinds; imprime o `Trace` como texto.
**DoD:** dá para vencer/perder uma run inteira no terminal; o `Trace` textual mostra de onde
veio cada ponto (prova que a fonte de verdade do suco já existe).

## M6 — Presenter / suco (POR ÚLTIMO — Leis 6 e 11)

**Meta:** transformar o `Trace` em fogos de artifício. Só depois de M4 verde e M5 jogável.
**Entrega:** Presenter web que consome o `Trace`: revelação sequencial, cor por tipo de número
(`DOMINOTRON.md`), escalada e screen-shake, brilho da cobra para `mul_mult`.
**DoD:** o mesmo `Trace` que a CLI imprime em texto é animado fielmente. Modo headless no-op
intacto (os testes continuam sem tocar no DOM).

---

## Resumo da espinha dorsal

```
M0 scaffold
  └─ M1 Resolver+Trace (puro)        → T8/T9 semente
       └─ M2 Run+Economy+Rng
            └─ M3 Board: dominó       → T5 semente
                 └─ M4 Harness        → T2,T3,T4,T6,T7 + report-card  ← destrava tudo
                      └─ M5 CLI (joga sem suco)
                           └─ M6 Suco (joga com fogos)
```

Regra de ouro de novo, porque é a que mais se esquece: o harness prova que **não está
quebrado**; a diversão (T0) só se mede em M5/M6, à mão.

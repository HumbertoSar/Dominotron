# BOARD_CONTRACT.md — o contrato do módulo de tabuleiro

> Tudo que muda entre dominó / sudoku / Tetris / memória vive aqui, e **só aqui**.
> Implementar um jogo novo = implementar este contrato. O motor não muda.

## A interface

```typescript
interface BoardModule {
  id: string

  /** Recursos finitos que a rodada consome (Passo 3 do procedimento). */
  declareResources(): ResourceSpec[]
  // ex: [{ id: 'plays', default: 4 }, { id: 'redraws', default: 3 }]

  /** O vocabulário de tags que este board PODE emitir. Usado para validar
   *  estaticamente que nenhum modificador referencia tag inexistente (T5). */
  declareTagVocabulary(): TagSpec[]
  // ex: [{ key: 'is_double' }, { key: 'value_sum', type: 'int' },
  //      { key: 'closes_number', type: 'int' }, { key: 'played_left' }]

  /** Estado inicial da rodada — determinístico na seed. */
  init(seed: Seed, config: BoardConfig): BoardState

  /** O que o jogador pode fazer agora. */
  legalActions(state: BoardState): Action[]

  /** Aplica uma ação. Retorna o novo estado E o contexto de pontuação da jogada.
   *  NÃO pontua. NÃO usa RNG fora da seed. (ver invariantes) */
  apply(state: BoardState, action: Action): { state: BoardState; context: ScoringContext }

  /** A rodada acabou? (mão vazia / travado / grid cheio / etc.) */
  isRoundOver(state: BoardState): boolean

  /** Agente que joga maximizando baseValue e IGNORANDO sinergia.
   *  Obrigatório: o teste T3 ("jogar limpo falha") depende dele. */
  greedyBaseAgent(state: BoardState): Action

  /** Agente que joga buscando ativar os modificadores ativos.
   *  Opcional, mas necessário para T4/T6/T7 medirem tetos de verdade. */
  synergyAgent?(state: BoardState, active: Modifier[]): Action
}
```

## ScoringContext — o objeto que cruza a fronteira

É a única coisa que o board entrega ao Resolver por jogada. **Note o que NÃO tem: pontuação.**

```typescript
interface ScoringContext {
  baseValue: number       // a "qualidade" da jogada nas regras ORIGINAIS. Só isso.
  tags: Tag[]             // do vocabulário declarado. ex: ['is_double', 'value_sum:12']
  entities: Entity[]      // os objetos da jogada (peças/células/blocos), p/ ops "_per"
  snapshot: BoardQuery    // visão read-only e consultável do board, p/ mods topológicos
  consumes: Partial<Record<ResourceId, number>>   // intenção de consumo; o RunManager decrementa
}

interface Tag { key: string; value?: number }     // 'value_sum:12' => { key:'value_sum', value:12 }
interface Entity { id: string; tags: Tag[] }      // ex: uma peça 6|6 => tags chip etc.
```

`BoardQuery` é como um modificador "topológico" consulta o tabuleiro sem o board ter que
prever toda pergunta. Mantenha-o read-only. Ex.: `snapshot.count(tag)`,
`snapshot.endsValues()`, `snapshot.chainLength()`.

## As 5 invariantes duras (não-negociáveis)

1. **O board NUNCA calcula pontuação.** Emite `baseValue + tags + entities`. No instante em
   que um board devolve "score final", base e mult voltam a se fundir e a arquitetura inteira
   colapsa. (Lei 1)
2. **`apply()` é puro quanto à pontuação.** Efeito colateral só no `BoardState` retornado.
   Sem RNG escondido — toda aleatoriedade vem da seed passada em `init`. (Lei 3, 4)
3. **Tags são declaradas antes de usadas.** Um modificador não pode referenciar uma tag fora
   de `declareTagVocabulary()`. O harness valida isso estaticamente e também acusa "vocabulário
   morto" (tag emitida que nenhum mod lê). (T5)
4. **O board não é dono de contador global.** Ele *declara* recursos e *sinaliza* consumo via
   `consumes`; quem decrementa é o RunManager. Estado da run fica centralizado no motor.
5. **O board entrega seus agentes de referência.** Sem `greedyBaseAgent`, o teste mais
   importante (T3) não roda. Na prática isto não é opcional.

## A seam de portabilidade (parte universal, parte específica)

Honestidade sobre o que o "motor único" entrega e o que não entrega:

- **Portam entre tabuleiros:** tags numéricas/quantitativas (`value_sum`, `value_max`, `count`)
  e os modificadores escritos contra elas. Um modificador "+3 mult por entity com valor ≥ 6"
  funciona em dominó, dados, dominó-chinês, etc.
- **NÃO portam (e tudo bem):** tags topológicas/estruturais (`played_left`, `is_tspin`,
  `pair_distance`) e seus modificadores. São específicas do board — e é **exatamente aqui que
  mora o diferencial** de cada adaptação frente ao Balatro. A vantagem "geométrica" do dominó
  (duas pontas, topologia da cobra) é impossível no baralho. Persiga essa parte; é a graça.

Implicação para o pool de modificadores: organize-o em **núcleo portável** (reusável) +
**extensão do board** (autoral por jogo). T5 mede densidade de sinergia somando os dois.

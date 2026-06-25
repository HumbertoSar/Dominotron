# ARCHITECTURE.md — a camada invariante

> Tudo aqui é escrito **uma vez** e reutilizado por todo tabuleiro. Se você se pegar
> escrevendo lógica de dominó neste pacote, parou — isso pertence ao módulo de tabuleiro.

## Fluxo de dados

```
[BoardModule] --ScoringContext--> [Resolver] --Trace--> [Presenter (suco)]
      ^                               |
      |                         (Score + StateDeltas)
[RunManager / Economy / Shop] <-------/
                ^
                |
          [RngService(seed)]
```

A jogada acontece no tabuleiro; o tabuleiro descreve a jogada (sem pontuá-la); o Resolver
transforma essa descrição num Trace; o RunManager aplica o resultado à run; o Presenter
(quando existe) anima o Trace. RNG entra por um único serviço semeado.

## A sacada central: pontuação é um Trace, não um número

O Resolver não devolve "1.240 pontos". Ele devolve um **log ordenado de operações**, cada
uma anotando sua origem e o acumulador resultante. O número final é só a última linha.

Por quê: (1) o suco precisa mostrar *de onde veio cada ponto* — animar sequencialmente é
animar o Trace; (2) os testes de sanidade leem o Trace para verificar propriedades
(multiplicatividade, sensibilidade à ordem) sem renderizar nada.

```typescript
type Accumulator = { chips: number; mult: number }

interface TraceEntry {
  source: ModifierId | 'base' | 'hand'   // de onde veio
  op: EffectOp
  args: number[]
  accAfter: Accumulator                   // estado após aplicar
}

interface Trace {
  entries: TraceEntry[]
  finalScore: number                      // = última entry: chips * mult
}
```

## Os 6 componentes invariantes

### 1. Resolver (núcleo, função pura)

```typescript
function resolve(
  ctx: ScoringContext,        // o que o tabuleiro emitiu (ver BOARD_CONTRACT.md)
  active: Modifier[],         // modificadores nos slots, EM ORDEM
  run: RunStateView,          // leitura do estado da run (read-only)
  rng: Rng                    // RNG semeado, se algum efeito precisar
): { trace: Trace; deltas: StateDeltas }
```

Regras (Leis 2, 3, 5, 10):
- Inicializa o acumulador a partir da jogada: `chips = ctx.baseValue`, `mult = 1`.
  (Cada entity de `ctx.entities` que carregue valor de chip também entra na base aqui.)
- Itera os modificadores **na ordem dos slots**. Para cada um: avalia `trigger` contra
  `(ctx, run)`; se verdadeiro, aplica seus `effects` em sequência, empurrando uma
  `TraceEntry` por op.
- `finalScore = chips * mult` ao final.
- **Puro:** nenhuma escrita fora do retorno. `deltas` descreve mudanças (dinheiro, recursos)
  que o RunManager aplica — o Resolver não muta a run.

### 2. Sistema de modificadores (declarativo — Lei 7)

Modificadores são dados. Schema:

```typescript
interface Modifier {
  id: ModifierId
  name: string
  rarity: 'common' | 'uncommon' | 'rare'
  cost: number
  slotType: 'standard'                     // espaço p/ tipos futuros (consumível, etc.)
  trigger: Predicate                       // quando dispara
  effects: Effect[]                        // o que faz, em ordem
}

interface Effect { op: EffectOp; args: number[] }
```

### 3. A DSL de efeitos (fechada e pequena — Lei 8)

O conjunto **completo** de ops. Não invente fora desta lista sem adicionar uma op nomeada
ao Resolver (e atualizar este doc):

| op | efeito no acumulador / run |
|----|----------------------------|
| `add_base(n)` | `chips += n` |
| `add_mult(n)` | `mult += n` |
| `mul_mult(x)` | `mult *= x` ← os "espinhosos" que estouram a escala (rare/caro) |
| `add_money(n)` | dinheiro += n (via deltas) |
| `add_resource(id, n)` | recurso da rodada += n (via deltas) |
| `add_base_per(query, n)` | `chips += n * count(match)` |
| `add_mult_per(query, n)` | `mult += n * count(match)` |
| `add_base_tag(tag, k)` | `chips += k * valueOf(tag)` ← quantidade vinda do **valor** de uma tag (M3 2a) |
| `add_mult_tag(tag, k)` | `mult += k * valueOf(tag)` (M3 2a) |
| `mul_mult_pow(field, b)` | `mult *= b ^ memory[field]` ← escala por um contador de **memória de rodada** (M3 2b) |
| `add_mult_run(field, n)` | `mult += n * run[field]` ← quantidade vinda do **estado da run** (M3 2c) |
| `add_money_per_resource(res, n)` | `dinheiro += n * run.resources[res]` (M3 2c) |

A `query` das ops `_per` tem três alvos: `tag` (casa `ctx.tags`), `entity` (casa tags das
entities) e `snapshot` (conta na cobra via `snapshot.count(numero)`; o número pode vir fixo
ou do valor de uma tag, via `fromTag` — ex.: `closes_number`). Os alvos `snapshot` são as
ops **topológicas** (M3 2a).

`trigger` (`Predicate`) é uma árvore declarativa sobre: tags presentes em `ctx.tags`,
contagens de entities, campos de `RunStateView`, métricas do `snapshot`, e a **memória de
rodada**. Exemplos: `always`, `has_tag('is_double')`, `tag_value('value_sum') >= 9`,
`snapshot(chainLength mod 5 == 0)` (M3 2a), `tag_vs_memory('value_sum' > prevValueSum)`,
`memory_flag(prevWasDouble)`, `memory(doubles >= 2)` (M3 2b), `and(...)`, `or(...)`, `not(...)`.

> **Memória de rodada (M3 2b).** Até aqui o Resolver pontuava cada jogada isolada. Combos
> como Crescente/Gêmeos/Motor Espelho precisam lembrar a rodada, então `resolve` recebe um
> parâmetro opcional `memory: RoundMemory` (estado ANTES da jogada). O chamador (run loop)
> avança a memória com `advanceRoundMemory` após cada jogada. O Resolver continua puro: lê a
> memória, nunca a muta.

> **Eventos e regras (M3 2c).** Além da pontuação por jogada, um modificador pode ter `hooks`
> (efeitos disparados em `round_start` / `lock` / `round_end`, via `resolveEvent` → `StateDeltas`)
> e/ou um descritor `rule` (`two_ends_play`, `shop_thinning`) que o **board/loja** aplica — não
> o Resolver. Os helpers (`totalShopThinning`, `hasTwoEndsPlay`) já existem; a integração das
> regras no loop jogável chega no M5 (CLI).

> **Por que fechada.** A DSL declarativa permite: configs diffáveis e versionáveis;
> segurança (nada executa código arbitrário); e **análise estática** — os testes T4/T5/T8
> inspecionam triggers/effects sem rodar. Abrir um `eval()` destrói as três coisas.

### 4. RunManager

Dono da estrutura da run e dos contadores. Responsabilidades:
- Sequência de **antes × blinds** e a **curva de limiares** (exponencial, ver DOMINOTRON.md).
- Recursos da rodada (declarados pelo board) — é quem decrementa via `ctx.consumes` e `deltas`.
- Win/loss da rodada e da run; permadeath.
- Transições: ao vencer, gera dinheiro e abre a loja.

### 5. Economy / Shop

- Dinheiro por vitória (proporcional ao excedente sobre o limiar + bônus de mods).
- Geração da oferta da loja: amostra semeada do pool de modificadores + itens do board.
- Reroll, comprar/vender, remoção de peça ("thinning").
- A tensão **gastar agora vs. guardar (juros)** mora aqui — modele juros sobre dinheiro retido.

### 6. Presenter (suco — construído por ÚLTIMO, Lei 6 e 11)

- Consome `Trace`. Para cada `TraceEntry`, anima em sequência com cor por tipo de número.
- **Mapa de cores fixo:** base=azul, mult=vermelho, dinheiro=dourado, recurso=verde.
- Escalada: tamanho/som crescentes ao longo do Trace; "explosão" no `finalScore`.
- Tem um modo **headless no-op** usado em todos os testes e na CLI.

## Tipos de fronteira (resumo — detalhe do board em BOARD_CONTRACT.md)

```typescript
type StateDeltas = {
  money?: number
  resources?: Record<ResourceId, number>
  // mudanças no board ficam no BoardState, não aqui
}

interface RunStateView {     // leitura read-only para triggers
  ante: number
  blind: number
  money: number
  resources: Record<ResourceId, number>
  activeModifierIds: ModifierId[]
}
```

## Decisões de arquitetura (ADRs condensados)

**ADR-1: Pontuação baseada em Trace.** *Decisão:* o Resolver emite um log ordenado, não um
escalar. *Consequência:* suco e testes consomem a mesma fonte de verdade; motor roda headless.
*Custo:* uma indireção a mais entre "jogar" e "ver o número".

**ADR-2: DSL de efeitos fechada.** *Decisão:* efeitos vêm de um conjunto fixo de ops nomeadas.
*Consequência:* configs analisáveis estaticamente, seguros e diffáveis. *Custo:* expressividade
limitada — criatividade vai para o vocabulário de tags do board, não para o efeito.

**ADR-3: Board nunca pontua.** *Decisão:* a fronteira board→engine carrega só
`base + tags + entities`. *Consequência:* a separação base×mult é estruturalmente garantida,
não uma convenção que decai. *Custo:* o autor do board precisa pensar em "tags" em vez de
"pontos", o que é menos intuitivo no começo.

**ADR-4: Resolução sequencial por slot (não comutativa).** *Decisão:* ordem dos slots importa.
*Consequência:* arranjar a coleção vira decisão (profundidade); T8 testa isso. *Custo:* o
jogador precisa entender ordem — mitigado pelo suco que mostra a sequência.

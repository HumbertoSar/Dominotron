# DOMINOTRON.md — a adaptação do dominó

> A primeira instância do `BoardModule`. Implementa o contrato em `BOARD_CONTRACT.md`.
> Substrato: dominó duplo-seis padrão (28 peças, de `0|0` a `6|6`). O jogador deve
> reconhecer dominó em < 30s (T1).

## O ato de pontuar

**Encostar uma peça numa das duas pontas abertas da cobra.** Frequente, repetível, e
carrega tanto valor numérico (pips) quanto topologia (qual ponta, que número expõe).

## Estado e fluxo de uma rodada

- **Mão:** 7 peças, sacadas de um saco de 28 (semeado).
- **Cobra:** a sequência de peças na mesa, com duas pontas abertas. Persiste pela rodada
  inteira — é o que dá às sinergias topológicas (comprimento, número exposto) onde morar.
- **Uma jogada (`play`):** coloca uma peça da mão numa ponta cujo valor casa com uma metade
  da peça (salvo modificador que mude a regra). Pontua `base × mult`. A peça sai da mão;
  você compra 1 do saco para repor (até o saco esvaziar).
- **Um redraw:** descarta até k peças da mão e compra repostas. Custa 1 `redraw`.
- **Fim da rodada:** quando `plays` zera, OU mão+saco vazios, OU travado sem `redraws`.
- **Vitória da rodada:** soma das pontuações das jogadas ≥ limiar da blind.

## Base × Multiplicador (a derivação — Passo 2)

- **base** = soma dos pips da peça jogada. `6|6` → 12; `0|1` → 1. (Duplas contam as duas metades.)
- **mult** = começa em **1** a cada jogada. É onde os modificadores atuam.
- Pontuação da jogada = `base × mult`, resolvida pelo Resolver (o board **não** calcula isto).

## Vocabulário de tags emitido (`declareTagVocabulary`)

O board emite, por jogada, um `ScoringContext` com `baseValue` = pips e estas tags:

| tag | tipo | significado | portável? |
|-----|------|-------------|-----------|
| `value_sum` | int | pips da peça | sim |
| `value_max` | int | maior metade | sim |
| `value_min` | int | menor metade | sim |
| `is_double` | flag | as duas metades iguais | sim |
| `is_even` / `is_odd` | flag | paridade de `value_sum` | sim |
| `contains` | int (multi) | cada número presente na peça (emite 1 ou 2) | sim |
| `played_left` / `played_right` | flag | em qual ponta encostou | **não (topológica)** |
| `matches_number` | int | valor da ponta onde encostou | **não** |
| `closes_number` | int | novo valor exposto por esta jogada | **não** |
| `both_ends_equal` | flag | após a jogada, as duas pontas mostram o mesmo número | **não** |

`entities`: a peça jogada entra como uma entity com tags `contains:<a>` e `contains:<b>` para
as ops `_per` iterarem. `snapshot` (BoardQuery) expõe: `chainLength()`, `endsValues()`,
`countInChain(number)`, `mostCommonNumber()`.

## Recursos da rodada (`declareResources`)

| id | default | análogo Balatro |
|----|---------|-----------------|
| `plays` | 8 → **12** (calibrado M4) | "hands" |
| `redraws` | 3 | "discards" |

> Estes defaults são o ponto de partida de calibração. **T3 e T7 são quem os afinam.**

## Curva de limiares (calibrável — Passo 5)

8 antes × 3 blinds (small / big / boss) = 24 blinds. Índice global `i = 1..24`.

**Fórmula inicial:** `target(i) = round(18 * 1.30^(i-1))`.

| i | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | … | 24 |
|---|---|---|---|---|---|---|---|---|---|----|---|----|
| target | 18 | 23 | 30 | 40 | 51 | 67 | 87 | 113 | 147 | 191 | … | ~7516 |

> Valores derivados estritamente de `round(18 * 1.30^(i-1))` — a fórmula é a fonte de
> verdade. (Correções vs. rascunho: `i=4` era 39, `i=24` era ~6400; ambos arredondados
> errado à mão.)

**Teste de sanidade (T3):** jogando dominó "limpo" (greedy de base, **zero** modificadores),
o teto por rodada fica em ~50–70 pontos e **não cresce** (mult sempre 1). Logo a curva o
ultrapassa por volta de `i ≈ 6–8`, ou seja **25–33% da run** — dentro da banda 25–45% de T3.
**Calibre `base` (18) e `growth` (1.30) até T3 passar.** Não chute: rode o harness.

> **Nota de calibração (M4 — rodada via harness, não chute).** O report-card com a fórmula
> inicial reprovou: o jogo era invencível no fim (T4) e o motor não era de fato multiplicativo
> (o teto multiplicativo empatava com o aditivo). Após varrer parâmetros, o config calibrado é:
> **`growth` 1.30 → 1.12**, **`plays` 8 → 12** (cobra mais longa = a Serpente compõe), e reforço
> dos ×mult: **`serpente`** dispara a cada **3** peças (era 5), **`mirror_engine`** escala **1.6**
> por dupla (era 1.2), **`gemeos`** faz **×3** (era ×2). Resultado: **8/8 testes 🟢** (T2 teto
> mult/aditivo 1.54x, T3 29%, T4 9.7x, T6 6 arquétipos, T7 26%). A tabela acima reflete a
> fórmula inicial 1.30; com `growth` 1.12 a curva é bem mais suave.

## Pool inicial de modificadores (18)

Núcleo portável + extensão topológica do dominó. Tipos: `+base`, `+mult`, `×mult` (`mul_mult`),
`econ`, `rule`, `syn` (sinérgico). Sinérgicos ≥ 1/3 (T5): há **8/18 ≈ 44%**.

| id | nome (PT) | rar. | tipo | gatilho → efeito | nota de sinergia / arquétipo |
|----|-----------|------|------|------------------|------------------------------|
| `heavyweight` | Pesadão | common | +base | `value_sum>=9` → `add_base(8)` | arquétipo peças-altas |
| `lightfingers` | Dedo-Leve | common | +mult | `value_sum<=3` → `add_mult(3)` | arquétipo peças-baixas (anti-Pesadão) |
| `even_steven` | Par Perfeito | common | +mult | `is_even` → `add_mult(4)` | semente de arquétipo paridade |
| `odd_todd` | Ímpar Teimoso | common | +mult | `is_odd` → `add_mult(4)` | semente de arquétipo paridade |
| `martelo` | Martelo | common | +base | `is_double` → `add_base(value_sum)` | arquétipo duplas |
| `polish` | Lustro | common | econ | `is_double` → `add_money(1)` | sustenta arquétipo duplas |
| `colecionador` | Colecionador | common | +base | `always` → `add_base_per(chain contains:6, 2)` | **syn** núcleo "seis" |
| `pente_fino` | Pente-Fino | common | rule | passivo: remove 2 peças na loja | thinning |
| `the_count` | O Conde | uncom | +mult | `always` → `add_mult_per(played tile halves == snapshot.mostCommonNumber, 2)` | **syn** mono-número |
| `numerologo` | Numerólogo | uncom | +mult | `always` → `add_mult_per(chain contains: closes_number, 3)` | **syn topológica** mono-número |
| `canhoto` | Canhoto | uncom | rule | gasta 1 `redraw` → joga nas duas pontas | habilita builds de duas pontas |
| `crescente` | Crescente | uncom | +mult | `value_sum > prev play value_sum` → `add_mult(2)` acum. na rodada | **syn** ordenação/tempo |
| `economia_circular` | Economia Circular | uncom | econ | fim de rodada → `add_money(1)` por `redraw` não usado | jogo de juros |
| `ferrolho` | Ferrolho | uncom | rule/econ | ao travar → `add_money(6)` + devolve 1 `play` | converte o "trancado" em recurso |
| `mirror_engine` | Motor Espelho | rare | ×mult | cada `is_double` na rodada → `mul_mult(1.6)` acum. (calibrado de 1.2) | **syn** duplas, estoura escala |
| `serpente` | Serpente | rare | ×mult | `snapshot.chainLength() % 3 == 0` → `mul_mult(2)` (calibrado de 5) | **syn topológica** cobra longa |
| `gemeos` | Gêmeos | rare | ×mult | duas duplas seguidas → `mul_mult(3)` na 2ª (calibrado de ×2) | **syn** duplas |
| `aposta` | Aposta | rare | +mult | início de rodada `add_money(-3)`; jogada → `add_mult_per(money held, 1)` | escala arriscada por economia |

> `ponta_dupla` (Ponta Dupla, common, +base): `both_ends_equal` → `add_base(5)` — incluir como
> 19º se quiser reforçar a vertente topológica/duas-pontas. Deixei de fora da contagem base.

### Arquétipos esperados (T6 quer ≥ 3 vencendo)

1. **Duplas:** `martelo` + `mirror_engine` + `gemeos` + `polish`.
2. **Mono-número (ex.: seis):** `colecionador` + `numerologo` + `the_count` + `canhoto`.
3. **Cobra longa / tempo:** `serpente` + `crescente` + `economia_circular` (muitas jogadas).
4. **Paridade / valor:** `even_steven`/`odd_todd` ou `heavyweight`/`lightfingers`.

Se na simulação um único modificador aparecer em > 90% das vitórias (T6 reprova), o suspeito
nº 1 é `mirror_engine` ou `serpente` — achate o expoente.

## Economia e loja (Passo 6)

- **Recompensa por blind:** base por tipo (small 3 / big 4 / boss 5) + **juros** (`+1` por 5 de
  dinheiro retido, teto `+5`) + **sobra** (`+1` por `play`/`redraw` não usado).
- **Loja:** oferece **2 modificadores** (amostra semeada do pool por raridade) + **1 peça
  especial** (ex.: um curinga `6|6` dourado que casa em qualquer ponta) + **reroll** (custo 2,
  sobe +1 por uso na mesma loja).
- **Preços:** common 4 / uncommon 6 / rare 8. Vender devolve metade.
- **Tensão central:** gastar agora (poder) vs. guardar (juros compostos). `aposta` e
  `economia_circular` tensionam isso de propósito.

## Suco (Passo 7 — construído por ÚLTIMO, Lei 11)

Sequência de revelação por jogada, consumindo o `Trace`:
1. peça encosta → pips voam para o contador **azul** (base);
2. cada modificador que dispara pisca em **vermelho** na ordem dos slots (mult);
3. `serpente`/`mirror_engine` fazem a cobra inteira brilhar antes do `mul_mult`;
4. número final estoura em **dourado** com screen-shake proporcional ao salto.

Cores fixas: base=azul, mult=vermelho, dinheiro=dourado, recurso=verde. Sem rótulos — cor é
o rótulo.

## Agentes de referência (obrigatório p/ o harness — `BOARD_CONTRACT` invariante 5)

- **`greedyBaseAgent`** (T3): entre as jogadas legais, escolhe a de maior `baseValue`; desempata
  preservando mais jogadas legais futuras. **Ignora modificadores.**
- **`synergyAgent`** (T4/T6/T7): para cada jogada legal, simula `resolve()` com os modificadores
  ativos e escolhe a de maior `finalScore` (greedy de 1 lance). Heurística de redraw: se a melhor
  jogada projetada estiver abaixo de um limiar e houver `redraws`, troca peças mortas.
  - **MVP honesto = 1 lance.** Busca mais profunda é o risco sinalizado em `SANITY_TESTS.md`
    (synergy-climber fraco gera falso-negativo em T4). Trate este agente como código de
    primeira classe, com testes próprios, e melhore-o quando T4/T6 parecerem subestimar tetos.

## Exemplo de build que quebra o jogo (alvo de T4)

`numerologo` + `canhoto` + curinga `6|6`: você converte a cobra em seis, joga nas duas pontas
perseguindo o mesmo número, e o mult cresce ~3 por peça-seis a cada turno → bola de neve
exponencial. É o equivalente-dominó de "esvaziar a mão pra farmar multiplicador". A sinergia
`canhoto`×`numerologo` é **geométrica** — impossível no baralho do Balatro. Esse é o diferencial.

## Shape do config (o que o board + pool viram em dados)

```jsonc
{
  "board": "domino",
  "resources": { "plays": 12, "redraws": 3 },          // calibrado de 8 (M4)
  "thresholdCurve": { "base": 18, "growth": 1.12, "antes": 8, "blindsPerAnte": 3 },  // growth calibrado de 1.30
  "economy": { "blindReward": { "small": 3, "big": 4, "boss": 5 },
               "interestPer": 5, "interestCap": 5,
               "prices": { "common": 4, "uncommon": 6, "rare": 8 } },
  "slots": 5,
  "modifiers": [ /* os 18 acima, em forma declarativa (id, trigger, effects) */ ]
}
```

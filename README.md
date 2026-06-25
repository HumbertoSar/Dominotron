# Dominotron

Um motor de jogo do gênero **Balatro-like** (roguelike deckbuilder de score-attack),
desacoplado de cartas — e sua primeira adaptação: **dominó**.

A premissa de design, em uma frase: pegue um jogo que todo mundo já conhece, transforme
cada jogada num motor de pontuação `base × multiplicador`, deixe o jogador customizar esse
motor com uma coleção de modificadores escassos e sinérgicos, e jogue isso contra limiares
de pontuação que crescem exponencialmente, comprando peças numa loja entre rodadas. O prazer
está em montar uma combinação que **quebra a escala** do jogo.

A aposta de engenharia é separar o que é invariante (pontuação, economia, run, suco) do que
muda por jogo (o "tabuleiro"). O motor é escrito uma vez; cada jogo é um módulo plugável.

## Status

Especificação pronta, implementação a iniciar. Stack alvo: **TypeScript + Vitest**.

## Documentação

| Doc | O que é |
|-----|---------|
| [`CLAUDE.md`](CLAUDE.md) | As leis do projeto. Leia primeiro. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | A camada invariante: Resolver, Trace, DSL de efeitos. |
| [`docs/BOARD_CONTRACT.md`](docs/BOARD_CONTRACT.md) | O contrato que todo tabuleiro implementa. |
| [`docs/SANITY_TESTS.md`](docs/SANITY_TESTS.md) | Os testes que decidem se um config vale a pena jogar. |
| [`docs/DOMINOTRON.md`](docs/DOMINOTRON.md) | A adaptação concreta do dominó. |
| [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) | Em que ordem construir. |

## Princípio que governa tudo

O harness automatizado te diz que um jogo **não está quebrado** — nunca que é **divertido**.
A diversão se mede jogando à mão. O propósito de toda a automação é garantir que você nunca
gaste uma sessão de teste num jogo que já era natimorto no papel.

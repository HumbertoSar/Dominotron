# CLAUDE.md

> Este arquivo é lido pelo Claude Code a cada sessão. Ele contém as **leis** do projeto.
> Detalhe fica nos docs (`docs/`). Aqui ficam só: o que é, as invariantes inegociáveis,
> as convenções e o mapa. Quando algo aqui conflitar com um doc, **este arquivo vence**.

## O que é

Um **motor de jogo do gênero "Balatro-like"** desacoplado de cartas, e a primeira
adaptação concreta: **Dominotron** (dominó). O gênero, abstraído de cartas, é:

> Um motor de pontuação escalável, alimentado por uma coleção de modificadores
> construída no improviso sob escassez de slots, jogado contra limiares de pontuação
> que crescem exponencialmente, com economia de loja entre rodadas, dentro de uma run
> com permadeath — tudo sobre um substrato de regras que o jogador já conhece.

A meta de engenharia: **a camada de pontuação/economia/run/suco é escrita uma vez
(invariante); o "tabuleiro" é um módulo plugável.** Dominó é o primeiro módulo.

## As 12 leis (invariantes inegociáveis)

Estas não são preferências. Cada teste de sanidade do harness existe para defender
uma delas. Violar qualquer uma quebra o harness ou o gênero.

1. **O tabuleiro NUNCA calcula pontuação.** Ele só emite `baseValue + tags + entities`
   via `ScoringContext`. Quem transforma isso em pontos é o Resolver. (ver `BOARD_CONTRACT.md`)
2. **Pontuação é sempre `chips × mult`.** Base e multiplicador são números separados
   até a multiplicação final. Nunca os funda antes.
3. **O Resolver é uma função pura e determinística.** Mesma entrada + mesma seed ⇒
   mesma saída. Sem I/O, sem `Date.now()`, sem `Math.random()` solto.
4. **Toda aleatoriedade vem de uma seed explícita.** Um único serviço de RNG semeado.
   Runs são reproduzíveis.
5. **O Resolver produz um `Trace`, não só um número.** O Trace é um log ordenado de
   cada operação com sua origem. A pontuação final é o fim do Trace. (ver `ARCHITECTURE.md`)
6. **O suco consome o Trace; nunca o produz.** Apresentação é um consumidor puro do
   Trace. Em teste, o apresentador é no-op. O motor roda headless.
7. **Modificadores são dados, não código.** JSON declarativo com `trigger` + `effects`.
   Nada de funções arbitrárias num modificador.
8. **A DSL de efeitos é fechada e pequena.** Só as ops listadas em `ARCHITECTURE.md`.
   Precisa de algo novo? Estenda o vocabulário de tags ou adicione uma op **nomeada**.
   **NUNCA** `eval()` nem efeito como string executável — isso mata os testes T4/T5/T8.
9. **Slots ativos são limitados.** Default 5. A escassez é o que transforma "colecionar"
   em "decidir".
10. **Modificadores resolvem em ordem de slot, sequencialmente.** A não-comutatividade
    é profundidade de build, não bug. (ver T8)
11. **Headless-first, suco por último.** Ordem de construção é sagrada: motor puro →
    board → harness de testes → CLI de terminal → só então apresentador/suco. (ver `BUILD_PLAN.md`)
12. **O harness prova que NÃO está quebrado, não que é divertido.** Verde em tudo
    significa "vale jogar à mão", não "é bom". A diversão só se mede jogando.

## Convenções

- **Linguagem:** TypeScript (strict). Testes em **Vitest**.
- **Idioma:** prosa/comentários longos em PT-BR; **identificadores, tipos, nomes de
  arquivo e nomes de teste em inglês.**
- **Pureza:** o pacote `engine/` não importa nada de I/O, DOM, nem relógio/RNG global.
- **Tipos primeiro:** defina os tipos do contrato antes da lógica. Os tipos são a espec.
- **Sem dependências pesadas no `engine/`.** Mantenha o núcleo sem libs de runtime.
- **Determinismo testável:** todo teste que usa RNG passa uma seed fixa.

## Mapa do repositório

```
CLAUDE.md            ← você está aqui: leis + índice
README.md            ← orientação humana rápida
docs/
  ARCHITECTURE.md    ← camada invariante: Resolver, Trace, DSL, os 6 componentes
  BOARD_CONTRACT.md  ← interface BoardModule + ScoringContext + invariantes do board
  SANITY_TESTS.md    ← T0–T9: o que cada um afirma, limiares, report-card
  DOMINOTRON.md      ← a espec concreta do dominó (base×mult, mods, curva, loja, suco)
  BUILD_PLAN.md      ← milestones em ordem de dependência, cada um testável
src/                 ← (a criar) engine/ + boards/ + harness/ + cli/ + presenter/
```

## Como rodar (alvo)

```
npm install
npm test            # roda Vitest (unit + sanity headless)
npm run play        # CLI: joga uma run no terminal (sem suco)
npm run harness -- --board domino --seeds 200   # gera o report-card de um config
```

## Onde começar

Leia `BUILD_PLAN.md` e comece pelo **Milestone 0**. Não pule a ordem da Lei 11.
Não construa apresentação/suco até o motor headless passar em T2/T3/T4 com o dominó.

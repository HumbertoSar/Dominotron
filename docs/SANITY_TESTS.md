# SANITY_TESTS.md — o harness

> O harness prova que um config **não está quebrado**, nunca que é **divertido** (Lei 12).
> Seu propósito é garantir que você só gaste sessões de teste à mão em jogos que já passaram
> nos crivos mecânicos. Tudo roda sobre o `Trace` headless — sem renderizar nada.

Organizados por custo. Cada teste cita o gene/lei que defende.

## Estáticos (rodam a cada save do config; milissegundos)

### T5 — Densidade de sinergia *(gene: sinergia emergente)*
- **Afirma:** ≥ 1/3 dos modificadores são sinérgicos — trigger ou efeito referencia outro
  modificador, ou uma tag do board, e não só um bônus chapado.
- **Também checa o grafo de vocabulário:** nenhum modificador aponta para tag fora de
  `declareTagVocabulary()`; nenhuma tag emitida fica sem leitor (vocabulário morto).
- **Como:** análise estática dos `trigger`/`effects`. Sem simulação.

### T9 — Determinismo *(higiene do harness)*
- **Afirma:** mesma seed + mesmas ações ⇒ `Trace` idêntico (deep-equal).
- Protege a validade de todos os outros testes e a feature de "seed do dia".

## Simulação (Monte Carlo sobre N seeds; segundos)

### T3 — "Jogar limpo falha" *(gene: limiar crescente — O TESTE MAIS IMPORTANTE)*
- **Setup:** `greedyBaseAgent` com **zero modificadores**, N seeds.
- **Afirma:** morre entre **25% e 45%** do progresso da run.
- **Diagnóstico:** sobreviveu além de ~50% ⇒ curva fácil demais OU motor aditivo demais.
  Morreu antes de ~15% ⇒ base fraca demais, piso sem graça.

### T2 — Motor multiplicativo, não aditivo *(gene: motor multiplicativo)*
- **Setup:** Monte Carlo com aquisição aleatória de modificadores.
- **Afirma:** razão **p95/p50** da pontuação por rodada excede um limiar alto (cauda pesada =
  crescimento multiplicativo). Pools aditivos dão cauda fina.
- **Também:** existe ≥1 op `mul_mult` alcançável dentro de um orçamento plausível.

### T4 — Existe build que quebra o jogo, e é alcançável *(gene: sinergia)*
- **Setup:** busca limitada (synergy-climber) sobre o grafo de modificadores.
- **Afirma:** existe um conjunto de ≤ slots, comprável dentro de um orçamento plausível, que
  bate o limiar final **com folga** — E não é o único caminho (cruza com T6).

### T6 — Sem estratégia dominante / diversidade de builds *(gene: sinergia)*
- **Setup:** Monte Carlo com `synergyAgent`; clusteriza runs vencedoras por quais
  modificadores carregaram a vitória.
- **Afirma:** ≥ 3 arquétipos distintos vencem. Nenhum modificador aparece em > 90% das vitórias.
- **Diagnóstico:** um mod em quase toda vitória ⇒ dominante ⇒ achatar.

### T7 — Solvência econômica *(gene: economia/loja)*
- **Setup:** simula a curva de limiares contra renda esperada e preços de loja, com `synergyAgent`.
- **Afirma:** win-rate cai numa banda-alvo (ex.: **20%–60%**). 0% = invencível; ~100% = trivial.
- É o portão "isto está minimamente tunado?".

### T8 — Sensibilidade à ordem (profundidade) *(gene: sinergia)*
- **Setup:** permuta a ordem dos slots de uma mesma coleção e mede variância da pontuação.
- **Afirma:** ordem muda o resultado materialmente.
- **Diagnóstico:** ordem não importa ⇒ ops todas comutativas (tudo aditivo) ⇒ sem profundidade
  de arranjo. Proxy automatizável de "existe decisão real na montagem da coleção?".

## Manual (não automatizável — não finja que é)

### T1 — Reconhecibilidade do substrato *(gene: substrato familiar)*
- **Pergunta:** quem conhece o jogo original reconhece em < 30s?
- Julgamento humano. Mas é um check de 30 segundos, não uma sessão.

### T0 — É divertido?
- O harness te diz que o config não está quebrado. É incapaz de dizer que é delicioso.
- **A feel-time é obrigatória e insubstituível.** O harness só garante que você nunca a gasta
  num natimorto.

## Dependência crítica: a qualidade da simulação = a qualidade dos agentes de referência

Um `synergyAgent` burro subestima tetos e gera **falso-negativo** em T4/T6 ("não achei build
quebrada" quando ela existe). Escrever um synergy-climber decente é o trabalho não-trivial real
deste harness, e é parcialmente por jogo. Trate-o como código de primeira classe, com seus
próprios testes. É o maior risco do plano.

## A saída: o report-card de uma tela

Por config, o harness imprime um cartão lido em 10 segundos. Vereditos:
🟢 passou · 🟡 jogável mas revisar · 🔴 reprovado (se for item do MANTER, nem abre).

```
CONFIG: dominotron_v1            VEREDITO: 🟡 jogável, revisar T6

T2 multiplicativo   🟢  p95/p50 = 41x
T3 morte limpa      🟢  morre em 38% da run
T4 build quebra     🟢  {Numerologo+Canhoto+Curinga6} -> 4.2x o limiar final
T5 sinergia         🟢  44% dos mods sinergicos; vocabulario sem orfaos
T6 diversidade      🟡  2 arquetipos (alvo: 3) — "Serpente" domina 71% das vitorias
T7 win-rate         🟢  34%
T8 ordem importa    🟢  variancia por permutacao alta
T9 determinismo     🟢

-> manual pendente: T1 (reconhecivel?), T0 (divertido?)
```

**Regra de decisão:** 🔴 em qualquer item do MANTER (T2, T3, T4, T5, mais reconhecibilidade
T1) ⇒ não abre, volta pro config. Tudo 🟢/🟡 ⇒ abre e joga à mão (T0).

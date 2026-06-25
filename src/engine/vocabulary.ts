// Validacao estatica do vocabulario de tags (semente do T5).
//
// Afirma duas coisas, sem simular nada:
//  1. nenhum modificador referencia uma tag fora de declareTagVocabulary();
//  2. nenhuma tag declarada fica sem leitor ("vocabulario morto" / tag orfa).
//
// Analise puramente estatica dos triggers e effects.

import type { TagSpec } from './board'
import type { Modifier, Predicate } from './types'

/** Coleta as chaves de tag lidas por um trigger (recursivo). */
function tagsReadByPredicate(pred: Predicate, acc: Set<string>): void {
  switch (pred.kind) {
    case 'has_tag':
      acc.add(pred.tag)
      break
    case 'tag_value':
      acc.add(pred.tag)
      break
    case 'entity_count':
      acc.add(pred.key)
      break
    case 'and':
    case 'or':
      pred.preds.forEach((p) => tagsReadByPredicate(p, acc))
      break
    case 'not':
      tagsReadByPredicate(pred.pred, acc)
      break
    case 'always':
    case 'run':
      break
  }
}

/** Coleta todas as chaves de tag que um modificador le (trigger + queries dos effects). */
function tagsReadByModifier(mod: Modifier, acc: Set<string>): void {
  tagsReadByPredicate(mod.trigger, acc)
  for (const effect of mod.effects) {
    if (effect.query) acc.add(effect.query.key)
  }
}

export interface VocabularyReport {
  ok: boolean
  /** Tags referenciadas por algum modificador mas nao declaradas pelo board. */
  undeclaredRefs: string[]
  /** Tags declaradas que nenhum modificador le (vocabulario morto). */
  orphanTags: string[]
}

/** Valida o pool de modificadores contra o vocabulario declarado por um board. */
export function validateVocabulary(vocabulary: TagSpec[], modifiers: Modifier[]): VocabularyReport {
  const declared = new Set(vocabulary.map((t) => t.key))

  const read = new Set<string>()
  for (const mod of modifiers) tagsReadByModifier(mod, read)

  const undeclaredRefs = [...read].filter((key) => !declared.has(key)).sort()
  const orphanTags = [...declared].filter((key) => !read.has(key)).sort()

  return {
    ok: undeclaredRefs.length === 0 && orphanTags.length === 0,
    undeclaredRefs,
    orphanTags,
  }
}

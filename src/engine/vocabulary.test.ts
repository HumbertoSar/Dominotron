import { describe, expect, it } from 'vitest'
import type { TagSpec } from './board'
import type { Modifier } from './types'
import { validateVocabulary } from './vocabulary'

function mod(id: string, partial: Partial<Modifier>): Modifier {
  return {
    id,
    name: id,
    rarity: 'common',
    cost: 0,
    slotType: 'standard',
    trigger: { kind: 'always' },
    effects: [],
    ...partial,
  }
}

const vocab: TagSpec[] = [{ key: 'value_sum' }, { key: 'is_double' }, { key: 'contains' }]

describe('validateVocabulary', () => {
  it('aprova quando todas as tags lidas sao declaradas e nenhuma fica orfa', () => {
    const mods = [
      mod('a', { trigger: { kind: 'tag_value', tag: 'value_sum', cmp: '>=', value: 9 } }),
      mod('b', { trigger: { kind: 'has_tag', tag: 'is_double' } }),
      mod('c', {
        effects: [{ op: 'add_mult_per', args: [2], query: { target: 'tag', key: 'contains', value: 6 } }],
      }),
    ]
    const report = validateVocabulary(vocab, mods)
    expect(report.ok).toBe(true)
    expect(report.undeclaredRefs).toEqual([])
    expect(report.orphanTags).toEqual([])
  })

  it('acusa referencia a tag nao declarada', () => {
    const mods = [mod('x', { trigger: { kind: 'has_tag', tag: 'played_left' } })]
    const report = validateVocabulary(vocab, mods)
    expect(report.ok).toBe(false)
    expect(report.undeclaredRefs).toContain('played_left')
  })

  it('acusa tag orfa (declarada mas sem leitor)', () => {
    const mods = [mod('only', { trigger: { kind: 'has_tag', tag: 'is_double' } })]
    const report = validateVocabulary(vocab, mods)
    expect(report.ok).toBe(false)
    expect(report.orphanTags).toContain('value_sum')
    expect(report.orphanTags).toContain('contains')
  })

  it('le tags dentro de and/or/not', () => {
    const mods = [
      mod('nested', {
        trigger: {
          kind: 'and',
          preds: [
            { kind: 'has_tag', tag: 'is_double' },
            { kind: 'or', preds: [{ kind: 'has_tag', tag: 'value_sum' }, { kind: 'not', pred: { kind: 'has_tag', tag: 'contains' } }] },
          ],
        },
      }),
    ]
    const report = validateVocabulary(vocab, mods)
    expect(report.orphanTags).toEqual([]) // todas as 3 foram lidas
  })
})

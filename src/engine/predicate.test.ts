import { describe, expect, it } from 'vitest'
import { compare, evaluatePredicate } from './predicate'
import { makeCtx, makeRun, tag } from './test-helpers'

const run = makeRun({ ante: 3, blind: 2, money: 7 })

describe('compare', () => {
  it('cobre todos os operadores', () => {
    expect(compare(5, '==', 5)).toBe(true)
    expect(compare(5, '!=', 4)).toBe(true)
    expect(compare(5, '>', 4)).toBe(true)
    expect(compare(5, '>=', 5)).toBe(true)
    expect(compare(4, '<', 5)).toBe(true)
    expect(compare(5, '<=', 5)).toBe(true)
    expect(compare(5, '<', 5)).toBe(false)
  })
})

describe('evaluatePredicate', () => {
  it('always e sempre verdadeiro', () => {
    expect(evaluatePredicate({ kind: 'always' }, makeCtx(), run)).toBe(true)
  })

  it('has_tag verifica presenca de tag', () => {
    const ctx = makeCtx({ tags: [tag('is_double')] })
    expect(evaluatePredicate({ kind: 'has_tag', tag: 'is_double' }, ctx, run)).toBe(true)
    expect(evaluatePredicate({ kind: 'has_tag', tag: 'is_even' }, ctx, run)).toBe(false)
  })

  it('tag_value compara o valor da tag', () => {
    const ctx = makeCtx({ tags: [tag('value_sum', 9)] })
    expect(evaluatePredicate({ kind: 'tag_value', tag: 'value_sum', cmp: '>=', value: 9 }, ctx, run)).toBe(true)
    expect(evaluatePredicate({ kind: 'tag_value', tag: 'value_sum', cmp: '>', value: 9 }, ctx, run)).toBe(false)
  })

  it('tag_value e falso quando a tag nao existe ou nao tem valor', () => {
    const ctx = makeCtx({ tags: [tag('is_double')] })
    expect(evaluatePredicate({ kind: 'tag_value', tag: 'value_sum', cmp: '>=', value: 1 }, ctx, run)).toBe(false)
    expect(evaluatePredicate({ kind: 'tag_value', tag: 'is_double', cmp: '>=', value: 0 }, ctx, run)).toBe(false)
  })

  it('entity_count conta entities com a chave', () => {
    const ctx = makeCtx({
      entities: [
        { id: 'a', tags: [tag('contains', 6)] },
        { id: 'b', tags: [tag('contains', 6)] },
      ],
    })
    expect(evaluatePredicate({ kind: 'entity_count', key: 'contains', cmp: '==', value: 2 }, ctx, run)).toBe(true)
  })

  it('run compara campos do estado da run', () => {
    expect(evaluatePredicate({ kind: 'run', field: 'money', cmp: '>=', value: 5 }, makeCtx(), run)).toBe(true)
    expect(evaluatePredicate({ kind: 'run', field: 'ante', cmp: '<', value: 3 }, makeCtx(), run)).toBe(false)
  })

  it('and / or / not compoem', () => {
    const ctx = makeCtx({ tags: [tag('is_double'), tag('value_sum', 12)] })
    const isDouble = { kind: 'has_tag', tag: 'is_double' } as const
    const highSum = { kind: 'tag_value', tag: 'value_sum', cmp: '>=', value: 10 } as const

    expect(evaluatePredicate({ kind: 'and', preds: [isDouble, highSum] }, ctx, run)).toBe(true)
    expect(evaluatePredicate({ kind: 'or', preds: [isDouble, { kind: 'has_tag', tag: 'nope' }] }, ctx, run)).toBe(true)
    expect(evaluatePredicate({ kind: 'not', pred: isDouble }, ctx, run)).toBe(false)
  })
})

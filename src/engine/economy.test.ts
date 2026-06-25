import { describe, expect, it } from 'vitest'
import { interest, resourceLeftover, settleBlind, totalBlindReward } from './economy'
import { addRoundScore, createRun, totalBlinds } from './run'
import { makeConfig } from './test-helpers'

const config = makeConfig()

describe('juros', () => {
  it('+1 a cada `per`, com teto', () => {
    expect(interest(0, 5, 5)).toBe(0)
    expect(interest(3, 5, 5)).toBe(0)
    expect(interest(10, 5, 5)).toBe(2)
    expect(interest(100, 5, 5)).toBe(5) // teto
  })

  it('per <= 0 nao gera juros', () => {
    expect(interest(50, 0, 5)).toBe(0)
  })
})

describe('sobra de recursos', () => {
  it('soma os recursos nao usados', () => {
    expect(resourceLeftover({ plays: 8, redraws: 3 })).toBe(11)
    expect(resourceLeftover({})).toBe(0)
  })
})

describe('recompensa total', () => {
  it('= base do tipo + juros + sobra', () => {
    // blind 1 = small (base 3); money 10 -> juros 2; recursos 8+3 -> sobra 11
    const s = { ...createRun(config, 1), money: 10 }
    expect(totalBlindReward(config, s)).toBe(3 + 2 + 11)
  })
})

describe('settleBlind — transicao de fim de blind', () => {
  it('vitoria paga a recompensa, avanca e reseta os recursos', () => {
    const s = addRoundScore({ ...createRun(config, 1), money: 10 }, 20) // limiar 18: venceu
    const reward = totalBlindReward(config, s)
    const out = settleBlind(config, s)

    expect(out.won).toBe(true)
    expect(out.reward).toBe(reward)
    expect(out.state.money).toBe(10 + reward)
    expect(out.state.blindIndex).toBe(2)
    expect(out.state.roundScore).toBe(0)
    expect(out.state.resources).toEqual({ plays: 8, redraws: 3 }) // resetou
    expect(out.state.status).toBe('playing')
  })

  it('derrota encerra a run (permadeath)', () => {
    const s = addRoundScore(createRun(config, 1), 5) // limiar 18: perdeu
    const out = settleBlind(config, s)
    expect(out.won).toBe(false)
    expect(out.state.status).toBe('dead')
  })

  it('vencer a ultima blind vence a run', () => {
    const last = totalBlinds(config.thresholdCurve)
    const s = addRoundScore({ ...createRun(config, 1), blindIndex: last }, 1_000_000)
    const out = settleBlind(config, s)
    expect(out.won).toBe(true)
    expect(out.state.status).toBe('won')
    expect(out.state.blindIndex).toBe(last) // nao avanca alem do fim
  })
})

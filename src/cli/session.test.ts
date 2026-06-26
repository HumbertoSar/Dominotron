import { describe, expect, it } from 'vitest'
import { defaultDominoConfig } from '../boards/domino/config'
import { playSession, type CliIO } from './session'

const config = defaultDominoConfig()

/** IO que coleta o que foi impresso e responde via uma funcao roteirizada. */
function scriptedIO(answer: (question: string) => string): { io: CliIO; out: string[] } {
  const out: string[] = []
  const io: CliIO = {
    print: (line) => out.push(line),
    ask: async (question) => answer(question),
  }
  return { io, out }
}

describe('playSession — modo auto', () => {
  it('joga uma run inteira ate o desfecho (vence ou morre)', async () => {
    const { io, out } = scriptedIO(() => '')
    const result = await playSession(config, 7, io, { auto: true })

    expect(['won', 'dead']).toContain(result)
    const text = out.join('\n')
    expect(text).toContain('DOMINOTRON')
    expect(text).toContain('BASE') // o Trace textual aparece
    expect(text).toMatch(/= \d+ pontos/) // e mostra a pontuacao final de jogadas
    expect(text).toMatch(/💀 Fim da run|🏆 Run completa/)
  })

  it('e deterministico na seed (mesma seed -> mesmo desfecho e mesmo log)', async () => {
    const a = scriptedIO(() => '')
    const b = scriptedIO(() => '')
    const ra = await playSession(config, 7, a.io, { auto: true })
    const rb = await playSession(config, 7, b.io, { auto: true })
    expect(ra).toBe(rb)
    expect(a.out).toEqual(b.out)
  })

  it('o Trace mostra a ORIGEM dos pontos (base + modificadores)', async () => {
    const { io, out } = scriptedIO(() => '')
    await playSession(config, 7, io, { auto: true })
    const text = out.join('\n')
    // ao longo da run o agente compra mods; algum deles deve aparecer no Trace
    expect(text).toMatch(/martelo|mirror_engine|even_steven|serpente|colecionador/)
  })
})

describe('playSession — interativo (input roteirizado)', () => {
  it('joga sempre a 1a acao e sai da loja, completando a run', async () => {
    // responde '1' para jogadas e '' para sair da loja
    const { io, out } = scriptedIO((q) => (q.includes('loja') ? '' : '1'))
    const result = await playSession(config, 3, io)

    expect(['won', 'dead']).toContain(result)
    const text = out.join('\n')
    expect(text).toContain('mao:')
    expect(text).toMatch(/✅ blind vencida|❌ blind perdida/)
  })
})

// cli/ — jogar uma run no terminal, sem suco (M5, ver docs/BUILD_PLAN.md).
//
// Texto puro: mostra mao, pontas, limiar, mods ativos; aceita jogar peca/redraw; abre a
// loja entre blinds; imprime o Trace como texto. O objetivo e sentir as DECISOES o quanto
// antes, antes de qualquer apresentacao/suco (Lei 11).
//
// Uso: npm run play -- --seed 123        (interativo)
//      npm run play -- --seed 123 --auto (o agente joga; demo/verificacao)

import { createInterface } from 'node:readline/promises'
import { defaultDominoConfig } from '../boards/domino/config'
import { playSession, type CliIO } from './session'

interface Args {
  seed: number
  auto: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { seed: 1, auto: false }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--seed' && argv[i + 1]) {
      args.seed = Number(argv[i + 1]) || args.seed
      i++
    } else if (flag === '--auto') {
      args.auto = true
    }
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const config = defaultDominoConfig()

  if (args.auto) {
    // Sem readline: o agente joga; so imprimimos.
    const io: CliIO = {
      print: (line) => console.log(line),
      ask: async () => '',
    }
    await playSession(config, args.seed, io, { auto: true })
    return
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const io: CliIO = {
    print: (line) => console.log(line),
    ask: (question) => rl.question(question),
  }
  try {
    await playSession(config, args.seed, io)
  } finally {
    rl.close()
  }
}

void main()

export {}

// harness/ — os testes de sanidade T0–T9 (ver docs/SANITY_TESTS.md).
//
// Roda sobre simulacoes headless, sem renderizar nada. Prova que um config NAO esta
// quebrado — nunca que e divertido (Lei 12). Imprime o report-card de uma tela.
//
// Uso: npm run harness -- --board domino --seeds 200

import { defaultDominoConfig } from '../boards/domino/config'
import { formatReportCard } from './report'
import { runCheapSanitySuite } from './sanity'

interface Args {
  board: string
  seeds: number
}

function parseArgs(argv: string[]): Args {
  const args: Args = { board: 'domino', seeds: 200 }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (flag === '--board' && value) {
      args.board = value
      i++
    } else if (flag === '--seeds' && value) {
      args.seeds = Math.max(1, Number(value) || args.seeds)
      i++
    }
  }
  return args
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.board !== 'domino') {
    console.error(`Board desconhecido: ${args.board} (apenas 'domino' por ora)`)
    process.exitCode = 1
    return
  }

  const config = defaultDominoConfig()
  const results = runCheapSanitySuite(config, args.seeds)
  const card = formatReportCard(`dominotron_v1 (${args.seeds} seeds)`, results)
  console.log(card)
}

main()

export {}

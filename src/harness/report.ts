// O report-card de uma tela (formato em SANITY_TESTS.md).
//
// Veredito por item: 🟢 passou · 🟡 jogavel mas revisar · 🔴 reprovado.
// Veredito geral: 🔴 se qualquer item do MANTER reprovar; senao 🟡 se algum amarelo; senao 🟢.

import type { SanityResult, Verdict } from './sanity'

const ICON: Record<Verdict, string> = { green: '🟢', yellow: '🟡', red: '🔴' }

/** Itens do MANTER: um 🔴 aqui significa "nem abre, volta pro config". */
const KEEP = new Set(['T2', 'T3', 'T5'])

function overallVerdict(results: SanityResult[]): { icon: string; note: string } {
  const keepRed = results.find((r) => KEEP.has(r.id) && r.verdict === 'red')
  if (keepRed) return { icon: '🔴', note: `reprovado em ${keepRed.id} (item do MANTER)` }
  const anyRed = results.find((r) => r.verdict === 'red')
  if (anyRed) return { icon: '🟡', note: `revisar ${anyRed.id}` }
  const anyYellow = results.find((r) => r.verdict === 'yellow')
  if (anyYellow) return { icon: '🟡', note: `revisar ${anyYellow.id}` }
  return { icon: '🟢', note: 'tudo verde' }
}

/** Monta o cartao como string (uma tela, lido em 10s). */
export function formatReportCard(configName: string, results: SanityResult[]): string {
  const overall = overallVerdict(results)
  const lines: string[] = []
  lines.push(`CONFIG: ${configName}            VEREDITO: ${overall.icon} ${overall.note}`)
  lines.push('')
  for (const r of results) {
    const label = `${r.id} ${r.name}`.padEnd(20)
    lines.push(`${label} ${ICON[r.verdict]}  ${r.detail}`)
  }
  lines.push('')
  lines.push('-> manual pendente: T1 (reconhecivel?), T0 (divertido?)')
  lines.push('-> automatizado pendente (Parte 2): T4 (build quebra), T6 (diversidade), T7 (win-rate)')
  return lines.join('\n')
}

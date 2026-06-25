import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // M0: o harness de testes precisa ficar verde mesmo com 0 testes (ver BUILD_PLAN.md, DoD).
    // A partir do M1 os testes reais comecam a chegar.
    passWithNoTests: true,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
})

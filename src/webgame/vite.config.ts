import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Build do jogo como ARQUIVO UNICO (JS+CSS inline) — abre via file:// sem servidor.
export default defineConfig({
  plugins: [viteSingleFile()],
})

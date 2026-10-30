import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { Agent } from 'node:https'
import { fileURLToPath } from 'node:url'

const apiTarget = process.env.API_PROXY_TARGET || 'https://127.0.0.1:8000'
if (new URL(apiTarget).protocol !== 'https:') throw new Error('API_PROXY_TARGET must use HTTPS')
const tlsFile = (name: string) => readFileSync(fileURLToPath(new URL(`../.local/tls/${name}`, import.meta.url)))

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    https: command === 'serve' ? {
      key: tlsFile('server.key'), cert: tlsFile('server.crt'),
      minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3',
    } : undefined,
    proxy: {
      ...Object.fromEntries(['/api', '/docs', '/openapi.json', '/redoc'].map(path => [path, {
        target: apiTarget, changeOrigin: false, secure: true,
        agent: command === 'serve' ? new Agent({
          ca: tlsFile('ca.crt'), rejectUnauthorized: true,
          minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3',
        }) : undefined,
      }])),
    },
  },
}))

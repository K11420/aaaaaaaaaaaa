import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 4103,
    allowedHosts: ['.trycloudflare.com', 'localhost', '127.0.0.1']
  },
  preview: {
    host: '0.0.0.0',
    port: 4103,
    allowedHosts: ['.trycloudflare.com', 'localhost', '127.0.0.1']
  }
})

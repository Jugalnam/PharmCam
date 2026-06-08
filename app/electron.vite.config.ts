import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// 개발 서버(dev)에서만 index.html의 메타 CSP를 완화한다.
// Vite의 Fast Refresh(inline script)·HMR(ws://localhost)이 'self'-only CSP에 막혀
// 흰 화면이 되는 것을 방지. 빌드(ctx.server 없음) 시에는 원본 엄격 CSP를 그대로 둔다.
function relaxCspInDev() {
  return {
    name: 'pharmcam-relax-csp-dev',
    transformIndexHtml: {
      order: 'pre' as const,
      handler(html: string, ctx: { server?: unknown }) {
        if (!ctx.server) return html
        return html.replace(
          /<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/,
          `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://localhost:* http://localhost:*" />`
        )
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer')
      }
    },
    plugins: [react(), relaxCspInDev()]
  }
})

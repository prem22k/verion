import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { createServer as createViteServer } from 'vite'
import { runVerification } from './agent/run-verification'

const host = '127.0.0.1'
export async function startVerionServer(port = 5173) {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' })
  const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/artifacts/workspace-template-mismatch.png') {
    try {
      const screenshot = await readFile(resolve('artifacts/workspace-template-mismatch.png'))
      response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' })
      response.end(screenshot)
    } catch {
      response.writeHead(404)
      response.end()
    }
    return
  }

  if (request.method === 'POST' && request.url === '/api/verify') {
    try {
      const result = await runVerification(`http://${host}:${port}/demo-target`)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(result))
    } catch (error: unknown) {
      response.writeHead(500, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Verification failed.' }))
    }
    return
  }

    vite.middlewares(request, response, () => {
      response.statusCode = 404
      response.end('Not found')
    })
  })

  await new Promise<void>((resolve) => server.listen(port, host, resolve))
  return {
    url: `http://${host}:${port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
      await vite.close()
    }
  }
}

if (process.argv[1]?.endsWith('server.ts')) {
  startVerionServer().then(({ url }) => console.log(`Verion is ready at ${url}`))
}

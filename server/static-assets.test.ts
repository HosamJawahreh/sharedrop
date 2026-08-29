/**
 * @vitest-environment node
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { tryServeStatic } from './static-assets.js'

describe('tryServeStatic', () => {
  const distRoot = path.join(process.cwd(), '.tmp-static-dist-test')

  beforeAll(() => {
    mkdirSync(path.join(distRoot, 'assets'), { recursive: true })
    writeFileSync(path.join(distRoot, 'index.html'), '<!doctype html><title>ShareDrop</title>')
    writeFileSync(path.join(distRoot, 'assets', 'app.js'), 'console.log(1)')
  })

  afterAll(() => {
    rmSync(distRoot, { recursive: true, force: true })
  })

  it('serves index.html for /', async () => {
    const server = createServer((req, res) => {
      if (!tryServeStatic(req, res, { distRoot })) {
        res.writeHead(404)
        res.end('missing')
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('no port')
    const response = await fetch(`http://127.0.0.1:${address.port}/`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/text\/html/)
    expect(await response.text()).toContain('ShareDrop')
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  })

  it('serves hashed assets under /assets/', async () => {
    const server = createServer((req, res) => {
      if (!tryServeStatic(req, res, { distRoot })) {
        res.writeHead(404)
        res.end('missing')
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('no port')
    const response = await fetch(`http://127.0.0.1:${address.port}/assets/app.js`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/javascript/)
    expect(await response.text()).toBe('console.log(1)')
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  })
})

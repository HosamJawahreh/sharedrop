/** Serve Vite production `dist/` from the signaling HTTP server (single-domain deploy). */

import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

function defaultDistRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

function resolveSafeFile(distRoot: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/')
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\//, '')
  const candidate = path.resolve(distRoot, relative)
  if (!candidate.startsWith(distRoot + path.sep) && candidate !== distRoot) {
    return null
  }
  return candidate
}

function sendFile(res: ServerResponse, filePath: string, urlPath: string): void {
  const type = contentTypeFor(filePath)
  const isHashedAsset = urlPath.startsWith('/assets/')
  res.writeHead(200, {
    'content-type': type,
    'cache-control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(filePath).pipe(res)
}

/**
 * Attempt to serve a static asset from Vite `dist/`.
 * Returns true when the response was handled (including SPA fallback).
 */
export function tryServeStatic(
  req: IncomingMessage,
  res: ServerResponse,
  options?: { distRoot?: string },
): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false
  }

  const distRoot = options?.distRoot ?? defaultDistRoot()
  if (!existsSync(distRoot)) {
    return false
  }

  const urlPath = req.url?.split('?')[0] ?? '/'
  const filePath = resolveSafeFile(distRoot, urlPath)
  if (!filePath) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return true
  }

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'content-type': contentTypeFor(filePath) })
      res.end()
      return true
    }
    sendFile(res, filePath, urlPath)
    return true
  }

  // SPA fallback — ShareDrop is a client-routed PWA shell.
  const indexPath = path.join(distRoot, 'index.html')
  if (!existsSync(indexPath)) {
    return false
  }
  if (req.method === 'HEAD') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end()
    return true
  }
  sendFile(res, indexPath, '/')
  return true
}

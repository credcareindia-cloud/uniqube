// Lets `node --test` run the studio's TypeScript directly: extensionless relative imports resolve
// to .ts, and JSON imports get the attribute Node requires. Node 22.18+ strips the types itself.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.(?:[cm]?[jt]s|json)$/.test(specifier)) {
    for (const ext of ['.ts', '/index.ts']) {
      const url = new URL(specifier + ext, context.parentURL)
      if (existsSync(fileURLToPath(url))) return next(url.href, context)
    }
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  if (url.endsWith('.json')) return next(url, { ...context, importAttributes: { type: 'json' } })
  return next(url, context)
}

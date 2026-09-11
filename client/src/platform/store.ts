/**
 * Browser-side persistence for the demo. The production app kept this state in
 * PostgreSQL behind a NestJS API; here it lives in localStorage so a visitor can
 * walk the whole request → approve → write-back loop and reset it at will.
 */
import { buildSeed, STORE_VERSION, type DemoStore } from './seed'

// EXPORTS: getStore, saveStore, resetDemoData, STORE_KEY

export const STORE_KEY = 'vpi-demo:store'

let cache: DemoStore | null = null

function read(): DemoStore | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoStore
    if (parsed.version !== STORE_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

export function getStore(): DemoStore {
  if (cache) return cache
  cache = read() ?? buildSeed()
  saveStore()
  return cache
}

export function saveStore(): void {
  if (!cache) return
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(cache))
  } catch {
    // storage unavailable (private mode, quota) — keep the in-memory copy
  }
}

export function resetDemoData(): void {
  cache = null
  try {
    localStorage.removeItem(STORE_KEY)
    Object.keys(localStorage)
      .filter((k) => k.startsWith('demo:'))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}

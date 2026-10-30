import assert from 'node:assert/strict'
import test from 'node:test'
import { employeeFetch } from '../src/api/userAuth.ts'

test('Concurrent expired requests share one refresh and retry with the new cookies', async () => {
  const originalFetch = globalThis.fetch
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() })
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  let refreshes = 0
  const attempts = new Map<string, number>()
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.endsWith('/refresh')) {
      refreshes++
      await gate
      return Response.json({ authenticated: true, user: {} })
    }
    const count = attempts.get(url) ?? 0
    attempts.set(url, count + 1)
    return new Response(null, { status: count === 0 ? 401 : 200 })
  }
  try {
    const first = employeeFetch('/api/patients')
    const second = employeeFetch('/api/patients/1/medical-record')
    await new Promise<void>((resolve) => setImmediate(resolve))
    release()
    assert.deepEqual((await Promise.all([first, second])).map((response) => response.status), [200, 200])
    assert.equal(refreshes, 1)
    assert.deepEqual([...attempts.values()], [2, 2])
  } finally {
    globalThis.fetch = originalFetch
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('Revoked refresh keeps the original 401 and notifies authentication state', async () => {
  const originalFetch = globalThis.fetch
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const events = new EventTarget()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events })
  let changed = false
  let calls = 0
  events.addEventListener('user-session-changed', () => { changed = true })
  globalThis.fetch = async () => { calls++; return Response.json({ detail: 'Session revoked' }, { status: 401 }) }
  try {
    assert.equal((await employeeFetch('/api/patients')).status, 401)
    assert.equal(calls, 2)
    assert.equal(changed, true)
  } finally {
    globalThis.fetch = originalFetch
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('A delayed old 401 retries without rotating an already refreshed token again', async () => {
  const originalFetch = globalThis.fetch
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() })
  let release!: () => void
  const delayed = new Promise<void>((resolve) => { release = resolve })
  const attempts = new Map<string, number>()
  let refreshes = 0
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.endsWith('/refresh')) { refreshes++; return Response.json({ authenticated: true, user: {} }) }
    const count = attempts.get(url) ?? 0
    attempts.set(url, count + 1)
    if (url === '/slow' && count === 0) await delayed
    return new Response(null, { status: count === 0 ? 401 : 200 })
  }
  try {
    const slow = employeeFetch('/slow')
    assert.equal((await employeeFetch('/fast')).status, 200)
    release()
    assert.equal((await slow).status, 200)
    assert.equal(refreshes, 1)
  } finally {
    globalThis.fetch = originalFetch
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

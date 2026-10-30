import assert from 'node:assert/strict'
import test from 'node:test'
import { adminFetch, getAdminAuthStatus } from '../src/api/adminAuth.ts'

test('Concurrent administrator requests rotate the token pair once', async () => {
  const original = globalThis.fetch
  let refreshes = 0
  const attempts = new Map<string, number>()
  globalThis.fetch = async input => {
    const url = String(input)
    if (url.endsWith('/refresh')) { refreshes++; return Response.json({ authenticated: true }) }
    const count = attempts.get(url) ?? 0
    attempts.set(url, count + 1)
    return new Response(null, { status: count === 0 ? 401 : 200 })
  }
  try {
    const responses = await Promise.all([adminFetch('/api/accounts'), adminFetch('/api/medical-workers')])
    assert.deepEqual(responses.map(response => response.status), [200, 200])
    assert.equal(refreshes, 1)
  } finally { globalThis.fetch = original }
})

test('Administrator status restores an expired access token through refresh', async () => {
  const original = globalThis.fetch
  let refreshed = false
  globalThis.fetch = async input => {
    if (String(input).endsWith('/refresh')) { refreshed = true; return Response.json({ authenticated: true }) }
    return Response.json({ configured: true, authenticated: refreshed })
  }
  try { assert.equal((await getAdminAuthStatus()).authenticated, true) }
  finally { globalThis.fetch = original }
})

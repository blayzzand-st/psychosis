export type AdminAuthStatus = {
  configured: boolean
  authenticated: boolean
  setup_pending: boolean
  totp_secret: string | null
  setup_expires_at: string | null
}

const request = async <T>(path: string, payload?: object): Promise<T> => {
  const response = await fetch(`/api/admin-auth/${path}`, {
    method: payload ? 'POST' : 'GET',
    credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000),
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Не удалось выполнить вход. Повторите попытку.')
  }
  return response.status === 204 ? undefined as T : response.json()
}

let pendingRefresh: Promise<unknown> | null = null
let refreshVersion = 0
export const refreshAdminSession = () => {
  if (!pendingRefresh) pendingRefresh = request('refresh', {})
    .then(value => { refreshVersion++; return value })
    .finally(() => { pendingRefresh = null })
  return pendingRefresh
}
export const adminFetch = async (input: RequestInfo | URL, options?: RequestInit) => {
  const version = refreshVersion
  let response = await fetch(input, options)
  if (response.status === 401) {
    try {
      if (version === refreshVersion) await refreshAdminSession()
      response = await fetch(input, options)
    } catch { /* Keep the original unauthorized response. */ }
  }
  return response
}
export const getAdminAuthStatus = async () => {
  const status = await request<AdminAuthStatus>('status')
  if (status.configured && !status.authenticated) {
    try { await refreshAdminSession(); return await request<AdminAuthStatus>('status') }
    catch { return status }
  }
  return status
}
export const startAdminSetup = (password: string, confirmation: string) =>
  request('setup/start', { password, password_confirmation: confirmation })
export const completeAdminSetup = (code: string) => request('setup/complete', { code })
export const cancelAdminSetup = () => request('setup/cancel', {})
export const loginAdministrator = (password: string, code: string) => request('login', { password, code })
export const logoutAdministrator = async () => {
  if (pendingRefresh) await pendingRefresh.catch(() => {})
  refreshVersion++
  return request('logout', {})
}

export const deleteAdministrator = async (password: string, code: string, confirmation: string) => {
  if (pendingRefresh) await pendingRefresh.catch(() => {})
  const response = await adminFetch('/api/admin-auth/account', {
    method: 'DELETE', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, code, confirmation }), signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Не удалось удалить администратора')
  }
  refreshVersion++
}

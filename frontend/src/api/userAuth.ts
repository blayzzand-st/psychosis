export type WorkerRole = 'doctor' | 'nurse' | 'laboratory-technician' | 'other'
export type CurrentUser = {
  account_id: string; username: string; worker_id: number; first_name: string; last_name: string
  role: WorkerRole; can_create: boolean; can_edit_record: boolean
}
export type UserStatus = { authenticated: boolean; user: CurrentUser | null }
let refreshVersion = 0

export const userAuthRequest = async (path: string, body?: object): Promise<UserStatus> => {
  const response = await fetch(`/api/user-auth/${path}`, {
    method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Не удалось выполнить вход')
  }
  if (path === 'login' || path === 'logout') refreshVersion++
  return response.status === 204 ? { authenticated: false, user: null } : response.json()
}

let pendingRefresh: Promise<UserStatus> | null = null
export const refreshUserSession = () => {
  if (!pendingRefresh) pendingRefresh = userAuthRequest('refresh', {})
    .then((status) => { refreshVersion++; return status })
    .finally(() => { pendingRefresh = null })
  return pendingRefresh
}

export const logoutUserSession = async () => {
  if (pendingRefresh) await pendingRefresh.catch(() => {})
  refreshVersion++
  return userAuthRequest('logout', {})
}

export const employeeFetch = async (input: RequestInfo | URL, options?: RequestInit) => {
  const startedAtVersion = refreshVersion
  let response = await fetch(input, options)
  if (response.status === 401) {
    try {
      if (refreshVersion === startedAtVersion) await refreshUserSession()
      response = await fetch(input, options)
    }
    catch { /* The original 401 is returned to the caller. */ }
    window.dispatchEvent(new Event('user-session-changed'))
  }
  return response
}

import { authenticatedFetch } from './authenticatedFetch'
export type UserAccount = {
  id: string
  username: string
  created_at: string
  updated_at: string
  is_active: boolean
  medical_worker_id: number | null
  medical_worker: {
    id: number
    first_name: string
    last_name: string
    is_deleted: boolean
  } | null
}

export type WorkerAccount = Omit<UserAccount, 'medical_worker'>
export type AccountCredentials = { account: WorkerAccount; password: string }

const accountRequest = async <T>(workerId: number, path = '', options: RequestInit = {}): Promise<T> => {
  const response = await authenticatedFetch(`/api/medical-workers/${workerId}/account${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    cache: 'no-store',
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Не удалось выполнить операцию с аккаунтом. Повторите попытку.')
  }
  return response.json()
}

export const getWorkerAccount = (id: number, signal: AbortSignal) => accountRequest<WorkerAccount | null>(id, '', { signal })
export const createWorkerAccount = (id: number, username: string) =>
  accountRequest<AccountCredentials>(id, '', { method: 'POST', body: JSON.stringify({ username }) })
export const resetWorkerPassword = (id: number) => accountRequest<AccountCredentials>(id, '/reset-password', { method: 'POST' })
export const setWorkerAccountActive = (id: number, isActive: boolean) =>
  accountRequest<WorkerAccount>(id, '', { method: 'PATCH', body: JSON.stringify({ is_active: isActive }) })

export const getAccounts = async (signal: AbortSignal): Promise<UserAccount[]> => {
  const response = await authenticatedFetch('/api/accounts', {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
  })
  if (!response.ok) throw new Error('Не удалось загрузить аккаунты')
  return response.json()
}

const accountAction = async (id: string, options: RequestInit): Promise<WorkerAccount | undefined> => {
  const response = await authenticatedFetch(`/api/accounts/${encodeURIComponent(id)}`, {
    ...options, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Не удалось изменить аккаунт. Повторите попытку.')
  }
  return response.status === 204 ? undefined : response.json()
}

export const changeAccountActive = async (id: string, isActive: boolean): Promise<WorkerAccount> =>
  (await accountAction(id, { method: 'PATCH', body: JSON.stringify({ is_active: isActive }) }))!
export const deleteAccount = (id: string) => accountAction(id, { method: 'DELETE' })

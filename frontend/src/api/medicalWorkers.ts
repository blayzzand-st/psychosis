import { authenticatedFetch } from './authenticatedFetch'
import type { MedicalWorkerPosition } from '../types/medicalWorkerPosition'
import type { MedicalWorkerRole } from '../types/medicalWorkerRole'

export type MedicalWorker = {
  id: number
  first_name: string
  last_name: string
  position: MedicalWorkerPosition
  is_deleted: boolean
  role: MedicalWorkerRole
}

export type MedicalWorkerWrite = Pick<MedicalWorker, 'first_name' | 'last_name' | 'position' | 'role'>
export type WorkerFieldErrors = Partial<Record<keyof MedicalWorkerWrite, string>>

export class MedicalWorkerApiError extends Error {
  status: number
  fieldErrors: WorkerFieldErrors

  constructor(status: number, message: string, fieldErrors: WorkerFieldErrors = {}) {
    super(message)
    this.name = 'MedicalWorkerApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

type ErrorBody = {
  detail?: string | { loc?: unknown[] }[]
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')

  const timeout = AbortSignal.timeout(10000)
  const response = await authenticatedFetch(`/api/medical-workers${path}`, {
    ...options,
    headers,
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
  })

  if (!response.ok) {
    const body: ErrorBody = await response.json().catch(() => ({}))
    const fieldErrors: WorkerFieldErrors = {}
    if (Array.isArray(body.detail)) {
      for (const issue of body.detail) {
        const field = issue.loc?.at(-1)
        if (field === 'role') fieldErrors.role = 'Выберите роль из списка.'
        else if (field === 'first_name' || field === 'last_name' || field === 'position') {
          fieldErrors[field] = 'Введите от 3 до 24 символов.'
        }
      }
    }
    const message = typeof body.detail === 'string'
      ? body.detail
      : 'Не удалось выполнить запрос. Проверьте данные и повторите попытку.'
    throw new MedicalWorkerApiError(response.status, message, fieldErrors)
  }

  if (response.status === 204) return undefined as T
  return response.json()
}

export const getMedicalWorkers = (signal: AbortSignal, includeDeleted = false) =>
  request<MedicalWorker[]>(includeDeleted ? '?include_deleted=true' : '', { signal })

export const getMedicalWorker = (id: number, signal: AbortSignal, includeDeleted = false) =>
  request<MedicalWorker>(`/${id}${includeDeleted ? '?include_deleted=true' : ''}`, { signal })

export const createMedicalWorker = (worker: MedicalWorkerWrite) =>
  request<MedicalWorker>('', { method: 'POST', body: JSON.stringify(worker) })

export const updateMedicalWorker = (id: number, worker: MedicalWorkerWrite) =>
  request<MedicalWorker>(`/${id}`, { method: 'PUT', body: JSON.stringify(worker) })

export const deleteMedicalWorker = (id: number) =>
  request<void>(`/${id}`, { method: 'DELETE' })

export const restoreMedicalWorker = (id: number) =>
  request<MedicalWorker>(`/${id}/restore`, { method: 'POST' })

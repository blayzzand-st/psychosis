export type Diagnosis = { id: number; code: string; name: string }
export type DiagnosisWrite = Pick<Diagnosis, 'code' | 'name'>
export type DiagnosisFieldErrors = Partial<Record<keyof DiagnosisWrite, string>>

export class DiagnosisApiError extends Error {
  status: number
  fieldErrors: DiagnosisFieldErrors

  constructor(status: number, message: string, fieldErrors: DiagnosisFieldErrors = {}) {
    super(message)
    this.name = 'DiagnosisApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const timeout = AbortSignal.timeout(10000)
  const response = await fetch(`/api/diagnoses${path}`, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const fieldErrors: DiagnosisFieldErrors = {}
    if (Array.isArray(body.detail)) {
      for (const issue of body.detail) {
        const field = issue.loc?.at(-1)
        if (field === 'code') fieldErrors.code = 'Код должен содержать 6 символов.'
        if (field === 'name') fieldErrors.name = 'Введите от 3 до 128 символов.'
      }
    }
    throw new DiagnosisApiError(
      response.status,
      typeof body.detail === 'string' ? body.detail : 'Не удалось выполнить запрос. Проверьте данные и повторите попытку.',
      fieldErrors,
    )
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export const getDiagnoses = (signal: AbortSignal) => request<Diagnosis[]>('', { signal })
export const getDiagnosis = (id: number, signal: AbortSignal) => request<Diagnosis>(`/${id}`, { signal })
export const createDiagnosis = (values: DiagnosisWrite) =>
  request<Diagnosis>('', { method: 'POST', body: JSON.stringify(values) })
export const updateDiagnosis = (id: number, values: DiagnosisWrite) =>
  request<Diagnosis>(`/${id}`, { method: 'PUT', body: JSON.stringify(values) })
export const deleteDiagnosis = (id: number) => request<void>(`/${id}`, { method: 'DELETE' })

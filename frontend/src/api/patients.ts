import { employeeFetch } from './userAuth'
import type { AdministrativeSex } from '../types/patient'

export type Patient = {
  id: number
  first_name: string
  last_name: string
  patronymic: string | null
  date_of_birth: string
  administrative_sex: AdministrativeSex
  comment: string
  has_medical_record: boolean
}

export type PatientWrite = Omit<Patient, 'id' | 'has_medical_record'>
export type PatientFieldErrors = Partial<Record<keyof PatientWrite, string>>

const fieldMessages: Record<keyof PatientWrite, string> = {
  first_name: 'Введите от 1 до 64 символов.',
  last_name: 'Введите от 1 до 64 символов.',
  patronymic: 'Допустимо не более 64 символов.',
  date_of_birth: 'Укажите корректную дату рождения, не позднее сегодняшней.',
  administrative_sex: 'Выберите административный пол: М, Ж или НУ.',
  comment: 'Допустимо не более 32 символов.',
}

export class PatientApiError extends Error {
  status: number
  fieldErrors: PatientFieldErrors

  constructor(status: number, message: string, fieldErrors: PatientFieldErrors = {}) {
    super(message)
    this.name = 'PatientApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const timeout = AbortSignal.timeout(10000)
  const response = await employeeFetch(`/api/patients${path}`, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const fieldErrors: PatientFieldErrors = {}
    if (Array.isArray(body.detail)) {
      for (const issue of body.detail) {
        const field = (Object.keys(fieldMessages) as (keyof PatientWrite)[])
          .find((name) => name === issue.loc?.at(-1))
        if (field) fieldErrors[field] = fieldMessages[field]
      }
    }
    throw new PatientApiError(
      response.status,
      typeof body.detail === 'string' ? body.detail : 'Не удалось выполнить запрос. Проверьте данные и повторите попытку.',
      fieldErrors,
    )
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export const getPatients = (signal: AbortSignal) => request<Patient[]>('', { signal })
export const getPatient = (id: number, signal: AbortSignal) => request<Patient>(`/${id}`, { signal })
export const createPatient = (values: PatientWrite) =>
  request<Patient>('', { method: 'POST', body: JSON.stringify(values) })
export const updatePatient = (id: number, values: PatientWrite) =>
  request<Patient>(`/${id}`, { method: 'PUT', body: JSON.stringify(values) })
export const deletePatient = (id: number) => request<void>(`/${id}`, { method: 'DELETE' })

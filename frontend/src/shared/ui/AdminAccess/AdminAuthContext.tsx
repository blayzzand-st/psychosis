import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getAdminAuthStatus, logoutAdministrator } from '../../../api/adminAuth'
import type { AdminAuthStatus } from '../../../api/adminAuth'
import { AdminAuthContext } from './useAdminAuth'

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AdminAuthStatus | null>(null)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try {
      const next = await getAdminAuthStatus()
      setStatus(next)
      setError('')
      return next
    } catch {
      setError('Не удалось проверить доступ. Проверьте соединение и повторите попытку.')
      throw new Error('Authentication status unavailable')
    }
  }, [])
  useEffect(() => {
    const update = () => { void refresh().catch(() => {}) }
    update()
    window.addEventListener('focus', update)
    window.addEventListener('administrator-session-expired', update)
    return () => {
      window.removeEventListener('focus', update)
      window.removeEventListener('administrator-session-expired', update)
    }
  }, [refresh])
  const logout = async () => {
    await logoutAdministrator()
    setStatus((previous) => previous ? { ...previous, authenticated: false } : previous)
  }
  return <AdminAuthContext.Provider value={{ status, error, refresh, logout }}>{children}</AdminAuthContext.Provider>
}

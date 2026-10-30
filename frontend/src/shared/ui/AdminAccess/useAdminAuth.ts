import { createContext, useContext } from 'react'
import type { AdminAuthStatus } from '../../../api/adminAuth'

type AdminAuth = {
  status: AdminAuthStatus | null
  error: string
  refresh: () => Promise<AdminAuthStatus>
  logout: () => Promise<void>
}
export const AdminAuthContext = createContext<AdminAuth | null>(null)
export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext)
  if (!context) throw new Error('AdminAuthProvider is required')
  return context
}

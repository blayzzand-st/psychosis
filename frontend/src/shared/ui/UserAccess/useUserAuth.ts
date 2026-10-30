import { createContext, useContext } from 'react'
import type { UserStatus } from '../../../api/userAuth'

export type UserAuth = { status: UserStatus | null; error: string; refresh: () => Promise<void> }
export const UserAuthContext = createContext<UserAuth | null>(null)
export const useUserAuth = () => {
  const value = useContext(UserAuthContext)
  if (!value) throw new Error('UserAuthProvider is required')
  return value
}

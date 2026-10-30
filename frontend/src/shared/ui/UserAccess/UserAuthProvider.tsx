import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { refreshUserSession, userAuthRequest } from '../../../api/userAuth'
import type { UserStatus } from '../../../api/userAuth'
import { UserAuthContext } from './useUserAuth'

export const UserAuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<UserStatus | null>(null)
  const [error, setError] = useState('')
  const revision = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++revision.current
    try {
      let next = await userAuthRequest('status')
      if (!next.authenticated) {
        try { next = await refreshUserSession() }
        catch { next = { authenticated: false, user: null } }
      }
      if (current === revision.current) { setStatus(next); setError('') }
    } catch { if (current === revision.current) setError('Не удалось проверить доступ. Повторите попытку.') }
  }, [])
  useEffect(() => {
    const update = () => { void refresh() }
    update()
    window.addEventListener('focus', update)
    window.addEventListener('user-session-changed', update)
    return () => {
      window.removeEventListener('focus', update)
      window.removeEventListener('user-session-changed', update)
    }
  }, [refresh])
  return <UserAuthContext.Provider value={{ status, error, refresh }}>{children}</UserAuthContext.Provider>
}

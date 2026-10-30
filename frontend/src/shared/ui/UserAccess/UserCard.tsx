import { useState } from 'react'
import Tooltip from '@mui/material/Tooltip'
import SvgIcon from '@mui/material/SvgIcon'
import Alert from '@mui/material/Alert'
import { logoutUserSession } from '../../../api/userAuth'
import { useUserAuth } from './useUserAuth'
import * as Styled from './UserCard.styles'

const roles = { doctor: 'Врач', nurse: 'Медсестра', 'laboratory-technician': 'Лаборант', other: 'Медработник' }
const UserCard = ({ compact = false }: { compact?: boolean }) => {
  const { status, refresh } = useUserAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const user = status?.user
  if (!user) return null
  const logout = async () => {
    setBusy(true)
    setError('')
    try { await logoutUserSession(); await refresh() }
    catch { setError('Не удалось выйти. Повторите попытку.') }
    finally { setBusy(false) }
  }
  return <Styled.Card data-compact={compact ? 'true' : undefined} aria-label="Текущий медработник">
    {compact ? <>
      <Styled.Avatar aria-hidden="true">{user.first_name[0]}</Styled.Avatar>
      <Styled.UserInfo>
        <Styled.Name>{user.first_name} {user.last_name}</Styled.Name>
        <Styled.Details>{user.username} · {roles[user.role]}</Styled.Details>
      </Styled.UserInfo>
    </> : <Styled.UserInfo><Styled.Identity><Styled.Avatar aria-hidden="true">{user.first_name[0]}</Styled.Avatar>
      <Styled.Name>{user.first_name} {user.last_name}</Styled.Name></Styled.Identity>
    <Styled.Details>{user.username} · {roles[user.role]}</Styled.Details></Styled.UserInfo>}
    {error && <Alert severity="error">{error}</Alert>}
    {compact ? <Tooltip title={busy ? 'Выход…' : 'Выйти'}>
      <span><Styled.ExitButton aria-label="Выйти" disabled={busy} onClick={logout}>
        <SvgIcon viewBox="0 0 24 24"><path d="M10 17v3H4V4h6v3M9 12h12m-4-4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></SvgIcon>
      </Styled.ExitButton></span>
    </Tooltip> : <Styled.SignOut variant="outlined" disabled={busy} onClick={logout}>
      {busy ? 'Выход…' : 'Выйти'}
    </Styled.SignOut>}
  </Styled.Card>
}
export default UserCard

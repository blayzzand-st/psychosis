import { useState } from 'react'
import type { FormEvent } from 'react'
import Alert from '@mui/material/Alert'
import TextField from '@mui/material/TextField'
import { Navigate, useLocation } from 'react-router'
import { userAuthRequest } from '../../api/userAuth'
import { useUserAuth } from '../../shared/ui/UserAccess/useUserAuth'
import * as Styled from './UserLogin.styles'

const UserLogin = () => {
  const { status, refresh } = useUserAuth()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const destination = typeof location.state?.returnTo === 'string'
    && location.state.returnTo.startsWith('/personal/') && !location.state.returnTo.startsWith('/personal/access')
    ? location.state.returnTo : '/personal'
  if (status?.authenticated) return <Navigate to={destination} replace />
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try { await userAuthRequest('login', { username, password }); setPassword(''); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось выполнить вход') }
    finally { setBusy(false) }
  }
  return <Styled.Card elevation={0} aria-labelledby="user-login-title">
    <Styled.Title id="user-login-title">Вход медработника</Styled.Title>
    <Styled.Description>Введите логин и пароль, полученные у администратора.</Styled.Description>
    <Styled.Form onSubmit={submit}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Логин" required value={username} onChange={(event) => setUsername(event.target.value)}
        autoComplete="username" disabled={busy} slotProps={{ htmlInput: { maxLength: 16 } }} />
      <TextField label="Пароль" type="password" required value={password} onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password" disabled={busy} slotProps={{ htmlInput: { maxLength: 128 } }} />
      <Styled.Action type="submit" variant="contained" disabled={busy}>{busy ? 'Проверка…' : 'Войти'}</Styled.Action>
      <Styled.HomeLink to="/">На главную</Styled.HomeLink>
    </Styled.Form>
  </Styled.Card>
}
export default UserLogin

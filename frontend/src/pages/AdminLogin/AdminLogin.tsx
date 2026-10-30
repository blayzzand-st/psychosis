import { useState } from 'react'
import type { FormEvent } from 'react'
import Alert from '@mui/material/Alert'
import TextField from '@mui/material/TextField'
import { Navigate, useLocation } from 'react-router'
import { cancelAdminSetup, completeAdminSetup, loginAdministrator, startAdminSetup } from '../../api/adminAuth'
import { useAdminAuth } from '../../shared/ui/AdminAccess/useAdminAuth'
import * as Styled from './AdminLogin.styles'

const AdminLogin = () => {
  const { status, refresh, error: connectionError } = useAdminAuth()
  const location = useLocation()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const destination = typeof location.state?.returnTo === 'string'
    && location.state.returnTo.startsWith('/administrator')
    && !location.state.returnTo.startsWith('/administrator/access') ? location.state.returnTo : '/administrator'
  if (status?.authenticated) return <Navigate to={destination} replace />
  if (!status) return <Styled.Card elevation={0}>
    {connectionError ? <><Alert severity="error">{connectionError}</Alert><Styled.Action onClick={() => { void refresh().catch(() => {}) }}>Повторить</Styled.Action></> : <p role="status">Проверка доступа…</p>}
  </Styled.Card>
  const configuring = !status.configured
  const verifying = configuring && status.setup_pending
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (configuring && !verifying && password !== confirmation) { setError('Пароли не совпадают'); return }
    setBusy(true)
    try {
      if (verifying) await completeAdminSetup(code)
      else if (configuring) await startAdminSetup(password, confirmation)
      else await loginAdministrator(password, code)
      setPassword('')
      setConfirmation('')
      setCode('')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось выполнить вход')
      setCode('')
      void refresh().catch(() => {})
    } finally { setBusy(false) }
  }
  const restart = async () => {
    setBusy(true)
    setError('')
    try { await cancelAdminSetup(); await refresh(); setCode(''); setCopied(false) }
    catch { setError('Не удалось начать настройку заново. Повторите попытку.') }
    finally { setBusy(false) }
  }
  const copySecret = async () => {
    try { await navigator.clipboard.writeText(status.totp_secret!); setCopied(true) }
    catch { setError('Не удалось скопировать секрет. Выделите и скопируйте строку вручную.') }
  }
  return <Styled.Card elevation={0} aria-labelledby="admin-login-title">
    <Styled.Title id="admin-login-title">{verifying ? 'Настройка TOTP' : configuring ? 'Настройка администратора' : 'Вход администратора'}</Styled.Title>
    <Styled.Description>
      {verifying ? 'Шаг 2 из 2. Отсканируйте QR-код в приложении аутентификации и введите полученный код. До проверки кода доступ закрыт.'
        : configuring ? 'Шаг 1 из 2. Создайте пароль единственного администратора системы. Затем настройте двухфакторную аутентификацию.'
          : 'Введите пароль и актуальный код из приложения аутентификации.'}
    </Styled.Description>
    <Styled.Form onSubmit={submit}>
      {error && <Alert severity="error">{error}</Alert>}
      {verifying ? <>
        {status.totp_secret && <Styled.QrFrame>
          <Styled.QrCode
            value={`otpauth://totp/PsychosIS:admin?${new URLSearchParams({ secret: status.totp_secret, issuer: 'PsychosIS', algorithm: 'SHA1', digits: '6', period: '30' })}`}
            size={224} marginSize={4} level="M" bgColor="#ffffff" fgColor="#000000"
            role="img" aria-label="QR-код для настройки TOTP администратора" />
        </Styled.QrFrame>}
        <Styled.ManualSetup>
          <Styled.ManualToggle>Добавить вручную</Styled.ManualToggle>
          <p>Ключ для ручного ввода</p>
          <Styled.Secret aria-label="Секрет TOTP">{status.totp_secret}</Styled.Secret>
          <Styled.Action type="button" onClick={copySecret}>{copied ? 'Ключ скопирован' : 'Скопировать ключ'}</Styled.Action>
          <Styled.Description>Тип: по времени (TOTP). Алгоритм: SHA-1. Длина кода: 6 цифр. Период: 30 секунд.</Styled.Description>
        </Styled.ManualSetup>
        <Alert severity="info">Восстановление TOTP не предусмотрено. Настройка действует 10 минут.</Alert>
      </> : <TextField label="Пароль администратора" type="password" required fullWidth
        value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy}
        autoComplete={configuring ? 'new-password' : 'current-password'}
        slotProps={{ htmlInput: { maxLength: 128 } }} />}
      {configuring && !verifying && <TextField label="Повторите пароль" type="password" required fullWidth
        value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy}
        autoComplete="new-password" slotProps={{ htmlInput: { maxLength: 128 } }} />}
      {(!configuring || verifying) && <TextField label="Код TOTP" required fullWidth
        value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} autoComplete="one-time-code"
        helperText="6 цифр. Если код уже использован, дождитесь следующего."
        slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]{6}', minLength: 6, maxLength: 6 } }} />}
      <Styled.Action variant="contained" type="submit" disabled={busy}>{busy ? 'Проверка…' : verifying ? 'Подтвердить TOTP и войти' : configuring ? 'Продолжить' : 'Войти'}</Styled.Action>
      {verifying && <Styled.Action type="button" onClick={restart} disabled={busy}>Начать настройку заново</Styled.Action>}
      <Styled.HomeLink to="/" aria-disabled={busy}>На главную</Styled.HomeLink>
    </Styled.Form>
  </Styled.Card>
}
export default AdminLogin

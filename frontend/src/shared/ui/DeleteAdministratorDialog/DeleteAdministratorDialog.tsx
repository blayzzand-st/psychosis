import { useState, type FormEvent } from 'react'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import { deleteAdministrator } from '../../../api/adminAuth'
import { useAdminAuth } from '../AdminAccess/useAdminAuth'
import * as Styled from './DeleteAdministratorDialog.styles'

const DeleteAdministratorDialog = ({ onClose }: { onClose: () => void }) => {
  const { refresh } = useAdminAuth()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || confirmation !== 'УДАЛИТЬ') return
    setBusy(true)
    setError('')
    try {
      await deleteAdministrator(password, code, confirmation)
      await refresh()
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не удалось удалить администратора')
    } finally { setBusy(false) }
  }
  return <Dialog open onClose={() => { if (!busy) onClose() }} fullWidth maxWidth="sm"
    aria-labelledby="delete-admin-title" aria-describedby="delete-admin-description">
    <form onSubmit={submit}>
      <DialogTitle id="delete-admin-title">Удалить администратора?</DialogTitle>
      <DialogContent>
        <DialogContentText id="delete-admin-description">
          Пароль и настройка TOTP будут удалены, все сессии администратора завершатся.
          Затем можно заново настроить администратора. Медработники, их аккаунты, пациенты,
          ЭМК и записи аудита сохранятся. Пока новый администратор не настроен,
          начать регистрацию сможет любой, у кого есть доступ к приложению.
        </DialogContentText>
        <Styled.Fields>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Текущий пароль" type="password" autoComplete="current-password"
            required fullWidth disabled={busy} value={password} onChange={event => setPassword(event.target.value)} />
          <TextField label="Код TOTP" autoComplete="one-time-code" required fullWidth disabled={busy}
            value={code} onChange={event => setCode(event.target.value)}
            helperText="Введите актуальный код, который ещё не использовали для входа."
            slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]{6}', maxLength: 6 } }} />
          <TextField label="Введите УДАЛИТЬ" required fullWidth disabled={busy} autoComplete="off"
            value={confirmation} onChange={event => setConfirmation(event.target.value)} />
        </Styled.Fields>
      </DialogContent>
      <DialogActions>
        <Styled.Action disabled={busy} onClick={onClose}>Отмена</Styled.Action>
        <Styled.Action color="error" variant="contained" type="submit"
          disabled={busy || confirmation !== 'УДАЛИТЬ' || !password || !/^[0-9]{6}$/.test(code)}>
          {busy ? 'Удаление…' : 'Удалить администратора'}
        </Styled.Action>
      </DialogActions>
    </form>
  </Dialog>
}

export default DeleteAdministratorDialog

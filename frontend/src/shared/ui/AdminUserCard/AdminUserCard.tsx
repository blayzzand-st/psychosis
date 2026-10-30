import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import SvgIcon from '@mui/material/SvgIcon'
import DeleteAdministratorDialog from '../DeleteAdministratorDialog/DeleteAdministratorDialog'
import { useAdminAuth } from '../AdminAccess/useAdminAuth'
import * as Styled from './AdminUserCard.styles'

const AdminUserCard = () => {
  const { logout } = useAdminAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const signOut = async () => {
    setBusy(true)
    setError('')
    try { await logout() }
    catch { setError('Не удалось выйти. Повторите попытку.') }
    finally { setBusy(false) }
  }
  return <Styled.Card aria-label="Текущий пользователь">
    <Styled.Identity>
      <Styled.Avatar aria-hidden="true">А</Styled.Avatar>
      <Styled.Name>Администратор</Styled.Name>

    </Styled.Identity>
    {error && <Alert severity="error">{error}</Alert>}
    <Styled.Actions>
    <Styled.SignOut variant="outlined" fullWidth disabled={busy} onClick={signOut}>
      {busy ? 'Выход…' : 'Выйти'}
    </Styled.SignOut>
      <Tooltip title="Удалить администратора">
        <Styled.DeleteButton aria-label="Удалить администратора" disabled={busy} onClick={() => setDeleteOpen(true)}>
          <SvgIcon viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7m4-7v7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></SvgIcon>
        </Styled.DeleteButton>
      </Tooltip>
    </Styled.Actions>
    {deleteOpen && <DeleteAdministratorDialog onClose={() => setDeleteOpen(false)} />}
  </Styled.Card>
}

export default AdminUserCard

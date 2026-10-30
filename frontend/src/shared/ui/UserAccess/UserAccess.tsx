import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useUserAuth } from './useUserAuth'

const UserAccess = () => {
  const { status, error, refresh } = useUserAuth()
  const location = useLocation()
  if (!status) return error ? <Alert severity="error" action={<Button onClick={refresh}>Повторить</Button>}>{error}</Alert>
    : <p role="status">Проверка доступа…</p>
  if (!status.authenticated) return <Navigate to="/personal/access" replace state={{ returnTo: location.pathname + location.search }} />
  return <Outlet />
}
export default UserAccess

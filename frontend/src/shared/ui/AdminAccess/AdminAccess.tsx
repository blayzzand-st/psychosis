import { useEffect } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAdminAuth } from './useAdminAuth'
import AdminUserCard from '../AdminUserCard/AdminUserCard'
import * as Styled from './AdminAccess.styles'

const AdminAccess = () => {
  const { status, error, refresh } = useAdminAuth()
  const location = useLocation()
  useEffect(() => { void refresh().catch(() => {}) }, [location.pathname, refresh])
  if (!status) return error
    ? <Alert severity="error" action={<Button onClick={() => { void refresh().catch(() => {}) }}>Повторить</Button>}>{error}</Alert>
    : <p role="status">Проверка доступа…</p>
  if (!status.authenticated) return <Navigate to="/administrator/access" replace state={{ returnTo: location.pathname + location.search }} />
  const hasSidebar = ['/administrator', '/administrator/', '/administrator/accounts', '/administrator/audit'].includes(location.pathname)
  return <>
    {!hasSidebar && <Styled.UserPanel><AdminUserCard /></Styled.UserPanel>}
    <Outlet />
  </>
}
export default AdminAccess

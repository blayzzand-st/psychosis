import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { diagnosisRegistryPath } from '../../shared/config/routes'
import BackButton from '../../shared/ui/BackButton/BackButton'
import AdminUserCard from '../../shared/ui/AdminUserCard/AdminUserCard'
import MedicalWorkerList from './MedicalWorkerList/MedicalWorkerList'
import DiagnosisList from './DiagnosisList/DiagnosisList'
import AccountList from './AccountList/AccountList'
import AuditList from './AuditList/AuditList'
import * as Styled from './Admin.styles'

type AdminSection = 'staff' | 'directories' | 'accounts' | 'audit'

const Admin = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const selectedSection: AdminSection = pathname === '/administrator/audit' ? 'audit' : pathname === '/administrator/accounts' ? 'accounts'
    : searchParams.get('section') === 'directories' ? 'directories' : 'staff'
  const directoriesOpen = selectedSection === 'directories' && searchParams.get('collapsed') !== 'true'
  const diagnosisRegistryOpen = selectedSection === 'directories' && searchParams.get('directory') === 'diagnoses'
  const workspaceVisible = selectedSection !== 'directories' || diagnosisRegistryOpen
  const title = selectedSection === 'audit' ? 'Аудит' : selectedSection === 'accounts' ? 'Аккаунты' : diagnosisRegistryOpen ? 'Реестр диагнозов' : 'Список медработников'

  const selectSection = (section: 'staff' | 'directories') => {
    if (selectedSection === 'accounts' || selectedSection === 'audit') {
      navigate(section === 'directories' ? '/administrator?section=directories' : '/administrator')
      return
    }
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('directory')
      next.delete('collapsed')
      if (section === 'directories') {
        next.set('section', 'directories')
        if (previous.get('section') === 'directories' && previous.get('collapsed') !== 'true') next.set('collapsed', 'true')
      } else next.delete('section')
      return next
    }, { replace: true })
  }

  return (
    <Styled.Page aria-label="Панель администратора">
      <Styled.BackNavigation aria-label="Навигация назад">
        <BackButton />
      </Styled.BackNavigation>

      <Styled.Layout>
        <Styled.SideColumn>
          <Styled.Sidebar aria-label="Разделы администратора">
            <Styled.MenuItem type="button" aria-pressed={selectedSection === 'staff'} onClick={() => selectSection('staff')}>
              Медработники
            </Styled.MenuItem>
            <Styled.MenuLink to="/administrator/accounts" aria-current={selectedSection === 'accounts' ? 'page' : undefined}>
              Аккаунты
            </Styled.MenuLink>
            <Styled.MenuLink to="/administrator/audit" aria-current={selectedSection === 'audit' ? 'page' : undefined}>Аудит</Styled.MenuLink>
            <Styled.MenuItem
              type="button"
              aria-pressed={selectedSection === 'directories' && !diagnosisRegistryOpen}
              aria-expanded={directoriesOpen}
              aria-controls={directoriesOpen ? 'admin-directory-nav' : undefined}
              onClick={() => selectSection('directories')}
            >
              Справочники
              <Styled.DirectoryArrow viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </Styled.DirectoryArrow>
            </Styled.MenuItem>
            {directoriesOpen && (
              <Styled.Submenu id="admin-directory-nav" aria-label="Подразделы справочников">
                <Styled.SubmenuLink to={diagnosisRegistryPath} aria-current={diagnosisRegistryOpen ? 'page' : undefined}>
                  Реестр диагнозов
                </Styled.SubmenuLink>
              </Styled.Submenu>
            )}
          </Styled.Sidebar>
          <AdminUserCard />
        </Styled.SideColumn>

        {workspaceVisible && (
          <Styled.Workspace elevation={0} aria-labelledby="admin-section-title">
            <Styled.Title id="admin-section-title">{title}</Styled.Title>
            {selectedSection === 'staff' && <MedicalWorkerList />}
            {selectedSection === 'accounts' && <AccountList />}
            {selectedSection === 'audit' && <AuditList />}
            {diagnosisRegistryOpen && <DiagnosisList />}
          </Styled.Workspace>
        )}
      </Styled.Layout>
    </Styled.Page>
  )
}

export default Admin

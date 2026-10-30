import BackButton from '../../shared/ui/BackButton/BackButton'
import PatientList from './PatientList/PatientList'
import * as Styled from './Personal.styles'
import UserCard from '../../shared/ui/UserAccess/UserCard'

const Personal = () => (
  <Styled.Page aria-label="Пациенты медработника">
    <Styled.BackNavigation aria-label="Навигация назад">
      <BackButton />
    </Styled.BackNavigation>
    <Styled.Layout>
      <Styled.SideColumn>
        <Styled.Sidebar aria-label="Разделы медработника">
          <Styled.MenuLink to="/personal" aria-current="page">Список пациентов</Styled.MenuLink>
        </Styled.Sidebar>
        <UserCard />
      </Styled.SideColumn>
      <Styled.Workspace elevation={0} aria-labelledby="personal-section-title">
        <Styled.Title id="personal-section-title">Список пациентов</Styled.Title>
        <PatientList />
      </Styled.Workspace>
    </Styled.Layout>
  </Styled.Page>
)

export default Personal

import BackButton from '../../shared/ui/BackButton/BackButton'
import DetailsCard from '../../shared/ui/DetailsCard/DetailsCard'
import PatientList from './PatientList/PatientList'
import * as Styled from './Personal.styles'

const Personal = () => (
  <Styled.Page aria-label="Пациенты врача">
    <Styled.BackNavigation aria-label="Навигация назад">
      <BackButton />
    </Styled.BackNavigation>
    <Styled.Layout>
      <Styled.Sidebar aria-label="Разделы врача">
        <Styled.MenuLink to="/personal" aria-current="page">Список пациентов</Styled.MenuLink>
      </Styled.Sidebar>
      <Styled.Workspace>
        <DetailsCard title="Список пациентов">
          <PatientList />
        </DetailsCard>
      </Styled.Workspace>
    </Styled.Layout>
  </Styled.Page>
)

export default Personal

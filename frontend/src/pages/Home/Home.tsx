import * as Styled from './Home.styles'

const roles = [
  {
    path: '/administrator',
    label: 'Администратор',
    initial: 'А',
    description: 'Управление медработниками и справочником диагнозов.',
  },
  {
    path: '/personal',
    label: 'Врач',
    initial: 'В',
    description: 'Работа с пациентами, медицинскими картами и назначениями.',
  },
]

const Home = () => (
  <Styled.Content aria-labelledby="home-title">
    <Styled.HeadingBlock>
      <Styled.Title id="home-title">Как вы хотите войти?</Styled.Title>
      <Styled.Description>
        Выберите свою роль, чтобы перейти к работе в системе.
      </Styled.Description>
    </Styled.HeadingBlock>

    <Styled.RoleGrid>
      {roles.map((role) => (
        <Styled.RoleCard key={role.path} elevation={0}>
          <Styled.RoleAction
            to={role.path}
            aria-label={`Войти как ${role.label.toLowerCase()}`}
          >
            <Styled.RoleMark aria-hidden="true">{role.initial}</Styled.RoleMark>
            <Styled.RoleTitle>{role.label}</Styled.RoleTitle>
            <Styled.RoleDescription>{role.description}</Styled.RoleDescription>
            <Styled.EnterLabel aria-hidden="true">
              Войти <span>→</span>
            </Styled.EnterLabel>
          </Styled.RoleAction>
        </Styled.RoleCard>
      ))}
    </Styled.RoleGrid>
  </Styled.Content>
)

export default Home

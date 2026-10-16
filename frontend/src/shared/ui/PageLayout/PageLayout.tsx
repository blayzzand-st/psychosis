import type { ReactNode } from 'react'
import { useMatch } from 'react-router'
import * as Styled from './PageLayout.styles'

type PageLayoutProps = {
  children: ReactNode
}

const PageLayout = ({ children }: PageLayoutProps) => {
  const administratorPage = useMatch('/administrator/*')
  const personalPage = useMatch('/personal/*')
  const role = administratorPage ? { letter: 'A', label: 'Администратор' }
    : personalPage ? { letter: 'В', label: 'Врач' } : null

  return (
    <Styled.Page>
      <Styled.Header>
        <Styled.BrandBlock>
          <Styled.BrandRow to="/" aria-label="PsychosIS — на стартовую страницу">
            <Styled.BrandMark aria-hidden="true">P</Styled.BrandMark>
            <Styled.Brand>PsychosIS</Styled.Brand>
          </Styled.BrandRow>
          <Styled.HeaderSubtitle>Медицинская информационная система</Styled.HeaderSubtitle>
        </Styled.BrandBlock>
        {role && (
          <Styled.Role aria-label={`Текущая роль: ${role.label}`}>
            <Styled.RoleMark aria-hidden="true"><Styled.RoleLetter>{role.letter}</Styled.RoleLetter></Styled.RoleMark>
            <Styled.RoleLabel>{role.label}</Styled.RoleLabel>
          </Styled.Role>
        )}
      </Styled.Header>
      {children}
    </Styled.Page>
  )
}

export default PageLayout

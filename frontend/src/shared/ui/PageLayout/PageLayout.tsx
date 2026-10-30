import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import * as Styled from './PageLayout.styles'

type PageLayoutProps = {
  children: ReactNode
}

const PageLayout = ({ children }: PageLayoutProps) => {
  const { pathname } = useLocation()
  const adminWorkspace = ['/administrator', '/administrator/', '/administrator/accounts', '/administrator/audit'].includes(pathname)

  return (
    <Styled.Page data-admin-workspace={adminWorkspace ? 'true' : undefined}>
      <Styled.Header>
        <Styled.BrandBlock>
          <Styled.BrandRow to="/" aria-label="PsychosIS — на стартовую страницу">
            <Styled.BrandMark aria-hidden="true">P</Styled.BrandMark>
            <Styled.Brand>PsychosIS</Styled.Brand>
          </Styled.BrandRow>
          <Styled.HeaderSubtitle>Медицинская информационная система</Styled.HeaderSubtitle>
        </Styled.BrandBlock>
      </Styled.Header>
      {children}
    </Styled.Page>
  )
}

export default PageLayout

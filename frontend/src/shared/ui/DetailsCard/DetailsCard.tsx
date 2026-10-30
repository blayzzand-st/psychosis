import type { ReactNode } from 'react'
import * as Styled from './DetailsCard.styles'

type DetailsCardProps = {
  title?: string
  titleAction?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  busy?: boolean
  children: ReactNode
}

const DetailsCard = ({ title, titleAction, subtitle, action, busy = false, children }: DetailsCardProps) => (
  <Styled.Card elevation={0} aria-busy={busy}>
    {(title || subtitle || action) && (
      <Styled.Header>
        {(title || subtitle) && (
          <Styled.Heading>
            {title && <Styled.TitleLine><Styled.Title>{title}</Styled.Title>{titleAction}</Styled.TitleLine>}
            {subtitle && <Styled.Subtitle>{subtitle}</Styled.Subtitle>}
          </Styled.Heading>
        )}
        {action && <Styled.Action>{action}</Styled.Action>}
      </Styled.Header>
    )}
    {children}
  </Styled.Card>
)

export default DetailsCard

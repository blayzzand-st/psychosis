import type { ReactNode } from 'react'
import * as Styled from './DetailsCard.styles'

type DetailsCardProps = {
  title?: string
  subtitle?: ReactNode
  action?: ReactNode
  busy?: boolean
  children: ReactNode
}

const DetailsCard = ({ title, subtitle, action, busy = false, children }: DetailsCardProps) => (
  <Styled.Card elevation={0} aria-busy={busy}>
    {(title || subtitle || action) && (
      <Styled.Header>
        {(title || subtitle) && (
          <Styled.Heading>
            {title && <Styled.Title>{title}</Styled.Title>}
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

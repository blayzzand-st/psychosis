import Paper from '@mui/material/Paper'
import { styled } from '@mui/material/styles'

export const Card = styled(Paper)(({ theme }) =>
  theme.unstable_sx({
    maxWidth: '760px',
    marginLeft: 'auto',
    marginRight: 'auto',
    padding: { xs: '24px', md: '32px' },
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: '16px',
  }),
)

export const Header = styled('header')(({ theme }) =>
  theme.unstable_sx({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
    marginBottom: '32px',
  }),
)

export const Heading = styled('div')(({ theme }) =>
  theme.unstable_sx({ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0px', flex: '1 1 180px' }),
)

export const Subtitle = styled('div')(({ theme }) =>
  theme.unstable_sx({ color: 'text.secondary', fontSize: '15px', lineHeight: 1.6, overflowWrap: 'anywhere' }),
)

export const Title = styled('h1')(({ theme }) =>
  theme.unstable_sx({
    margin: '0px',
    minWidth: '0px',
    fontSize: 'clamp(26px, 3vw, 34px)',
    fontWeight: 600,
    overflowWrap: 'anywhere',
  }),
)

export const Action = styled('div')(({ theme }) =>
  theme.unstable_sx({ display: 'flex', flexShrink: 0, marginLeft: 'auto' }),
)

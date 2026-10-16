import Card from '@mui/material/Card'
import { Link } from 'react-router'
import { styled } from '@mui/material/styles'

export const Content = styled('section')(({ theme }) =>
  theme.unstable_sx({
    maxWidth: '800px',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingTop: 'clamp(56px, 10vw, 104px)',
  }),
)

export const HeadingBlock = styled('div')(({ theme }) =>
  theme.unstable_sx({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '36px',
    textAlign: 'center',
  }),
)

export const Title = styled('h1')(({ theme }) =>
  theme.unstable_sx({
    margin: '0px',
    fontSize: 'clamp(34px, 5vw, 52px)',
    lineHeight: 1.15,
    fontWeight: 600,
    letterSpacing: '-1.5px',
  }),
)

export const Description = styled('p')(({ theme }) =>
  theme.unstable_sx({
    maxWidth: '560px',
    margin: '0px',
    color: 'text.secondary',
    fontSize: '18px',
    lineHeight: 1.7,
  }),
)

export const RoleGrid = styled('div')(({ theme }) =>
  theme.unstable_sx({
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
    gap: '24px',
    maxWidth: '800px',
  }),
)

export const RoleCard = styled(Card)(({ theme }) =>
  theme.unstable_sx({
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: '16px',
    '&:hover': { borderColor: 'primary.main' },
  }),
)

export const RoleAction = styled(Link)(({ theme }) =>
  theme.unstable_sx({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    height: '100%',
    color: 'inherit',
    textDecoration: 'none',
    padding: { xs: '24px', sm: '32px' },
    '&:hover': { backgroundColor: 'action.hover' },
    '&:focus-visible': {
      outline: '3px solid',
      outlineColor: 'primary.main',
      outlineOffset: '-3px',
    },
  }),
)

export const RoleMark = styled('span')(({ theme }) =>
  theme.unstable_sx({
    display: 'grid',
    placeItems: 'center',
    width: '48px',
    height: '48px',
    marginBottom: '24px',
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: '12px',
    backgroundColor: 'background.default',
    color: 'primary.main',
    fontSize: '22px',
    fontWeight: 600,
  }),
)

export const RoleTitle = styled('span')(({ theme }) =>
  theme.unstable_sx({
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: 1.3,
  }),
)

export const RoleDescription = styled('span')(({ theme }) =>
  theme.unstable_sx({
    marginTop: '12px',
    marginBottom: '32px',
    color: 'text.secondary',
    fontSize: '16px',
    lineHeight: 1.7,
  }),
)

export const EnterLabel = styled('span')(({ theme }) =>
  theme.unstable_sx({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 'auto',
    color: 'primary.main',
    fontSize: '16px',
    fontWeight: 600,
  }),
)


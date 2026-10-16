import { styled } from '@mui/material/styles'
import { Link } from 'react-router'

export const Page = styled('section')(({ theme }) =>
  theme.unstable_sx({
    paddingTop: '32px',
  }),
)

export const BackNavigation = styled('nav')(({ theme }) =>
  theme.unstable_sx({
    display: 'flex',
    justifyContent: 'flex-start',
    marginBottom: '24px',
  }),
)

export const Layout = styled('div')(({ theme }) =>
  theme.unstable_sx({
    display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '200px minmax(0, 1fr)' }, alignItems: 'start', gap: '24px',
  }),
)

export const Sidebar = styled('nav')(({ theme }) =>
  theme.unstable_sx({ display: 'flex', flexDirection: 'column', gap: '8px' }),
)

export const MenuLink = styled(Link)(({ theme }) =>
  theme.unstable_sx({
    display: 'flex', alignItems: 'center', width: '100%', minHeight: '48px', padding: '12px 16px', borderRadius: '10px',
    backgroundColor: 'primary.main', color: 'primary.contrastText', fontSize: '16px', lineHeight: 1.5, fontWeight: 500,
    textDecoration: 'none', '&:hover': { backgroundColor: 'primary.dark' },
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
  }),
)

export const Workspace = styled('div')(({ theme }) =>
  theme.unstable_sx({ minWidth: '0px' }),
)


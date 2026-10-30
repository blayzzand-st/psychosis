import { styled } from '@mui/material/styles'
import Paper from '@mui/material/Paper'
import { Link } from 'react-router'

export const Page = styled('section')(({ theme }) =>
  theme.unstable_sx({
    paddingTop: '32px',
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minHeight: '0px',
  }),
)

export const BackNavigation = styled('nav')(({ theme }) =>
  theme.unstable_sx({
    display: 'flex',
    justifyContent: 'flex-start',
    marginBottom: '24px',
    flexShrink: 0,
  }),
)

export const Layout = styled('div')(({ theme }) =>
  theme.unstable_sx({
    display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '200px minmax(0, 1fr)' }, alignItems: 'stretch', gap: '24px',
    flex: '1 1 auto',
    minHeight: '0px',
    gridTemplateRows: { sm: 'minmax(0, 1fr)' },
  }),
)

export const Sidebar = styled('nav')(({ theme }) =>
  theme.unstable_sx({ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '0px', overflowY: 'auto' }),
)

export const SideColumn = styled('div')(({ theme }) =>
  theme.unstable_sx({
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    minWidth: '0px', gap: '32px',
    minHeight: '0px',
  }),
)

export const MenuLink = styled(Link)(({ theme }) =>
  theme.unstable_sx({
    display: 'flex', alignItems: 'center', width: '100%', minHeight: '48px', padding: '12px 16px', borderRadius: '10px',
    backgroundColor: 'primary.main', color: 'primary.contrastText', fontSize: '16px', lineHeight: 1.5, fontWeight: 500,
    textDecoration: 'none', '&:hover': { backgroundColor: 'primary.dark' },
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
  }),
)

export const Workspace = styled(Paper)(({ theme }) =>
  theme.unstable_sx({
    minWidth: '0px',
    minHeight: { xs: '260px', sm: '0px' },
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: { xs: '24px', md: '32px' },
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: '16px',
  }),
)

export const Title = styled('h1')(({ theme }) =>
  theme.unstable_sx({
    margin: '0px',
    flexShrink: 0,
    fontSize: 'clamp(26px, 3vw, 34px)',
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '-0.6px',
  }),
)


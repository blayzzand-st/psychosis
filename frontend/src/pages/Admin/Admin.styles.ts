import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import SvgIcon from '@mui/material/SvgIcon'
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
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: '200px minmax(0, 1fr)' },
    alignItems: 'start',
    gap: '24px',
  }),
)

export const Sidebar = styled('nav')(({ theme }) =>
  theme.unstable_sx({
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }),
)

export const MenuItem = styled(Button)(({ theme }) =>
  theme.unstable_sx({
    justifyContent: 'flex-start',
    width: '100%',
    minHeight: '48px',
    padding: '12px 16px',
    borderRadius: '10px',
    color: 'text.primary',
    fontSize: '16px',
    lineHeight: 1.5,
    fontWeight: 500,
    textAlign: 'left',
    textTransform: 'none',
    '&[aria-pressed="true"]': {
      backgroundColor: 'primary.main',
      color: 'primary.contrastText',
      '&:hover': { backgroundColor: 'primary.dark' },
    },
    '&.Mui-focusVisible': {
      outline: '2px solid',
      outlineColor: 'primary.main',
      outlineOffset: '2px',
    },
  }),
)

export const Workspace = styled(Paper)(({ theme }) =>
  theme.unstable_sx({
    minWidth: '0px',
    minHeight: '260px',
    padding: { xs: '24px', md: '32px' },
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: '16px',
  }),
)

export const Title = styled('h1')(({ theme }) =>
  theme.unstable_sx({
    margin: '0px',
    fontSize: 'clamp(26px, 3vw, 34px)',
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '-0.6px',
  }),
)

export const DirectoryArrow = styled(SvgIcon)(({ theme }) =>
  theme.unstable_sx({
    marginLeft: 'auto',
    flexShrink: 0,
    width: '20px',
    height: '20px',
    transform: 'rotate(0deg)',
    transition: theme.transitions.create('transform', { duration: 200 }),
    'button[aria-expanded="true"] &': { transform: 'rotate(90deg)' },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  }),
)

export const Submenu = styled('nav')(({ theme }) =>
  theme.unstable_sx({
    marginLeft: '16px',
    paddingLeft: '8px',
    borderLeft: '1px solid',
    borderColor: 'divider',
  }),
)

export const SubmenuLink = styled(Link)(({ theme }) =>
  theme.unstable_sx({
    display: 'block',
    padding: '12px',
    borderRadius: '8px',
    color: 'text.primary',
    fontSize: '14px',
    fontWeight: 500,
    textDecoration: 'none',
    '&:hover': { backgroundColor: 'action.hover' },
    '&[aria-current="page"]': {
      backgroundColor: 'primary.main',
      color: 'primary.contrastText',
      '&:hover': { backgroundColor: 'primary.dark' },
    },
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
  }),
)


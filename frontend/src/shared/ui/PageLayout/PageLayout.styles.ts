import { styled } from '@mui/material/styles'
import { Link } from 'react-router'

export const Page = styled('main')(({ theme }) =>
  theme.unstable_sx({
    maxWidth: '1040px',
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: { xs: '20px', sm: '32px' },
    paddingRight: { xs: '20px', sm: '32px' },
    paddingBottom: '64px',
    '&[data-workspace="true"]': {
      height: { sm: '100dvh' },
    },
  }),
)

export const Header = styled('header')(({ theme }) =>
  theme.unstable_sx({
    flexShrink: 0,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    paddingTop: '28px',
    paddingBottom: '28px',
    borderBottom: '1px solid',
    borderColor: 'divider',
  }),
)

export const BrandBlock = styled('div')(({ theme }) =>
  theme.unstable_sx({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', minWidth: '0px' }),
)

export const Role = styled('div')(({ theme }) =>
  theme.unstable_sx({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0 }),
)

export const RoleMark = styled('span')(({ theme }) =>
  theme.unstable_sx({
    display: 'grid', placeItems: 'center', width: '36px', height: '36px', borderRadius: '50%',
    backgroundColor: 'primary.main', color: 'primary.contrastText', fontSize: '22px', fontWeight: 700,
  }),
)

export const RoleLetter = styled('span')(({ theme }) =>
  theme.unstable_sx({ lineHeight: 1, transform: 'translateY(-1px)' }),
)

export const RoleLabel = styled('span')(({ theme }) =>
  theme.unstable_sx({ color: 'text.secondary', fontSize: { xs: '12px', sm: '14px' }, fontWeight: 600 }),
)

export const BrandRow = styled(Link)(({ theme }) =>
  theme.unstable_sx({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: 'inherit',
    textDecoration: 'none',
    borderRadius: '10px',
    '&:hover': { color: 'primary.main' },
    '&:focus-visible': {
      outline: '2px solid',
      outlineColor: 'primary.main',
      outlineOffset: '4px',
    },
  }),
)

export const BrandMark = styled('span')(({ theme }) =>
  theme.unstable_sx({
    display: 'grid',
    placeItems: 'center',
    width: '36px',
    height: '36px',
    flexShrink: 0,
    borderRadius: '10px',
    backgroundColor: 'primary.main',
    color: 'primary.contrastText',
    fontSize: '22px',
    fontWeight: 700,
  }),
)

export const Brand = styled('span')(({ theme }) =>
  theme.unstable_sx({
    fontSize: '23px',
    fontWeight: 650,
    letterSpacing: '-0.6px',
  }),
)

export const HeaderSubtitle = styled('p')(({ theme }) =>
  theme.unstable_sx({
    margin: '0px',
    color: 'secondary.main',
    fontSize: '14px',
    fontWeight: 600,
  }),
)

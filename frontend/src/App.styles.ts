import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import { styled } from '@mui/material/styles'

export const Page = styled('main')(({ theme }) =>
  theme.unstable_sx({
    maxWidth: '1040px',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: { xs: '20px', sm: '32px' },
    paddingRight: { xs: '20px', sm: '32px' },
    paddingBottom: '64px',
  }),
)

export const Header = styled('header')(({ theme }) =>
  theme.unstable_sx({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '28px',
    paddingBottom: '28px',
    borderBottom: '1px solid',
    borderColor: 'divider',
  }),
)

export const BrandMark = styled('span')(({ theme }) =>
  theme.unstable_sx({
    display: 'grid',
    placeItems: 'center',
    width: '36px',
    height: '36px',
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

export const Welcome = styled('section')(({ theme }) =>
  theme.unstable_sx({
    maxWidth: '640px',
    paddingTop: 'clamp(56px, 10vw, 104px)',
  }),
)

export const Eyebrow = styled('p')(({ theme }) =>
  theme.unstable_sx({
    marginTop: '0px',
    marginBottom: '18px',
    color: 'secondary.main',
    fontSize: '14px',
    fontWeight: 600,
  }),
)

export const PageTitle = styled('h1')(({ theme }) =>
  theme.unstable_sx({
    margin: '0px',
    fontSize: 'clamp(36px, 6vw, 56px)',
    lineHeight: 1.12,
    fontWeight: 600,
    letterSpacing: '-1.8px',
  }),
)

export const Intro = styled('p')(({ theme }) =>
  theme.unstable_sx({
    maxWidth: '530px',
    marginTop: '24px',
    marginBottom: '36px',
    color: 'text.secondary',
    fontSize: '18px',
    lineHeight: 1.7,
  }),
)

export const ConnectionPanel = styled(Paper)(({ theme }) =>
  theme.unstable_sx({
    padding: { xs: '22px', sm: '28px' },
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: '16px',
  }),
)

export const ConnectionHeading = styled('div')(({ theme }) =>
  theme.unstable_sx({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  }),
)

export const ConnectionTitle = styled('h2')(({ theme }) =>
  theme.unstable_sx({
    margin: '0px',
    fontSize: '18px',
    fontWeight: 600,
  }),
)

export const StatusDot = styled('span')(({ theme }) =>
  theme.unstable_sx({
    flexShrink: 0,
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    backgroundColor: 'text.disabled',
    '&[data-status="checking"]': { backgroundColor: 'warning.main' },
    '&[data-status="online"]': { backgroundColor: 'success.main' },
    '&[data-status="error"]': { backgroundColor: 'error.main' },
  }),
)

export const ConnectionMessage = styled('p')(({ theme }) =>
  theme.unstable_sx({
    marginTop: '12px',
    marginBottom: '24px',
    color: 'text.secondary',
    fontSize: '15px',
    lineHeight: 1.6,
  }),
)

export const CheckButton = styled(Button)(({ theme }) =>
  theme.unstable_sx({
    width: { xs: '100%', sm: 'auto' },
    paddingLeft: '20px',
    paddingRight: '20px',
    paddingTop: '12px',
    paddingBottom: '12px',
    borderRadius: '8px',
    fontSize: '16px',
    lineHeight: 1.2,
    fontWeight: 600,
    textTransform: 'none',
    '&.Mui-focusVisible': {
      outline: '3px solid',
      outlineColor: 'primary.main',
      outlineOffset: '4px',
    },
  }),
)

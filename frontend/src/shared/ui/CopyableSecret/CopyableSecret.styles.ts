import ButtonBase from '@mui/material/ButtonBase'
import { alpha, styled } from '@mui/material/styles'

export const Secret = styled(ButtonBase)(({ theme }) => theme.unstable_sx({
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
  width: '100%', marginTop: '12px', padding: '16px', minHeight: '64px',
  border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.4), borderRadius: '8px',
  backgroundColor: alpha(theme.palette.primary.main, 0.05), boxShadow: '0px 2px 0px rgba(0, 0, 0, 0.10)',
  color: 'text.primary', fontFamily: 'monospace', fontSize: '22px', letterSpacing: '1px',
  textAlign: 'left', overflowWrap: 'anywhere', userSelect: 'none', cursor: 'pointer',
  transition: 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease',
  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1), borderColor: 'primary.main' },
  '&:active': {
    backgroundColor: alpha(theme.palette.primary.main, 0.2), borderColor: 'primary.dark',
    boxShadow: 'inset 0px 2px 4px rgba(0, 0, 0, 0.16)', transform: 'translateY(1px)',
  },
  '&:focus-visible, &.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
  '&.Mui-disabled': { opacity: 0.5, cursor: 'default' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:active': { transform: 'none' } },
}))

export const Password = styled('span')(({ theme }) => theme.unstable_sx({ minWidth: '0px', overflowWrap: 'anywhere' }))
export const CopyAction = styled('span')(({ theme }) => theme.unstable_sx({
  display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'primary.main',
  fontFamily: theme.typography.fontFamily, fontSize: '13px', fontWeight: 600, letterSpacing: '0px',
}))

export const Feedback = styled('p')(({ theme }) => theme.unstable_sx({
  marginTop: '8px', marginBottom: '16px', color: 'text.secondary', fontSize: '13px', lineHeight: 1.5,
  '&[data-error="true"]': { color: 'error.main' },
}))

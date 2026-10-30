import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import { styled } from '@mui/material/styles'
import { Link } from 'react-router'
import { QRCodeSVG } from 'qrcode.react'

export const Card = styled(Paper)(({ theme }) => theme.unstable_sx({
  width: '100%', maxWidth: '560px', margin: '32px auto', padding: { xs: '24px', sm: '32px' },
  border: '1px solid', borderColor: 'divider', borderRadius: '16px',
}))
export const Form = styled('form')(({ theme }) => theme.unstable_sx({
  display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px',
}))
export const Title = styled('h1')(({ theme }) => theme.unstable_sx({
  margin: '0px', fontSize: '28px', lineHeight: 1.2, fontWeight: 600,
}))
export const Description = styled('p')(({ theme }) => theme.unstable_sx({
  color: 'text.secondary', lineHeight: 1.6, margin: '16px 0px 0px',
}))
export const Secret = styled('code')(({ theme }) => theme.unstable_sx({
  display: 'block', overflowWrap: 'anywhere', padding: '16px', borderRadius: '8px',
  backgroundColor: 'action.hover', fontSize: '18px', letterSpacing: '1px', userSelect: 'all',
}))
export const QrFrame = styled('div')(({ theme }) => theme.unstable_sx({
  display: 'flex', justifyContent: 'center', border: '1px solid', borderColor: 'divider',
  borderRadius: '12px', padding: '16px',
}))
export const QrCode = styled(QRCodeSVG)(({ theme }) => theme.unstable_sx({
  display: 'block', maxWidth: '100%', height: 'auto',
}))
export const ManualSetup = styled('details')(({ theme }) => theme.unstable_sx({
  border: '1px solid', borderColor: 'divider', borderRadius: '8px', padding: '16px',
}))
export const ManualToggle = styled('summary')(({ theme }) => theme.unstable_sx({
  cursor: 'pointer', color: 'primary.main', fontWeight: 500,
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '4px' },
}))
export const Action = styled(Button)(({ theme }) => theme.unstable_sx({
  textTransform: 'none', minHeight: '44px', borderRadius: '8px', fontWeight: 500,
}))
export const HomeLink = styled(Link)(({ theme }) => theme.unstable_sx({
  display: 'inline-flex', justifyContent: 'center', alignItems: 'center', minHeight: '44px',
  color: 'primary.main', borderRadius: '8px', textDecoration: 'none',
  '&:hover': { backgroundColor: 'action.hover' },
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
  '&[aria-disabled="true"]': { pointerEvents: 'none', color: 'text.disabled' },
}))

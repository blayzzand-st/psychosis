import Button from '@mui/material/Button'
import { styled } from '@mui/material/styles'
import { Link } from 'react-router'

export const Page = styled('section')(({ theme }) => theme.unstable_sx({ paddingTop: '32px' }))
export const BackNav = styled('nav')(({ theme }) => theme.unstable_sx({ display: 'flex', marginBottom: '24px' }))
export const Message = styled('p')(({ theme }) => theme.unstable_sx({ marginTop: '0px', color: 'text.secondary', lineHeight: 1.6 }))
export const WorkerDetails = styled('dl')(({ theme }) => theme.unstable_sx({
  margin: '0px', marginBottom: '16px',
  '& dt': { fontSize: '14px', color: 'text.secondary' },
  '& dd': { marginLeft: '0px', marginTop: '4px', marginBottom: '16px', overflowWrap: 'anywhere' },
}))
export const RetryButton = styled(Button)(({ theme }) => theme.unstable_sx({ textTransform: 'none' }))
export const WorkerLink = styled(Link)(({ theme }) => theme.unstable_sx({
  display: 'inline-block', marginTop: '24px', color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' },
}))

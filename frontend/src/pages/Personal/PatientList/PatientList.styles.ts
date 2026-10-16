import Button from '@mui/material/Button'
import { alpha, styled } from '@mui/material/styles'
import { Link } from 'react-router'

export const Toolbar = styled('div')(({ theme }) =>
  theme.unstable_sx({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px',
  }),
)
export const Count = styled('p')(({ theme }) =>
  theme.unstable_sx({ margin: '0px', minWidth: '80px', flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: 'text.secondary', fontSize: '14px' }),
)
export const CreateLink = styled(Link)(({ theme }) =>
  theme.unstable_sx({
    display: 'inline-flex', alignItems: 'center', minHeight: '44px', padding: '10px 16px', borderRadius: '8px',
    backgroundColor: 'primary.main', color: 'primary.contrastText', fontSize: '14px', fontWeight: 600, textDecoration: 'none',
    '&:hover': { backgroundColor: 'primary.dark' },
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
  }),
)
export const Message = styled('p')(({ theme }) =>
  theme.unstable_sx({ margin: '0px', color: 'text.secondary', lineHeight: 1.6 }),
)
export const ErrorMessage = styled('p')(({ theme }) =>
  theme.unstable_sx({ marginTop: '0px', marginBottom: '16px', color: 'error.main' }),
)
export const RetryButton = styled(Button)(({ theme }) =>
  theme.unstable_sx({ minHeight: '44px', padding: '8px 16px', textTransform: 'none' }),
)
export const List = styled('ul')(({ theme }) => theme.unstable_sx({ margin: '0px', padding: '0px', listStyle: 'none' }))
export const Row = styled('li')(({ theme }) =>
  theme.unstable_sx({
    marginLeft: '-12px', marginRight: '-12px', borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 'none' },
  }),
)
export const RecordLink = styled(Link)(({ theme }) =>
  theme.unstable_sx({
    display: 'block', padding: '16px 12px', borderRadius: '8px', color: 'inherit', textDecoration: 'none',
    transition: 'background-color 150ms ease', '&:hover': { backgroundColor: 'action.hover' },
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
  }),
)
export const Name = styled('h2')(({ theme }) =>
  theme.unstable_sx({ margin: '0px', fontSize: '18px', fontWeight: 600, lineHeight: 1.4, overflowWrap: 'anywhere' }),
)
export const Summary = styled('p')(({ theme }) =>
  theme.unstable_sx({ margin: '0px', color: 'text.secondary', fontSize: '15px', lineHeight: 1.6 }),
)
export const Metadata = styled('div')(({ theme }) =>
  theme.unstable_sx({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }),
)
export const RecordStatus = styled('span')(({ theme }) =>
  theme.unstable_sx({
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '6px',
    backgroundColor: 'action.hover', color: 'text.secondary', fontSize: '12px', fontWeight: 600, lineHeight: 1.4,
    '&::before': { content: '""', width: '6px', height: '6px', flexShrink: 0, borderRadius: '50%', backgroundColor: 'currentColor' },
    '&[data-present="true"]': { backgroundColor: alpha(theme.palette.success.main, 0.12), color: 'success.dark' },
  }),
)

import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import { alpha, styled } from '@mui/material/styles'
import { Link } from 'react-router'

export const Container = styled('div')(({ theme }) =>
  theme.unstable_sx({
    marginTop: '24px',
  }),
)

export const FilterLabel = styled(FormControlLabel)(({ theme }) =>
  theme.unstable_sx({ marginLeft: '-11px', marginRight: '0px', marginBottom: '12px' }),
)

export const DeletedBadge = styled('span')(({ theme }) =>
  theme.unstable_sx({
    display: 'inline-block',
    marginTop: '6px',
    padding: '2px 8px',
    borderRadius: '6px',
    backgroundColor: alpha(theme.palette.error.main, 0.2),
    color: 'error.dark',
    border: '1px solid',
    borderColor: 'error.main',
    fontSize: '13px',
    fontWeight: 600,
  }),
)

export const Message = styled('p')(({ theme }) =>
  theme.unstable_sx({
    margin: '0px',
    color: 'text.secondary',
    fontSize: '16px',
    lineHeight: 1.6,
  }),
)

export const ErrorMessage = styled('p')(({ theme }) =>
  theme.unstable_sx({
    marginTop: '0px',
    marginBottom: '16px',
    color: 'error.main',
    fontSize: '16px',
    lineHeight: 1.6,
  }),
)

export const RetryButton = styled(Button)(({ theme }) =>
  theme.unstable_sx({
    padding: '8px 16px',
    borderRadius: '8px',
    textTransform: 'none',
  }),
)

export const Count = styled('p')(({ theme }) =>
  theme.unstable_sx({
    margin: '0px',
    minWidth: '80px',
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
    color: 'text.secondary',
    fontSize: '14px',
  }),
)

export const Toolbar = styled('div')(({ theme }) =>
  theme.unstable_sx({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px',
  }),
)

export const CreateLink = styled(Link)(({ theme }) =>
  theme.unstable_sx({
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '44px',
    padding: '10px 16px',
    borderRadius: '8px',
    backgroundColor: 'primary.main',
    color: 'primary.contrastText',
    fontSize: '14px',
    fontWeight: 600,
    textDecoration: 'none',
    '&:hover': { backgroundColor: 'primary.dark' },
    '&:focus-visible': {
      outline: '2px solid',
      outlineColor: 'primary.main',
      outlineOffset: '2px',
    },
  }),
)

export const WorkerList = styled('ul')(({ theme }) =>
  theme.unstable_sx({
    margin: '0px',
    padding: '0px',
    listStyle: 'none',
  }),
)

export const WorkerRow = styled('li')(({ theme }) =>
  theme.unstable_sx({
    marginLeft: '-12px',
    marginRight: '-12px',
    borderBottom: '1px solid',
    borderColor: 'divider',
    '&:last-child': { borderBottom: 'none' },
  }),
)

export const WorkerLink = styled(Link)(({ theme }) =>
  theme.unstable_sx({
    display: 'block',
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '16px',
    paddingBottom: '16px',
    borderRadius: '8px',
    color: 'inherit',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
    '&:hover': {
      backgroundColor: 'action.hover',
    },
    '&:focus-visible': {
      outline: '2px solid',
      outlineColor: 'primary.main',
      outlineOffset: '-2px',
    },
  }),
)

export const WorkerName = styled('h2')(({ theme }) =>
  theme.unstable_sx({
    margin: '0px',
    fontSize: '18px',
    fontWeight: 600,
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
  }),
)

export const WorkerPosition = styled('p')(({ theme }) =>
  theme.unstable_sx({
    marginTop: '4px',
    marginBottom: '0px',
    color: 'text.secondary',
    fontSize: '15px',
    lineHeight: 1.6,
    overflowWrap: 'anywhere',
  }),
)

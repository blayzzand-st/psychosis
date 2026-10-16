import MuiButton from '@mui/material/Button'
import SvgIcon from '@mui/material/SvgIcon'
import { styled } from '@mui/material/styles'

export const Button = styled(MuiButton)(({ theme }) =>
  theme.unstable_sx({
    minWidth: '0px',
    minHeight: '44px',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    textTransform: 'none',
    '&.Mui-focusVisible': {
      outline: '2px solid',
      outlineColor: 'primary.main',
      outlineOffset: '2px',
    },
  }),
)

export const Arrow = styled(SvgIcon)(({ theme }) =>
  theme.unstable_sx({
    width: '20px',
    height: '20px',
  }),
)

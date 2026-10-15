import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: {
      main: '#245b45',
      dark: '#194633',
      contrastText: '#ffffff',
    },
    secondary: { main: '#496c59' },
    success: { main: '#28824d' },
    warning: { main: '#b17b21' },
    error: { main: '#bf4943' },
    text: {
      primary: '#20332e',
      secondary: '#5b6b64',
      disabled: '#8b9690',
    },
    background: {
      default: '#f5f7f3',
      paper: '#ffffff',
    },
    divider: '#dbe3db',
  },
  typography: {
    fontFamily: "'Segoe UI', sans-serif",
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minWidth: '320px',
          fontSynthesis: 'none',
          textRendering: 'optimizeLegibility',
        },
      },
    },
  },
})

# Правила для агента: frontend

## Стилизация

- Используй `styled` из `@mui/material/styles` с `theme.unstable_sx`.
- При необходимости выноси стили компонента в `Component.styles.ts` рядом
  с `Component.tsx`.
- Импортируй стили как `import * as Styled from './Component.styles'`
  и используй `Styled.ComponentName` в JSX.
- Общие цвета и настройки храни в `theme.ts`, в стилях используй токены темы.
- Используй полные имена CSS-свойств и явные размеры с единицами:
  `paddingBottom: '20px'`, `marginTop: '24px'`, `gap: '12px'`,
  `borderRadius: '16px'`.
- Не используй числовые множители темы для отступов и сокращения `p`, `px`,
  `mt` и т. п.
- Адаптивные значения также задавай явно:
  `paddingLeft: { xs: '20px', sm: '32px' }`.
- Безразмерные свойства, например `fontWeight` и `lineHeight`, оставляй числами.

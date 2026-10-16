import { useState, type FormEvent } from 'react'
import { DiagnosisApiError, type DiagnosisWrite, type DiagnosisFieldErrors } from '../../../api/diagnoses'
import * as Styled from './DiagnosisForm.styles'

type DiagnosisFormProps = {
  initialValues?: DiagnosisWrite
  busy: boolean
  submitLabel: string
  onSubmit: (values: DiagnosisWrite) => Promise<void>
  onCancel: () => void
  onEdit: () => void
}

const DiagnosisForm = ({ initialValues, busy, submitLabel, onSubmit, onCancel, onEdit }: DiagnosisFormProps) => {
  const [values, setValues] = useState<DiagnosisWrite>(initialValues ?? { code: '', name: '' })
  const [errors, setErrors] = useState<DiagnosisFieldErrors>({})
  const [serverError, setServerError] = useState('')

  const handleChange = (field: keyof DiagnosisWrite, value: string) => {
    onEdit()
    setValues((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
    setServerError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const payload = { code: values.code.trim().toUpperCase(), name: values.name.trim() }
    const fieldErrors: DiagnosisFieldErrors = {}
    if ([...payload.code].length !== 6) fieldErrors.code = 'Код должен содержать 6 символов.'
    const nameLength = [...payload.name].length
    if (nameLength < 3 || nameLength > 128) fieldErrors.name = 'Введите от 3 до 128 символов.'
    setErrors(fieldErrors)
    setServerError('')
    if (Object.keys(fieldErrors).length > 0) return
    try {
      await onSubmit(payload)
      setValues(payload)
    } catch (error) {
      if (error instanceof DiagnosisApiError) {
        setErrors(error.fieldErrors)
        setServerError(error.message)
      } else {
        setServerError('Не удалось сохранить диагноз. Проверьте соединение и повторите попытку.')
      }
    }
  }

  return (
    <Styled.Form noValidate onSubmit={handleSubmit} aria-busy={busy}>
      {serverError && <Styled.Error severity="error">{serverError}</Styled.Error>}
      <Styled.Field
        id="diagnosis-code" name="code" label="Код" required fullWidth disabled={busy}
        value={values.code} error={Boolean(errors.code)} helperText={errors.code || '6 символов, например 4A40.0'}
        onChange={(event) => handleChange('code', event.target.value)}
      />
      <Styled.Field
        id="diagnosis-name" name="name" label="Наименование" required fullWidth disabled={busy}
        value={values.name} error={Boolean(errors.name)} helperText={errors.name || 'От 3 до 128 символов'}
        onChange={(event) => handleChange('name', event.target.value)}
      />
      <Styled.Actions>
        <Styled.ActionButton type="submit" variant="contained" disabled={busy}>{busy ? 'Подождите…' : submitLabel}</Styled.ActionButton>
        <Styled.ActionButton type="button" variant="outlined" disabled={busy} onClick={onCancel}>Отмена</Styled.ActionButton>
      </Styled.Actions>
    </Styled.Form>
  )
}

export default DiagnosisForm

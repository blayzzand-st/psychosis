import { useState, type FormEvent } from 'react'
import MenuItem from '@mui/material/MenuItem'
import { PatientApiError, type PatientWrite, type PatientFieldErrors } from '../../../api/patients'
import { administrativeSexOptions } from '../../../types/patient'
import * as Styled from './PatientForm.styles'

type PatientFormProps = {
  initialValues?: PatientWrite
  busy: boolean
  submitLabel: string
  onSubmit: (values: PatientWrite) => Promise<void>
  onCancel: () => void
  onEdit: () => void
}

type PatientFormValues = Omit<PatientWrite, 'patronymic'> & { patronymic: string }

const nameFields = [
  { name: 'first_name', label: 'Имя', required: true },
  { name: 'last_name', label: 'Фамилия', required: true },
  { name: 'patronymic', label: 'Отчество', required: false },
] as const

const getToday = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

const validBirthDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01' || value > getToday()) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const PatientForm = ({ initialValues, busy, submitLabel, onSubmit, onCancel, onEdit }: PatientFormProps) => {
  const [values, setValues] = useState<PatientFormValues>(initialValues ? {
    ...initialValues, patronymic: initialValues.patronymic ?? '',
  } : {
    first_name: '', last_name: '', patronymic: '', date_of_birth: '', administrative_sex: 'НУ', comment: '',
  })
  const [errors, setErrors] = useState<PatientFieldErrors>({})
  const [serverError, setServerError] = useState('')

  const handleChange = <Field extends keyof PatientFormValues>(field: Field, value: PatientFormValues[Field]) => {
    onEdit()
    setValues((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
    setServerError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const payload: PatientWrite = {
      first_name: values.first_name.trim(), last_name: values.last_name.trim(),
      patronymic: values.patronymic.trim() || null, date_of_birth: values.date_of_birth,
      administrative_sex: values.administrative_sex, comment: values.comment.trim(),
    }
    const fieldErrors: PatientFieldErrors = {}
    for (const { name, required } of nameFields) {
      const length = [...(payload[name] ?? '')].length
      if ((required && length < 1) || length > 64) fieldErrors[name] = required ? 'Введите от 1 до 64 символов.' : 'Допустимо не более 64 символов.'
    }
    if (!validBirthDate(payload.date_of_birth)) fieldErrors.date_of_birth = 'Укажите корректную дату рождения, не позднее сегодняшней.'
    if ([...payload.comment].length > 32) fieldErrors.comment = 'Допустимо не более 32 символов.'
    setErrors(fieldErrors)
    setServerError('')
    if (Object.keys(fieldErrors).length > 0) return
    try {
      await onSubmit(payload)
      setValues({ ...payload, patronymic: payload.patronymic ?? '' })
    } catch (error) {
      if (error instanceof PatientApiError) {
        setErrors(error.fieldErrors)
        setServerError(error.message)
      } else {
        setServerError('Не удалось сохранить пациента. Проверьте соединение и повторите попытку.')
      }
    }
  }

  return (
    <Styled.Form noValidate onSubmit={handleSubmit} aria-busy={busy}>
      {serverError && <Styled.Error severity="error">{serverError}</Styled.Error>}
      {nameFields.map(({ name, label, required }) => (
        <Styled.Field
          key={name} id={`patient-${name}`} name={name} label={label} required={required} fullWidth disabled={busy}
          value={values[name]} error={Boolean(errors[name])}
          helperText={errors[name] || (required ? 'От 1 до 64 символов' : 'Необязательно, до 64 символов')}
          onChange={(event) => handleChange(name, event.target.value)}
        />
      ))}
      <Styled.Field
        type="date" id="patient-date_of_birth" name="date_of_birth" label="Дата рождения" required fullWidth disabled={busy}
        value={values.date_of_birth} error={Boolean(errors.date_of_birth)} helperText={errors.date_of_birth}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: getToday() } }}
        onChange={(event) => handleChange('date_of_birth', event.target.value)}
      />
      <Styled.Field
        select id="patient-administrative_sex" name="administrative_sex" label="Административный пол" required fullWidth disabled={busy}
        value={values.administrative_sex} error={Boolean(errors.administrative_sex)} helperText={errors.administrative_sex}
        onChange={(event) => {
          const option = administrativeSexOptions.find((item) => item.value === event.target.value)
          if (option) handleChange('administrative_sex', option.value)
        }}
      >
        {administrativeSexOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
      </Styled.Field>
      <Styled.Field
        id="patient-comment" name="comment" label="Комментарий" fullWidth disabled={busy}
        value={values.comment} error={Boolean(errors.comment)} helperText={errors.comment || `${[...values.comment].length}/32 символа`}
        onChange={(event) => handleChange('comment', event.target.value)}
      />
      <Styled.Actions>
        <Styled.ActionButton type="submit" variant="contained" disabled={busy}>{busy ? 'Подождите…' : submitLabel}</Styled.ActionButton>
        <Styled.ActionButton type="button" variant="outlined" disabled={busy} onClick={onCancel}>Отмена</Styled.ActionButton>
      </Styled.Actions>
    </Styled.Form>
  )
}

export default PatientForm

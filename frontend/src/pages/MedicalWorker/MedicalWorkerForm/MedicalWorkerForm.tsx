import { useState, type FormEvent } from 'react'
import MenuItem from '@mui/material/MenuItem'
import {
  MedicalWorkerApiError,
  type MedicalWorkerWrite,
  type WorkerFieldErrors,
} from '../../../api/medicalWorkers'
import { medicalWorkerPositions, type MedicalWorkerPosition } from '../../../types/medicalWorkerPosition'
import * as Styled from './MedicalWorkerForm.styles'

type MedicalWorkerFormProps = {
  initialValues?: MedicalWorkerWrite
  busy: boolean
  submitLabel: string
  onSubmit: (values: MedicalWorkerWrite) => Promise<void>
  onCancel: () => void
  onEdit: () => void
}

const fields = [
  { name: 'first_name', label: 'Имя' },
  { name: 'last_name', label: 'Фамилия' },
] as const

type MedicalWorkerFormValues = Omit<MedicalWorkerWrite, 'position'> & {
  position: MedicalWorkerPosition | ''
}

const MedicalWorkerForm = ({ initialValues, busy, submitLabel, onSubmit, onCancel, onEdit }: MedicalWorkerFormProps) => {
  const [values, setValues] = useState<MedicalWorkerFormValues>(initialValues ?? {
    first_name: '', last_name: '', position: '',
  })
  const [errors, setErrors] = useState<WorkerFieldErrors>({})
  const [serverError, setServerError] = useState('')

  const handleChange = <Field extends keyof MedicalWorkerFormValues>(field: Field, value: MedicalWorkerFormValues[Field]) => {
    onEdit()
    setValues((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
    setServerError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return

    const trimmed = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
    }
    const fieldErrors: WorkerFieldErrors = {}
    for (const { name } of fields) {
      const length = [...trimmed[name]].length
      if (length < 3 || length > 24) fieldErrors[name] = 'Введите от 3 до 24 символов.'
    }
    const position = values.position
    if (!position) fieldErrors.position = 'Выберите должность.'
    setErrors(fieldErrors)
    setServerError('')
    if (Object.keys(fieldErrors).length > 0 || !position) return

    const payload: MedicalWorkerWrite = { ...trimmed, position }

    try {
      await onSubmit(payload)
      setValues(payload)
    } catch (error) {
      if (error instanceof MedicalWorkerApiError) {
        setErrors(error.fieldErrors)
        setServerError(error.message)
      } else {
        setServerError('Не удалось сохранить данные. Проверьте соединение и повторите попытку.')
      }
    }
  }

  return (
    <Styled.Form noValidate onSubmit={handleSubmit} aria-busy={busy}>
      {serverError && <Styled.Error severity="error">{serverError}</Styled.Error>}
      {fields.map(({ name, label }) => (
        <Styled.Field
          key={name}
          id={`worker-${name}`}
          name={name}
          label={label}
          required
          fullWidth
          disabled={busy}
          value={values[name]}
          error={Boolean(errors[name])}
          helperText={errors[name] || 'От 3 до 24 символов'}
          onChange={(event) => handleChange(name, event.target.value)}
        />
      ))}
      <Styled.Field
        select
        id="worker-position"
        name="position"
        label="Должность"
        required
        fullWidth
        disabled={busy}
        value={values.position}
        error={Boolean(errors.position)}
        helperText={errors.position || 'Выберите должность из списка'}
        onChange={(event) => {
          const position = medicalWorkerPositions.find((option) => option === event.target.value)
          if (position) handleChange('position', position)
        }}
      >
        {medicalWorkerPositions.map((position) => (
          <MenuItem key={position} value={position}>{position}</MenuItem>
        ))}
      </Styled.Field>
      <Styled.Actions>
        <Styled.ActionButton type="submit" variant="contained" disabled={busy}>
          {busy ? 'Подождите…' : submitLabel}
        </Styled.ActionButton>
        <Styled.ActionButton type="button" variant="outlined" disabled={busy} onClick={onCancel}>
          Отмена
        </Styled.ActionButton>
      </Styled.Actions>
    </Styled.Form>
  )
}

export default MedicalWorkerForm

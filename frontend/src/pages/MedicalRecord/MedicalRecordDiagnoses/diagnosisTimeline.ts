import type { DiagnosisSnapshot, MedicalRecordHistoryEntry } from '../../../api/medicalRecords.ts'

export type DiagnosisEpisode = {
  key: string
  diagnosis: DiagnosisSnapshot
  addedAt: string | null
  removedAt: string | null
  addedVersion: number
  removedVersion: number | null
  active: boolean
}

export const buildDiagnosisTimeline = (history: MedicalRecordHistoryEntry[], version: number): DiagnosisEpisode[] => {
  const episodes: DiagnosisEpisode[] = []
  const active = new Map<number, DiagnosisEpisode>()
  const revisions = history.filter((entry) => entry.version <= version).sort((a, b) => a.version - b.version)

  for (const revision of revisions) {
    const currentIds = new Set(revision.diagnoses.map((diagnosis) => diagnosis.diagnosis_id))
    for (const [id, episode] of active) {
      if (!currentIds.has(id)) {
        episode.active = false
        episode.removedAt = revision.updated_at
        episode.removedVersion = revision.version
        active.delete(id)
      }
    }
    for (const diagnosis of revision.diagnoses) {
      if (!active.has(diagnosis.diagnosis_id)) {
        const episode: DiagnosisEpisode = {
          key: `${diagnosis.diagnosis_id}-${revision.version}`, diagnosis: { ...diagnosis },
          addedAt: revision.updated_at, removedAt: null, addedVersion: revision.version, removedVersion: null, active: true,
        }
        episodes.push(episode)
        active.set(diagnosis.diagnosis_id, episode)
      }
    }
  }
  return episodes
}

import type { MedicalRecordHistoryEntry } from '../../../api/medicalRecords.ts'

export type PrescriptionEpisode = {
  key: string
  text: string
  addedAt: string | null
  endedAt: string | null
  addedVersion: number
  endedVersion: number | null
  active: boolean
  source: number | null
}

export const buildPrescriptionTimeline = (history: MedicalRecordHistoryEntry[], version: number): PrescriptionEpisode[] => {
  const episodes: PrescriptionEpisode[] = []
  let previous: PrescriptionEpisode[] = []
  const revisions = history.filter((entry) => entry.version <= version).sort((a, b) => a.version - b.version)

  for (const revision of revisions) {
    const create = (text: string, index: number): PrescriptionEpisode => {
      const episode: PrescriptionEpisode = {
        key: `${revision.version}-${index}`, text, addedAt: revision.updated_at, endedAt: null,
        addedVersion: revision.version, endedVersion: null, active: true, source: index,
      }
      episodes.push(episode)
      return episode
    }
    const end = (episode: PrescriptionEpisode) => {
      episode.active = false
      episode.endedAt = revision.updated_at
      episode.endedVersion = revision.version
      episode.source = null
    }
    let current: PrescriptionEpisode[]
    if (revision.prescription_sources) {
      // Version-scoped links distinguish even identical texts and reordered rows.
      current = revision.prescriptions.map((text, index) => {
        const source = revision.prescription_sources?.[index]
        const old = source === null || source === undefined ? undefined : previous[source]
        return old?.text === text ? old : create(text, index)
      })
    } else {
      const remaining = [...previous]
      const additions: string[] = []
      for (const change of revision.changes) {
        if (change.kind === 'prescription_cancelled') {
          const candidates = remaining.filter((episode) => episode.text === change.data.text)
          // Old journals have only text; do not invent which duplicate was cancelled.
          if (new Set(candidates.map((episode) => episode.addedAt)).size > 1) {
            candidates.forEach((episode) => { episode.addedAt = null })
          }
          if (candidates.length) {
            end(candidates[0])
            remaining.splice(remaining.indexOf(candidates[0]), 1)
          }
        } else if (change.kind === 'prescription_added') additions.push(change.data.text)
      }
      const ambiguous = new Set(additions.filter((text) => remaining.some((episode) => episode.text === text)
        && revision.prescriptions.filter((value) => value === text).length > 1))
      current = revision.prescriptions.map((text, index) => {
        const additionIndex = additions.indexOf(text)
        if (additionIndex !== -1) {
          additions.splice(additionIndex, 1)
          return create(text, index)
        }
        const previousIndex = remaining.findIndex((episode) => episode.text === text)
        return previousIndex === -1 ? create(text, index) : remaining.splice(previousIndex, 1)[0]
      })
      for (const text of ambiguous) {
        const matching = current.filter((episode) => episode.text === text)
        if (new Set(matching.map((episode) => episode.addedAt)).size > 1) matching.forEach((episode) => { episode.addedAt = null })
      }
    }
    previous.filter((episode) => episode.active && !current.includes(episode)).forEach(end)
    current.forEach((episode, index) => { episode.source = index })
    previous = current
  }
  return episodes
}

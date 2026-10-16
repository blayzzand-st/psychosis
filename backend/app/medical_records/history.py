from collections import Counter

from sqlalchemy import Engine, select
from sqlalchemy.orm import Session, selectinload

from app.medical_records.models import MedicalRecordChange, MedicalRecordRevision


def describe_changes(previous: MedicalRecordRevision | None, current: MedicalRecordRevision,
                     prescription_sources: list[int | None] | None = None) -> list[MedicalRecordChange]:
    """A prescription edit is recorded as cancellation of the old text and addition of the new text."""
    changes: list[tuple[str, dict]] = []
    if current.action == "created":
        changes.append(("record_created", {}))
    old_diagnoses = {item["diagnosis_id"]: item for item in previous.diagnoses} if previous else {}
    new_diagnoses = {item["diagnosis_id"]: item for item in current.diagnoses}
    for diagnosis_id, data in old_diagnoses.items():
        if diagnosis_id not in new_diagnoses:
            changes.append(("diagnosis_removed", data))
    for diagnosis_id, data in new_diagnoses.items():
        if diagnosis_id not in old_diagnoses:
            changes.append(("diagnosis_added", data))

    old_texts = previous.prescriptions if previous else []
    if prescription_sources is not None:
        # A source index identifies a row in the previous, version-checked snapshot.
        # This distinguishes editing A to B + cancelling old B from just cancelling A.
        replacements = {source: text for source, text in zip(prescription_sources, current.prescriptions) if source is not None}
        for index, text in enumerate(old_texts):
            if index not in replacements or replacements[index] != text:
                changes.append(("prescription_cancelled", {"text": text}))
        for source, text in zip(prescription_sources, current.prescriptions):
            if source is None or old_texts[source] != text:
                changes.append(("prescription_added", {"text": text}))
    else:
        # Older clients and historic snapshots contain only strings, so use their net difference.
        remaining_new = Counter(current.prescriptions)
        for text in old_texts:
            if remaining_new[text]:
                remaining_new[text] -= 1
            else:
                changes.append(("prescription_cancelled", {"text": text}))
        remaining_old = Counter(old_texts)
        for text in current.prescriptions:
            if remaining_old[text]:
                remaining_old[text] -= 1
            else:
                changes.append(("prescription_added", {"text": text}))
    if not changes:
        changes.append(("record_saved", {}))
    return [MedicalRecordChange(ordinal=index, kind=kind, data=data) for index, (kind, data) in enumerate(changes)]


def backfill_history(database_engine: Engine) -> None:
    """Populate the new action journal from existing immutable snapshots, once per revision."""
    with Session(database_engine) as session:
        revisions = session.scalars(
            select(MedicalRecordRevision).options(selectinload(MedicalRecordRevision.changes))
            .order_by(MedicalRecordRevision.medical_record_id, MedicalRecordRevision.version)
        )
        previous_by_record: dict[int, MedicalRecordRevision] = {}
        for revision in revisions:
            if not revision.changes:
                revision.changes = describe_changes(previous_by_record.get(revision.medical_record_id), revision)
            previous_by_record[revision.medical_record_id] = revision
        session.commit()

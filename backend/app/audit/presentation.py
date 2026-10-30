"""Readable audit descriptions without modifying historical rows."""
import re
from uuid import UUID

from sqlalchemy import select

from app.patients.models import Patient
from app.accounts.models import UserAccount
from app.medical_workers.models import MedicalWorker


ACCOUNT = re.compile(r'(?P<prefix>\b[Аа]ккаунт(?:а)? )(?P<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b')
WORKER = re.compile(r'(?P<prefix>\b[Мм]едработник(?:а)? )(?P<id>\d+)\b')


RECORD = re.compile(r'(?P<action>Создана|Изменена) ЭМК \d+ пациента (?P<id>\d+)\b')


def patient_name(first_name, last_name, patronymic):
    return f'{last_name} {first_name[0]}.' + (f'{patronymic[0]}.' if patronymic else '')


def referenced_ids(messages):
    accounts, workers, patients = set(), set(), set()
    for message in messages:
        accounts.update(UUID(match['id']) for match in ACCOUNT.finditer(message))
        workers.update(int(match['id']) for match in WORKER.finditer(message))
        patients.update(int(match['id']) for match in RECORD.finditer(message))
    return accounts, workers, patients


def session_names(session, account_ids, worker_ids, patient_ids):
    accounts = dict(session.execute(select(UserAccount.id, UserAccount.username)
                    .where(UserAccount.id.in_(account_ids))).all()) if account_ids else {}
    workers = {row.id: f'{row.first_name} {row.last_name}' for row in session.execute(
        select(MedicalWorker.id, MedicalWorker.first_name, MedicalWorker.last_name)
        .where(MedicalWorker.id.in_(worker_ids)))} if worker_ids else {}
    patients = {row.id: patient_name(row.first_name, row.last_name, row.patronymic) for row in session.execute(
        select(Patient.id, Patient.first_name, Patient.last_name, Patient.patronymic)
        .where(Patient.id.in_(patient_ids)))} if patient_ids else {}
    return accounts, workers, patients


def format_message(message, accounts, workers, patients):
    if message.startswith('Успешный вход администратора; аккаунт '):
        return 'Успешный вход администратора'
    message = RECORD.sub(lambda match: f'{match["action"]} ЭМК для пациента «{patients[int(match["id"])]}»'
                         if int(match['id']) in patients else match[0], message)
    message = ACCOUNT.sub(lambda match: match['prefix'] + f'«{accounts[UUID(match["id"])]}»'
                          if UUID(match['id']) in accounts else match[0], message)
    message = WORKER.sub(lambda match: match['prefix'] + f'«{workers[int(match["id"])]}»'
                      if int(match['id']) in workers else match[0], message)
    if message.startswith(('Создана ЭМК ', 'Изменена ЭМК ')):
        message = message.replace('; автор медработник ', '; автор ')
    return message


def present_events(rows, lookup):
    result = [dict(row) for row in rows]
    pending = [row for row in result if row.get('display_message') is None
               or RECORD.search(row['display_message'])
               or (row['display_message'].startswith(('Создана ЭМК ', 'Изменена ЭМК '))
                   and '; автор медработник ' in row['display_message'])]
    ids = referenced_ids(row.get('display_message') or row['message'] for row in pending)
    accounts, workers, patients = lookup(*ids)
    for row in pending:
        row['display_message'] = format_message(row.get('display_message') or row['message'], accounts, workers, patients)
    return result

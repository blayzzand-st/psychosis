from pydantic import TypeAdapter
from uuid import UUID
from sqlalchemy.orm import Session

from app.audit.models import AuditEvent
from app.audit.schemas import AuditActor
from app.admin_auth.models import Administrator
from app.accounts.models import UserAccount
from app.audit.presentation import format_message, referenced_ids, session_names
from app.events import DomainEvent, EventKind, current_actor, emit_event, event_bus


_actor_adapter = TypeAdapter(AuditActor)


def append_audit_event(session: Session, *, actor: str, message: str) -> AuditEvent:
    """Append in the caller's transaction; never commit a business operation here.

    actor is account:<UUID>, anonymous:<request UUID>, or system:<component>.
    Callers must derive it from trusted server context, never from client payload.
    Messages must not contain passwords, tokens, or TOTP secrets.
    """
    actor = _actor_adapter.validate_python(actor)
    if not message.strip():
        raise ValueError("Audit message must not be empty")
    label = None
    if actor.startswith('account:'):
        account_id = UUID(actor.split(':', 1)[1])
        administrator = session.get(Administrator, 1)
        if administrator is not None and administrator.account_id == account_id:
            label = 'Администратор'
        else:
            account = session.get(UserAccount, account_id)
            label = account.username if account is not None else None
    accounts, workers, patients = session_names(session, *referenced_ids([message]))
    entry = AuditEvent(actor=actor, actor_label=label, message=message,
                       display_message=format_message(message, accounts, workers, patients))
    session.add(entry)
    return entry


def audit_subscriber(session: Session, event: DomainEvent) -> None:
    eid = event.entity_id
    messages = {
        EventKind.WORKER_CREATED: f"Добавлен медработник {eid}",
        EventKind.WORKER_UPDATED: f"Изменён медработник {eid}",
        EventKind.WORKER_DELETED: f"Удалён медработник {eid} (логическое удаление)",
        EventKind.WORKER_RESTORED: f"Восстановлен медработник {eid}",
        EventKind.WORKER_ROLE_CHANGED: f"Медработник {eid}: роль изменена с {event.old_role} на {event.new_role}",
        EventKind.PATIENT_CREATED: f"Добавлен пациент {eid}",
        EventKind.PATIENT_UPDATED: f"Изменён пациент {eid}",
        EventKind.PATIENT_DELETED: f"Удалён пациент {eid}",
        EventKind.RECORD_CREATED: f"Создана ЭМК {eid} пациента {event.patient_id}; версия {event.version}; автор медработник {event.worker_id}",
        EventKind.RECORD_UPDATED: f"Изменена ЭМК {eid} пациента {event.patient_id}; версия {event.version}; автор медработник {event.worker_id}",
        EventKind.ACCOUNT_CREATED: f"Создан аккаунт {eid} для медработника {event.worker_id}",
        EventKind.ACCOUNT_PASSWORD_RESET: f"Сгенерирован новый пароль аккаунта {eid}",
        EventKind.ACCOUNT_ACTIVATED: f"Аккаунт {eid}: активирован",
        EventKind.ACCOUNT_DEACTIVATED: f"Аккаунт {eid}: деактивирован" + (f" при удалении медработника {event.worker_id}" if event.worker_id else ""),
        EventKind.ACCOUNT_DELETED: f"Удалён аккаунт {eid}; медработник и его история сохранены",
        EventKind.ADMIN_LOGGED_IN: f"Успешный вход администратора; аккаунт {eid}",
        EventKind.USER_LOGGED_IN: f"Успешный вход пользователя; аккаунт {eid}",
        EventKind.ADMIN_LOGIN_FAILED: "Неуспешная попытка входа администратора",
        EventKind.ADMIN_DELETED: "Удалён администратор; все его сессии завершены; требуется первоначальная настройка пароля и TOTP",
        EventKind.ADMIN_DELETE_FAILED: "Неуспешная попытка удаления администратора",
        EventKind.USER_LOGIN_FAILED: "Неуспешная попытка входа пользователя",
        EventKind.REFRESH_TOKENS_REVOKED: f"Аккаунт {eid}: отозвано refresh-токенов: {event.revoked_count}; причина: " + {
            'deactivated': 'деактивация аккаунта', 'password_changed': 'смена пароля',
            'role_changed': 'смена роли медработника', 'deleted': 'удаление аккаунта',
        }.get(event.reason, event.reason or 'изменение доступа'),
    }
    append_audit_event(session, actor=event.actor, message=messages[event.kind])


for _kind in EventKind:
    event_bus.subscribe(_kind, audit_subscriber)


def record_login_event(session: Session, *, administrator: bool, success: bool,
                       account_id: UUID | None = None) -> None:
    """Called by authentication handlers after checking credentials, never by UI navigation.

    The authentication handler owns committing failed attempts even if login is rejected.
    No passwords, tokens, TOTP codes or submitted credentials are recorded here.
    """
    if success:
        if account_id is None:
            raise ValueError("A successful login must identify its account")
        emit_event(session, EventKind.ADMIN_LOGGED_IN if administrator else EventKind.USER_LOGGED_IN,
                   account_id, actor=f"account:{account_id}")
    else:
        emit_event(session, EventKind.ADMIN_LOGIN_FAILED if administrator else EventKind.USER_LOGIN_FAILED)

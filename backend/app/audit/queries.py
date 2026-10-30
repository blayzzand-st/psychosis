"""Saved actor names, with a lookup for audit rows written before names were saved."""

AUDIT_SELECT = """
SELECT e.event_id, e.event_time, e.actor, e.message, e.display_message,
       COALESCE(e.actor_label,
                CASE WHEN a.account_id IS NOT NULL THEN 'Администратор'
                     ELSE u.username END) AS actor_label
FROM audit_events AS e
LEFT JOIN administrator AS a ON e.actor = 'account:' || a.account_id::text
LEFT JOIN user_accounts AS u ON e.actor = 'account:' || u.id::text
"""

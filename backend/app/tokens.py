"""Ed25519 JWT signatures: private key signs, public key verifies."""
from uuid import UUID
from datetime import timedelta

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
from fastapi import HTTPException
import jwt

from app.user_auth.models import AuthenticationKey

ISSUER = 'PsychosIS'
WORKER_AUDIENCE = 'PsychosIS-medical-worker'
ADMIN_AUDIENCE = 'PsychosIS-administrator'


def generate_keys():
    key = Ed25519PrivateKey.generate()
    private = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption()).decode()
    public = key.public_key().public_bytes(serialization.Encoding.PEM,
                                          serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    return private, public


def encode_token(session, claims, kind, seconds, audience=WORKER_AUDIENCE):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    return jwt.encode({**claims, 'typ': kind, 'iss': ISSUER, 'aud': audience,
                       'iat': now, 'exp': now + timedelta(seconds=seconds)},
                      session.get(AuthenticationKey, 1).private_key, algorithm='EdDSA')


def decode_token(session, token, kind, audience=WORKER_AUDIENCE):
    if not token or len(token) > 4096:
        raise HTTPException(401, 'Требуется вход в систему')
    try:
        claims = jwt.decode(token, session.get(AuthenticationKey, 1).public_key,
                            algorithms=['EdDSA'], issuer=ISSUER, audience=audience,
                            options={'require': ['sub', 'jti', 'ver', 'typ', 'iat', 'exp', 'iss', 'aud']})
        if claims['typ'] != kind or type(claims['ver']) is not int:
            raise ValueError('Wrong token type/version')
        UUID(claims['sub'])
        UUID(claims['jti'])
        return claims
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(401, 'Сессия недействительна. Войдите заново.') from None

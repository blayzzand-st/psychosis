"""RFC 6238 / RFC 4226, SHA-1, 30-second steps, 6 digits for authenticators."""
import base64
import hashlib
import hmac
import secrets
import struct
import time


def generate_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip('=')


def totp(secret: str, step: int, digits: int = 6) -> str:
    key = base64.b32decode(secret + '=' * (-len(secret) % 8))
    digest = hmac.digest(key, struct.pack('>Q', step), hashlib.sha1)
    offset = digest[-1] & 15
    value = struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff
    return str(value % (10 ** digits)).zfill(digits)


def current_step() -> int:
    return int(time.time() // 30)


def verify_totp(secret: str, code: str, *, last_step: int = -1, now: float | None = None) -> int | None:
    if len(code) != 6 or not code.isascii() or not code.isdigit():
        return None
    counter = current_step() if now is None else int(now // 30)
    for step in (counter, counter - 1, counter + 1):
        if step >= 0 and step > last_step and hmac.compare_digest(totp(secret, step), code):
            return step
    return None

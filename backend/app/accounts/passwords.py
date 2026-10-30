"""Argon2id for new passwords; read-only support for legacy scrypt hashes."""
import hashlib
import hmac
import secrets
import string

from argon2 import PasswordHasher, Type, extract_parameters
from argon2.exceptions import InvalidHashError, VerificationError


_hasher = PasswordHasher(
    time_cost=3, memory_cost=65536, parallelism=4,
    hash_len=32, salt_len=16, type=Type.ID,
)


def generate_password() -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(12))
        if (any(char in string.ascii_lowercase for char in password)
                and any(char in string.ascii_uppercase for char in password)
                and any(char in string.digits for char in password)):
            return password


def hash_password(password: str) -> str:
    if not password:
        raise ValueError("Password must not be empty")
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    if not isinstance(password, str) or not isinstance(password_hash, str):
        return False
    if password_hash.startswith("scrypt$"):
        return _verify_legacy_scrypt(password, password_hash)
    if not password_hash.startswith("$argon2id$"):
        return False
    try:
        parameters = extract_parameters(password_hash)
        # Bound work for corrupted or tampered stored hashes before calling Argon2.
        if not (1 <= parameters.memory_cost <= 262144
                and 1 <= parameters.time_cost <= 10
                and 1 <= parameters.parallelism <= 16
                and 8 <= parameters.salt_len <= 64
                and 16 <= parameters.hash_len <= 64):
            return False
        return _hasher.verify(password_hash, password)
    except (InvalidHashError, VerificationError, ValueError):
        return False


def _verify_legacy_scrypt(password: str, password_hash: str) -> bool:
    try:
        algorithm, n, r, p, salt_hex, digest_hex = password_hash.split("$")
        if (algorithm, n, r, p) != ("scrypt", "16384", "8", "1"):
            return False
        salt, expected = bytes.fromhex(salt_hex), bytes.fromhex(digest_hex)
        if len(salt) != 16 or len(expected) != 32:
            return False
        actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1, dklen=32)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False

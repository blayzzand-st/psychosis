"""TLS 1.3-only API, with the same entry point locally and in Docker."""
import os
from pathlib import Path
import ssl

import uvicorn


def tls_context(config, default_factory):
    context = default_factory()
    context.minimum_version = ssl.TLSVersion.TLSv1_3
    context.maximum_version = ssl.TLSVersion.TLSv1_3
    return context


if __name__ == '__main__':
    folder = Path(os.getenv('TLS_DIR', Path(__file__).resolve().parents[2] / '.local/tls'))
    uvicorn.run('app.main:app', host=os.getenv('API_HOST', '127.0.0.1'), port=8000,
                reload=os.getenv('API_RELOAD') == '1',
                reload_dirs=[str(Path(__file__).resolve().parent)] if os.getenv('API_RELOAD') == '1' else None,
                timeout_graceful_shutdown=3,
                ssl_certfile=str(folder / 'backend.crt'), ssl_keyfile=str(folder / 'backend.key'),
                ssl_context_factory=tls_context, proxy_headers=False)

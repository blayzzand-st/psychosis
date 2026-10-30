"""Copy a read-only TLS key mount, then drop privileges before starting the API."""
import os
from pathlib import Path
import pwd
import shutil
import tempfile


if __name__ == '__main__':
    account = pwd.getpwnam('app')
    source = Path(os.environ['TLS_DIR'])
    destination = Path(tempfile.mkdtemp(prefix='psychosis-tls-'))
    for name in ('backend.crt', 'backend.key'):
        target = destination / name
        shutil.copyfile(source / name, target)
        target.chmod(0o600)
        os.chown(target, account.pw_uid, account.pw_gid)
    os.chown(destination, account.pw_uid, account.pw_gid)
    os.environ['TLS_DIR'] = str(destination)
    os.setgroups([])
    os.setgid(account.pw_gid)
    os.setuid(account.pw_uid)
    os.execvp('python', ['python', '-m', 'app.serve'])

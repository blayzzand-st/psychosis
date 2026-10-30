"""Create a private lab CA and signed server certificates using OpenSSL."""
import argparse
import ipaddress
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def run(openssl, *args):
    result = subprocess.run([openssl, *map(str, args)], capture_output=True, text=True)
    if result.returncode:
        raise SystemExit(result.stderr)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--isu', required=True)
    parser.add_argument('--host', action='append', default=[], help='Additional DNS name or IP in the certificate')
    args = parser.parse_args()
    if not re.fullmatch(r'\d+', args.isu):
        parser.error('ISU must contain digits only')
    hosts = list(dict.fromkeys(['localhost', '127.0.0.1', '::1', *args.host]))
    for host in hosts:
        if not re.fullmatch(r'[a-zA-Z0-9.:-]+', host):
            parser.error('Invalid host')
    openssl = shutil.which('openssl')
    if not openssl and os.name == 'nt':
        candidate = Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'Git/usr/bin/openssl.exe'
        if candidate.is_file():
            openssl = str(candidate)
    if not openssl:
        parser.error('Install OpenSSL (on Windows it is also included with Git)')
    folder = ROOT / '.local/tls'
    folder.mkdir(parents=True, exist_ok=True)
    folder.chmod(0o700)
    if os.name == 'nt':
        owner = subprocess.check_output(['whoami'], text=True).strip()
        subprocess.run(['icacls', str(folder), '/inheritance:r', '/grant:r', f'{owner}:(OI)(CI)F'],
                       check=True, capture_output=True)
    # Keep the CA across restarts; never silently replace an existing trust anchor.
    ca_key, ca_cert = folder / 'ca.key', folder / 'ca.crt'
    identity = f'O = ITMO\nOU = MedSoft 2026/27 {args.isu}'
    if ca_key.exists() != ca_cert.exists():
        raise SystemExit('Incomplete CA: restore the matching ca.key/ca.crt pair before continuing')
    if not ca_cert.exists():
        config = folder / 'ca.cnf'
        config.write_text(f'''[req]
prompt = no
distinguished_name = dn
x509_extensions = ca
[dn]
{identity}
CN = PsychosIS Lab Root CA
[ca]
basicConstraints = critical, CA:true, pathlen:0
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
''', encoding='ascii')
        run(openssl, 'req', '-x509', '-newkey', 'rsa:3072', '-noenc', '-sha256', '-days', '3650',
            '-config', config, '-keyout', ca_key, '-out', ca_cert)
    subject = subprocess.check_output([openssl, 'x509', '-in', str(ca_cert), '-noout', '-subject'], text=True)
    if f'MedSoft 2026/27 {args.isu}' not in subject:
        raise SystemExit('Existing CA has a different ISU; use its matching identity or a separate certificate directory')
    for name, names in [('server', hosts), ('backend', [*hosts, 'backend'])]:
        config, key, csr, cert = [folder / f'{name}.{ext}' for ext in ('cnf', 'key', 'csr', 'crt')]
        sans = []
        for index, host in enumerate(names, 1):
            try:
                ipaddress.ip_address(host)
                kind = 'IP'
            except ValueError:
                kind = 'DNS'
            sans.append(f'{kind}.{index} = {host}')
        config.write_text(f'''[req]
prompt = no
distinguished_name = dn
req_extensions = server
[dn]
{identity}
CN = localhost
[server]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @names
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
[names]
''' + '\n'.join(sans) + '\n', encoding='ascii')
        # authorityKeyIdentifier needs the issuer and is added only while signing.
        request_config = folder / f'{name}-request.cnf'
        request_config.write_text(config.read_text().replace('authorityKeyIdentifier = keyid,issuer\n', ''), encoding='ascii')
        run(openssl, 'req', '-new', '-newkey', 'rsa:3072', '-noenc', '-sha256',
            '-config', request_config, '-keyout', key, '-out', csr)
        run(openssl, 'x509', '-req', '-in', csr, '-CA', ca_cert, '-CAkey', ca_key,
            '-set_serial', '0x' + os.urandom(16).hex(), '-days', '365', '-sha256',
            '-extfile', config, '-extensions', 'server', '-out', cert)
        key.chmod(0o600)
        run(openssl, 'verify', '-CAfile', ca_cert, '-verify_hostname', 'localhost', cert)
        csr.unlink()
        request_config.unlink()
    ca_key.chmod(0o600)
    print(f'CA certificate: {ca_cert}')
    print('Certificates created and verified. Private keys stay in .local/tls (excluded from Git).')


if __name__ == '__main__':
    main()

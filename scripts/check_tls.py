"""Check running HTTPS endpoints without disabling certificate verification."""
import argparse
import http.client
from pathlib import Path
import socket
import ssl


def check(host, port, ca):
    context = ssl.create_default_context(cafile=ca)
    context.minimum_version = context.maximum_version = ssl.TLSVersion.TLSv1_3
    connection = http.client.HTTPSConnection(host, port, context=context, timeout=5)
    try:
        connection.connect()
        assert connection.sock.version() == 'TLSv1.3'
        connection.request('GET', '/api/health')
        response = connection.getresponse()
        assert response.status == 200 and b'"status":"ok"' in response.read()
    finally:
        connection.close()
    for mode in ('TLS 1.2', 'untrusted CA', 'wrong hostname'):
        context = (ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT) if mode == 'untrusted CA'
                   else ssl.create_default_context(cafile=ca))
        if mode == 'TLS 1.2':
            context.minimum_version = context.maximum_version = ssl.TLSVersion.TLSv1_2
        try:
            with socket.create_connection((host, port), timeout=5) as raw:
                with context.wrap_socket(raw, server_hostname='wrong.invalid' if mode == 'wrong hostname' else host):
                    raise AssertionError(f'{port}: {mode} unexpectedly accepted')
        except ssl.SSLError:
            print(f'{port}: {mode} rejected')
    print(f'{port}: TLS 1.3, certificate chain, hostname and API health verified')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='localhost')
    parser.add_argument('--ports', nargs='+', type=int, default=[5173, 8000])
    parser.add_argument('--ca', default=str(Path(__file__).resolve().parents[1] / '.local/tls/ca.crt'))
    args = parser.parse_args()
    for port in args.ports:
        check(args.host, port, args.ca)

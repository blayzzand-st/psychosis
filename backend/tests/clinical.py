"""Explicit authenticated requests used by clinical business tests."""


def save_record(client, url, *, json):
    grant = client.post(url + '/unlock')
    return client.put(url, json={**json, 'edit_token': grant.json().get('edit_token', 'unavailable')})


def sign_in_worker(client, worker):
    if worker.get('role') != 'doctor':
        worker = client.put(f'/api/medical-workers/{worker["id"]}', json={
            'first_name': worker['first_name'], 'last_name': worker['last_name'],
            'position': worker['position'], 'role': 'doctor',
        }).json()
    result = client.post(f'/api/medical-workers/{worker["id"]}/account',
                         json={'username': f'worker{worker["id"]}'}).json()
    assert client.post('/api/user-auth/login', json={
        'username': result['account']['username'], 'password': result['password'],
    }).status_code == 200
    client.current_worker = worker
    return worker

"""Quick live API smoke test using only Python's standard library.

Run this against your local Django server with demo jobs seeded. It creates
throwaway accounts and tests that the user data is separate between accounts.
"""
import json
import os
import urllib.error
import urllib.request
from uuid import uuid4

BASE = os.getenv('WORKPASSPORT_API_URL', 'http://127.0.0.1:8000').rstrip('/')


def request(method, path, data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode()
            return resp.status, (json.loads(content) if content else {})
    except urllib.error.HTTPError as e:
        content = e.read().decode()
        return e.code, (json.loads(content) if content else {})


def expect(expected, actual, message):
    assert expected == actual, f'{message}: expected {expected}, received {actual}'
    print('PASS:', message)


if __name__ == '__main__':
    name = uuid4().hex[:8]
    expect(200, request('GET', '/api/health/')[0], 'Health endpoint')
    expect(401, request('GET', '/api/auth/me/')[0], 'Private profile requires login')
    for suffix in ('a', 'b'):
        status, _ = request('POST', '/api/auth/register/', {
            'username': name + suffix, 'email': f'{name}{suffix}@example.com',
            'password': 'TestAccountPassword!902', 'role': 'freelancer',
        })
        expect(201, status, 'User registration')
    tokens = []
    for suffix in ('a', 'b'):
        status, result = request('POST', '/api/auth/login/', {
            'username': name + suffix, 'password': 'TestAccountPassword!902',
        })
        expect(200, status, 'Login')
        tokens.append(result['access'])
    expect(201, request('POST', '/api/auth/me/skills/', {
        'name': 'Canva', 'level': 'beginner'
    }, tokens[0])[0], 'Create skill')
    status, result = request('GET', '/api/auth/me/skills/', token=tokens[1])
    expect(200, status, 'Other user can query their own skills')
    expect(0, result['count'], 'Skills are account-specific')
    status, jobs = request('GET', '/api/jobs/')
    expect(200, status, 'Published jobs endpoint')
    assert jobs['count'] > 0, 'Run: python manage.py seed_demo_jobs'
    job_id = jobs['results'][0]['id']
    expect(201, request('POST', f'/api/jobs/{job_id}/apply/', {
        'message': 'I can do the work.', 'proposed_rate_usd': '25.00',
    }, tokens[0])[0], 'Application submitted')
    expect(0, request('GET', '/api/me/applications/', token=tokens[1])[1]['count'], 'Applications are account-specific')
    print('All smoke checks completed.')

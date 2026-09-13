"""Run against an isolated test database: python tests/auth_smoke.py http://127.0.0.1:8081.
Creates two test accounts and one ticket; never point this at a production database.
"""
import http.cookiejar, json, sys, urllib.request, urllib.error, urllib.parse, uuid
base = sys.argv[1]
class Client:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
    def call(self, path, method='GET', body=None, csrf=True, form=False):
        headers = {}
        if method != 'GET' and csrf:
            _, token = self.call('/api/auth/csrf')
            headers[token['headerName']] = token['token']
        if body is not None:
            headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
            body = (urllib.parse.urlencode(body) if form else json.dumps(body)).encode()
        try:
            with self.http.open(urllib.request.Request(base+path, method=method, data=body, headers=headers), timeout=10) as response:
                data = response.read()
                return response.status, json.loads(data) if data else None
        except urllib.error.HTTPError as error:
            return error.code, None

import time
from pathlib import Path
import subprocess
import socket
root=Path(__file__).resolve().parents[2]
fixture=subprocess.Popen([str(root/'fixflow-ai-service/.venv/Scripts/python.exe'),str(root/'fixflow-backend/tests/analysis_fixture.py')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
try:
    for _ in range(50):
        with socket.socket() as connection:
            if connection.connect_ex(('127.0.0.1',8001))==0: break
        time.sleep(0.1)
    client=Client()
    email=uuid.uuid4().hex+'@example.test'
    assert client.call('/api/auth/register','POST',{'name':'Cache test','email':email,'password':'Example-password-123'})[0]==201
    assert client.call('/api/auth/login','POST',{'username':email,'password':'Example-password-123'},form=True)[0]==204
    body={'description':'Cache preservation test','location':'Lab'}
    code,preview=client.call('/api/analysis','POST',body)
    assert code==200 and preview['mode']=='GEMINI'
    fixture.terminate()
    fixture.wait(timeout=10)
    code,ticket=client.call('/api/incidents','POST',body)
    assert code==201 and ticket['aiSummary']==preview['summary'] and ticket['aiCategory']==preview['category']
    assert client.call('/api/incidents/'+str(ticket['id']))[1]['aiSummary']==preview['summary']
    code,edited=client.call('/api/incidents','POST',dict(body,location='Another lab'))
    assert code==201 and edited['aiMode'] is None
    other=Client(); email=uuid.uuid4().hex+'@example.test'
    assert other.call('/api/auth/register','POST',{'name':'Other','email':email,'password':'Example-password-123'})[0]==201
    assert other.call('/api/auth/login','POST',{'username':email,'password':'Example-password-123'},form=True)[0]==204
    assert other.call('/api/incidents','POST',body)[1]['aiMode'] is None
    print('PASS: preview saved despite provider outage; edited input and other sessions cannot reuse it.')
finally:
    if fixture.poll() is None:
        fixture.terminate()
        fixture.wait(timeout=10)

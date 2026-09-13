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

client = Client()
body = {'description':'Wi-Fi is not working','location':'Lab 2'}
assert client.call('/api/analysis','POST',body,csrf=False)[0] == 403
assert client.call('/api/analysis','POST',body)[0] == 401
email=uuid.uuid4().hex+'@example.test'
assert client.call('/api/auth/register','POST',{'email':email,'name':'Analysis test','password':'Example-password-123'})[0] == 201
assert client.call('/api/auth/login','POST',{'username':email,'password':'Example-password-123'},form=True)[0] == 204
assert client.call('/api/analysis','POST',{})[0] == 400
code, analysis = client.call('/api/analysis','POST',body)
assert code == 200 and analysis['mode']=='DEMO' and analysis['category']=='IT'
assert client.call('/api/incidents')[1] == []
print('PASS: authenticated Spring Boot to FastAPI request, CSRF, validation, demo contract, no ticket created by preview.')

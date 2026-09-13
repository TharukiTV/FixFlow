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
alice, bob = Client(), Client()
assert alice.call('/api/incidents')[0] == 401
assert alice.call('/api/auth/register','POST',{},csrf=False)[0] == 403
suffix = uuid.uuid4().hex
password = 'Example-strong-123!'
for client, name in [(alice,'Alice'),(bob,'Bob')]:
    email = name.lower()+suffix+'@example.test'
    profile = {'name':name,'email':email,'password':password}
    assert client.call('/api/auth/register','POST',dict(profile,password='short'))[0] == 400
    assert client.call('/api/auth/register','POST',profile)[0] == 201
    assert client.call('/api/auth/register','POST',dict(profile,email=email.upper()))[0] == 409
    assert client.call('/api/auth/login','POST',{'username':email,'password':'wrong'},form=True)[0] == 401
    assert client.call('/api/auth/me')[0] == 401
    assert client.call('/api/auth/login','POST',{'username':email.upper(),'password':password},form=True)[0] == 204
    code, current = client.call('/api/auth/me')
    assert code == 200 and current == {'name':name,'email':email,'role':'USER'}
code, ticket = alice.call('/api/incidents','POST',{'description':'Private test report','location':'Lab 2'})
assert code == 201
path = '/api/incidents/'+str(ticket['id'])
assert bob.call('/api/incidents')[1] == []
assert bob.call(path)[0] == 404
assert bob.call(path+'/status','PATCH',{'status':'RESOLVED','cause':'Unknown','resolution':'Fixed and checked.'})[0] == 403
assert alice.call(path+'/status','PATCH',{'status':'RESOLVED','cause':'Unknown','resolution':'Fixed and checked.'},csrf=False)[0] == 403
assert alice.call(path+'/status','PATCH',{'status':'INVALID'})[0] == 400
assert alice.call(path+'/status','PATCH',{'status':'RESOLVED','cause':'Unknown','resolution':'Fixed and checked.'})[0] == 403
assert alice.call('/api/auth/logout','POST')[0] == 204
assert alice.call('/api/auth/me')[0] == 401
assert alice.call(path)[0] == 401
print('PASS: registration, duplicate/invalid input, login, logout, CSRF, private ticket listing and cross-account access denial.')

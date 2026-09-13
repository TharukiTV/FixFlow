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

import subprocess
from pathlib import Path
psql = r'C:\Program Files\PostgreSQL\18\bin\psql.exe'
# This test intentionally targets only the isolated local test cluster.
assert base == 'http://127.0.0.1:8081'
suffix = uuid.uuid4().hex
password = 'Example-strong-123!'
clients = {}
for role in ['USER','ADMIN','TECHNICIAN','OTHER_TECH']:
    client = Client(); email = role.lower()+suffix+'@example.test'
    assert client.call('/api/auth/register','POST',{'name':role,'email':email,'password':password,'role':'ADMIN'})[0] == 201
    assert client.call('/api/auth/login','POST',{'username':email,'password':password},form=True)[0] == 204
    assert client.call('/api/auth/me')[1]['role'] == 'USER'
    clients[role] = (client,email)
    if role != 'USER':
        target = 'TECHNICIAN' if role == 'OTHER_TECH' else role
        subprocess.run([psql,'-X','-w','-h','127.0.0.1','-p','55432','-U','fixflow_test','-d','postgres','-v','email='+email,'-v','role='+target,'-f',str(Path(__file__).resolve().parents[1]/'scripts/set-role.sql')],check=True,capture_output=True)
        assert client.call('/api/auth/me')[1]['role'] == target
user, _ = clients['USER']; admin, _ = clients['ADMIN']; tech, tech_email = clients['TECHNICIAN']; other, other_email = clients['OTHER_TECH']
code, ticket = user.call('/api/incidents','POST',{'description':'Assign this test report','location':'Lab'})
assert code == 201
path = '/api/incidents/'+str(ticket['id'])
assert admin.call(path)[0] == 200
assert tech.call(path)[0] == 404
assert tech.call('/api/incidents')[1] == []
assert user.call('/api/incidents/technicians')[0] == 403
assert admin.call('/api/incidents/technicians')[0] == 200
assert user.call(path+'/assignment','PATCH',{'technicianEmail':tech_email})[0] == 403
assert tech.call(path+'/assignment','PATCH',{'technicianEmail':tech_email})[0] == 403
assert admin.call(path+'/assignment','PATCH',{'technicianEmail':clients['USER'][1]})[0] == 400
assert admin.call(path+'/assignment','PATCH',{'technicianEmail':tech_email},csrf=False)[0] == 403
assert admin.call(path+'/assignment','PATCH',{'technicianEmail':tech_email})[1]['assignedTechnician'] == tech_email
assert tech.call(path)[0] == 200
assert other.call(path)[0] == 404
assert other.call(path+'/status','PATCH',{'status':'RESOLVED','cause':'Unknown','resolution':'Fixed and checked.'})[0] == 404
assert user.call(path+'/status','PATCH',{'status':'RESOLVED','cause':'Unknown','resolution':'Fixed and checked.'})[0] == 403
assert tech.call(path+'/status','PATCH',{'status':'IN_PROGRESS'})[1]['status'] == 'IN_PROGRESS'
assert user.call(path)[1]['status'] == 'IN_PROGRESS'
assert admin.call(path+'/assignment','PATCH',{'technicianEmail':other_email})[0] == 200
assert tech.call(path)[0] == 404
assert tech.call(path+'/status','PATCH',{'status':'RESOLVED','cause':'Unknown','resolution':'Fixed and checked.'})[0] == 404
assert other.call(path+'/status','PATCH',{'status':'RESOLVED'})[0] == 400
assert other.call(path+'/status','PATCH',{'status':'RESOLVED','cause':' ','resolution':'Done'})[0] == 400
assert other.call(path+'/status','PATCH',{'status':'RESOLVED','cause':'Unknown','resolution':'x'*2001})[0] == 400
code, resolved=other.call(path+'/status','PATCH',{'status':'RESOLVED','cause':' Loose cable ','resolution':' Reconnected and tested. '})
assert code == 200 and resolved['cause']=='Loose cable' and resolved['resolution']=='Reconnected and tested.' and resolved['resolvedAt']
assert user.call(path)[1]['resolution']=='Reconnected and tested.'
assert admin.call(path)[1]['resolvedAt']==resolved['resolvedAt']
code,edited=other.call(path+'/status','PATCH',{'status':'RESOLVED','cause':'Loose cable','resolution':'Reconnected and tested twice.'})
assert code==200 and edited['resolvedAt']==resolved['resolvedAt']
code,reopened=other.call(path+'/status','PATCH',{'status':'OPEN'})
assert code==200 and reopened['resolution']==edited['resolution'] and reopened['resolvedAt']==edited['resolvedAt']
code,again=other.call(path+'/status','PATCH',{'status':'RESOLVED','cause':'Loose cable','resolution':'Cable replaced.'})
assert code==200 and again['resolvedAt']!=resolved['resolvedAt']
subprocess.run([psql,'-X','-w','-h','127.0.0.1','-p','55432','-U','fixflow_test','-d','postgres','-v','email='+other_email,'-v','role=USER','-f',str(Path(__file__).resolve().parents[1]/'scripts/set-role.sql')],check=True,capture_output=True)
assert other.call(path+'/status','PATCH',{'status':'OPEN'})[0] == 403
print('PASS: role promotion, registration privilege restriction, visibility, admin assignment, technician updates, reassignment, immediate demotion, CSRF.')

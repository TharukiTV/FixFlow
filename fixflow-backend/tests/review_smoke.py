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
assert base=='http://127.0.0.1:8081'
psql=r'C:\Program Files\PostgreSQL\18\bin\psql.exe'
user,admin,tech=Client(),Client(),Client()
for client,role in [(user,'USER'),(admin,'ADMIN'),(tech,'TECHNICIAN')]:
    email=uuid.uuid4().hex+'@example.test'
    assert client.call('/api/auth/register','POST',{'name':role,'email':email,'password':'Example-password-123'})[0]==201
    assert client.call('/api/auth/login','POST',{'username':email,'password':'Example-password-123'},form=True)[0]==204
    if role!='USER':
        subprocess.run([psql,'-X','-w','-h','127.0.0.1','-p','55432','-U','fixflow_test','-d','postgres','-v','email='+email,'-v','role='+role,'-f',str(Path(__file__).resolve().parents[1]/'scripts/set-role.sql')],capture_output=True,check=True)
    if role=='TECHNICIAN': tech_email=email
code,ticket=user.call('/api/incidents','POST',{'description':'Wi-Fi failure','location':'Lab','aiCategory':'SAFETY','reviewedPriority':'CRITICAL'})
assert code==201 and ticket['aiCategory']=='IT' and ticket['reviewedAt'] is None, (code, ticket)
path='/api/incidents/'+str(ticket['id'])
review={'category':'ELECTRICAL','priority':'HIGH','summary':'Staff checked: power issue.'}
assert user.call(path+'/review','PATCH',review)[0]==403
assert tech.call(path+'/review','PATCH',review)[0]==403
assert admin.call(path+'/review','PATCH',review,csrf=False)[0]==403
assert admin.call(path+'/review','PATCH',dict(review,category='WRONG'))[0]==400
assert admin.call(path+'/review','PATCH',dict(review,summary=' '))[0]==400
code, reviewed=admin.call(path+'/review','PATCH',review)
assert code==200 and reviewed['reviewedCategory']=='ELECTRICAL' and reviewed['reviewedAt']
assert reviewed['aiCategory']=='IT' and reviewed['aiSummary']=='Fixture summary'
assert user.call(path)[1]==reviewed
assert admin.call(path+'/assignment','PATCH',{'technicianEmail':tech_email})[0]==200
assert tech.call(path)[1]['reviewedPriority']=='HIGH'
assert tech.call(path+'/status','PATCH',{'status':'RESOLVED','cause':'Unknown','resolution':'Fixed and checked.'})[1]['aiSummary']=='Fixture summary'
for description in ['service unavailable','invalid response']:
    code,item=user.call('/api/incidents','POST',{'description':description,'location':'Lab'})
    assert code==201 and item['aiMode'] is None
    assert admin.call('/api/incidents/'+str(item['id'])+'/review','PATCH',review)[0]==200
assert admin.call('/api/incidents/999999999/review','PATCH',review)[0]==404
print('PASS: saved server analysis, rejected forged fields, admin-only review, original preserved, user/technician visibility, invalid/unavailable analysis fallback.')

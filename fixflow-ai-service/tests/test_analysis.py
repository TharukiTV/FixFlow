import unittest
import os
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

class AnalysisTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {"AI_MODE":"demo", "GEMINI_API_KEY":""})
        env.start()
        self.addCleanup(env.stop)
        self.client = TestClient(app)
    def test_demo_contract(self):
        response = self.client.post('/ai/analyze-incident', json={'description':'Wi-Fi is broken','location':'Lab 2'})
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertEqual(data['mode'],'DEMO')
        self.assertEqual(data['category'],'IT')
        self.assertIn('not AI',data['notice'])
    def test_unknown_and_plumbing_need_review(self):
        for text in ['Something happened','The pipe is leaking']:
            response=self.client.post('/ai/analyze-incident',json={'description':text,'location':'Lab'})
            self.assertEqual(response.json()['priority'],'UNASSESSED')
    def test_validation(self):
        for body in [{}, {'description':'   ','location':'Lab'}, {'description':'Valid','location':' '}, {'description':'x'*2001,'location':'Lab'}]:
            self.assertEqual(self.client.post('/ai/analyze-incident',json=body).status_code,422)
    def test_health(self):
        self.assertEqual(self.client.get('/health').json(),{'status':'ok','mode':'DEMO','configured':False})

if __name__ == '__main__': unittest.main()

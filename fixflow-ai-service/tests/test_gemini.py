import json
import os
import unittest
from unittest.mock import AsyncMock, patch
import httpx
from fastapi.testclient import TestClient
from app.main import app

class GeminiTests(unittest.TestCase):
    def setUp(self):
        env=patch.dict(os.environ, {'AI_MODE':'gemini','GEMINI_API_KEY':'fake-test-key','GEMINI_MODEL':'gemini-3.8-flash'})
        env.start(); self.addCleanup(env.stop)
        self.client=TestClient(app)
        sleep = patch("app.gemini.asyncio.sleep", new_callable=AsyncMock)
        sleep.start(); self.addCleanup(sleep.stop)
        self.report={'description':'Wi-Fi is down','location':'Lab 2'}
    def response(self, status, data):
        return httpx.Response(status,json=data,request=httpx.Request('POST','https://example.test'))
    def test_valid_response_and_key_header(self):
        data={'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps({'category':'IT','priority':'MEDIUM','summary':'Network unavailable in Lab 2.'})}]}}]}
        with patch('app.gemini.httpx.AsyncClient.post',new_callable=AsyncMock,return_value=self.response(200,data)) as call:
            response=self.client.post('/ai/analyze-incident',json=self.report)
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.json()['mode'],'GEMINI')
            self.assertNotIn('fake-test-key', response.text)
            self.assertEqual(call.call_args.kwargs['headers']['x-goog-api-key'],'fake-test-key')
            self.assertNotIn('fake-test-key',call.call_args.args[0])
            self.assertIn('/models/gemini-3.8-flash:generateContent',call.call_args.args[0])
            self.assertIn('responseJsonSchema',call.call_args.kwargs['json']['generationConfig'])
    def test_missing_key(self):
        with patch.dict(os.environ,{'GEMINI_API_KEY':''}), patch('app.gemini.httpx.AsyncClient.post',new_callable=AsyncMock) as call:
            self.assertEqual(self.client.post('/ai/analyze-incident',json=self.report).status_code,503)
            call.assert_not_called()
    def test_provider_failures(self):
        for status in [400,401,403,404,429,500]:
            with patch('app.gemini.httpx.AsyncClient.post',new_callable=AsyncMock,return_value=self.response(status,{'error':'secret provider details'})):
                response=self.client.post('/ai/analyze-incident',json=self.report)
                self.assertEqual(response.status_code,503)
                self.assertNotIn('secret provider details',response.text)
    def test_invalid_or_blocked_output(self):
        for data in [{}, {'candidates':[]}, {'candidates':[{'finishReason':'SAFETY'}]}, {'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':'{"category":"WRONG"}'}]}}]}]:
            with patch('app.gemini.httpx.AsyncClient.post',new_callable=AsyncMock,return_value=self.response(200,data)):
                self.assertEqual(self.client.post('/ai/analyze-incident',json=self.report).status_code,502)
    def test_timeout(self):
        with patch('app.gemini.httpx.AsyncClient.post',new_callable=AsyncMock,side_effect=httpx.ReadTimeout('secret')):
            self.assertEqual(self.client.post('/ai/analyze-incident',json=self.report).status_code,503)

    def test_safe_diagnostic_codes(self):
        for status, payload, code in [
            (400, {'error':{'details':[{'reason':'API_KEY_INVALID'}]}}, 'INVALID_KEY'),
            (403, {}, 'ACCESS_DENIED'), (404, {}, 'MODEL_UNAVAILABLE'), (400, {}, 'REQUEST_REJECTED')]:
            with patch('app.gemini.httpx.AsyncClient.post',new_callable=AsyncMock,return_value=self.response(status,payload)):
                result=self.client.post('/ai/analyze-incident',json=self.report)
                self.assertEqual(result.headers['X-Analysis-Error'],code)
                self.assertNotIn('fake-test-key', result.text)

    def test_transport_diagnostic_codes(self):
        for failure, code in [(httpx.ConnectError('private details'),'NETWORK_ERROR'), (httpx.ReadTimeout('private details'),'TIMEOUT')]:
            with patch('app.gemini.httpx.AsyncClient.post',new_callable=AsyncMock,side_effect=failure):
                response=self.client.post('/ai/analyze-incident',json=self.report)
                self.assertEqual(response.headers['X-Analysis-Error'],code)
                self.assertNotIn('private details',response.text)
        for status, code in [(429,'QUOTA_LIMIT'),(503,'PROVIDER_ERROR')]:
            with patch('app.gemini.httpx.AsyncClient.post',new_callable=AsyncMock,return_value=self.response(status,{})):
                self.assertEqual(self.client.post('/ai/analyze-incident',json=self.report).headers['X-Analysis-Error'],code)

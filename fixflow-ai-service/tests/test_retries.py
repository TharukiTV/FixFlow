import asyncio
import unittest
from unittest.mock import AsyncMock, patch
import httpx
from app.gemini import request_with_retries, analyze_with_gemini, retry_after_seconds
from fastapi import HTTPException

class RetryTests(unittest.IsolatedAsyncioTestCase):
    def response(self,status,headers=None):
        return httpx.Response(status,headers=headers,request=httpx.Request('POST','https://example.test'))
    async def test_recovers_with_backoff(self):
        client=AsyncMock()
        client.post.side_effect=[self.response(503),self.response(502),self.response(200)]
        with patch('app.gemini.asyncio.sleep',new_callable=AsyncMock) as sleep, patch('app.gemini.random.uniform',return_value=0):
            result=await request_with_retries(client,'https://example.test','test',{})
            self.assertEqual(result.status_code,200)
            self.assertEqual(client.post.await_count,3)
            self.assertEqual([call.args[0] for call in sleep.await_args_list],[1,2])
    async def test_no_retry_for_permanent_errors(self):
        for status in [400,401,403,404,200]:
            client=AsyncMock();client.post.return_value=self.response(status)
            await request_with_retries(client,'https://example.test','test',{})
            self.assertEqual(client.post.await_count,1)
    async def test_stops_after_three_attempts(self):
        client=AsyncMock();client.post.return_value=self.response(503)
        with patch('app.gemini.asyncio.sleep',new_callable=AsyncMock):
            self.assertEqual((await request_with_retries(client,'https://example.test','test',{})).status_code,503)
        self.assertEqual(client.post.await_count,3)
    async def test_retry_after(self):
        client=AsyncMock();client.post.side_effect=[self.response(429,{'Retry-After':'4'}),self.response(200)]
        with patch('app.gemini.asyncio.sleep',new_callable=AsyncMock) as sleep:
            await request_with_retries(client,'https://example.test','test',{})
            sleep.assert_awaited_once_with(4)
        client=AsyncMock();client.post.return_value=self.response(503,{'Retry-After':'120'})
        with patch('app.gemini.asyncio.sleep',new_callable=AsyncMock) as sleep:
            await request_with_retries(client,'https://example.test','test',{})
            sleep.assert_not_called()
        self.assertEqual(client.post.await_count,1)
    async def test_network_recovery(self):
        client=AsyncMock();client.post.side_effect=[httpx.ConnectError('private'),self.response(200)]
        with patch('app.gemini.asyncio.sleep',new_callable=AsyncMock):
            self.assertEqual((await request_with_retries(client,'https://example.test','test',{})).status_code,200)
    async def test_total_deadline(self):
        async def slow(*args,**kwargs):
            await asyncio.sleep(1)
        with patch.dict('os.environ',{'GEMINI_API_KEY':'fake'}), patch('app.gemini.TOTAL_REQUEST_SECONDS',0.03), patch('app.gemini.httpx.AsyncClient.post',side_effect=slow):
            with self.assertRaises(HTTPException) as caught:
                await analyze_with_gemini({'description':'test','location':'lab'})
            self.assertEqual(caught.exception.headers['X-Analysis-Error'],'TIMEOUT')
    def test_invalid_retry_after(self):
        self.assertEqual(retry_after_seconds('nonsense'),0)
        self.assertEqual(retry_after_seconds('-10'),0)

import os
import unittest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app, FixRanking, FixMatch

class RankingTests(unittest.TestCase):
    def test_ranking_validation(self):
        report = {"description": "Internet drops", "candidates": [{"id": 7, "description": "Wi-Fi disconnects", "cause": "Unknown", "resolution": "Restarted and tested"}]}
        with patch.dict(os.environ, {"AI_MODE": "gemini"}), TestClient(app) as client:
            for matches, expected in [([FixMatch(id=7, explanation="Both report lost connectivity.")], 200), ([], 200), ([FixMatch(id=99, explanation="Invented")], 502), ([FixMatch(id=7, explanation="a"), FixMatch(id=7, explanation="b")], 502)]:
                with patch('app.gemini.analyze_with_gemini', AsyncMock(return_value=FixRanking(matches=matches))):
                    self.assertEqual(client.post('/ai/similar-fixes', json=report).status_code, expected)
            with patch('app.gemini.analyze_with_gemini', AsyncMock()) as call:
                self.assertEqual(client.post('/ai/similar-fixes', json={"description":"Internet drops", "candidates":[]}).json(), {"matches":[]})
                call.assert_not_awaited()
            self.assertEqual(client.post('/ai/similar-fixes', json={**report, "candidates": report['candidates'] * 26}).status_code, 422)
        with patch.dict(os.environ, {"AI_MODE": "demo"}), TestClient(app) as client:
            self.assertEqual(client.post('/ai/similar-fixes', json=report).status_code, 503)

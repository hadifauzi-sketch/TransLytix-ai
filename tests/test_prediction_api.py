"""Run: python -m unittest discover -s tests -v (requires httpx)."""
import os
import unittest

os.environ['AI_API_TOKEN'] = 'local-test-token'
from fastapi.testclient import TestClient
from api_app import app


class PredictionApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.headers = {'X-AI-Token': 'local-test-token'}

    def test_private_api_and_no_legacy_routes(self):
        self.assertEqual(self.client.get('/api/health').status_code, 401)
        self.assertEqual(self.client.get('/api/health', headers=self.headers).status_code, 200)
        self.assertEqual(self.client.get('/api/transformers', headers=self.headers).status_code, 404)
        self.assertEqual(self.client.post('/api/auth/signup', headers=self.headers, json={}).status_code, 404)
        os.environ.pop('AI_API_TOKEN')
        try:
            self.assertEqual(self.client.get('/api/health', headers=self.headers).status_code, 503)
        finally:
            os.environ['AI_API_TOKEN'] = 'local-test-token'

    def test_arima_from_request_history(self):
        body = {'transformer': {'id': 'test-transformer'}, 'forecast_months': 2, 'gases': ['H2'],
                'history': [{'date': f'2025-{month:02d}-01', 'H2': 10 + month * 2}
                            for month in range(1, 9)]}
        response = self.client.post('/api/predict/arima', headers=self.headers, json=body)
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result['transformer_id'], 'test-transformer')
        self.assertIn('H2', result['forecasts'])
        self.assertEqual(len(result['forecasts']['H2']['forecasted_values']), 2)

    def test_invalid_history_is_rejected(self):
        response = self.client.post('/api/predict/arima', headers=self.headers,
                                    json={'transformer': {'id': 'test'}, 'history': []})
        self.assertEqual(response.status_code, 422)


if __name__ == '__main__':
    unittest.main()

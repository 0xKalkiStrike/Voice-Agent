import unittest
from backend.providers.stt import AssemblyAIRealtimeSTTProvider

class TestAssemblyAIRealtimeSTT(unittest.TestCase):
    def setUp(self):
        self.provider = AssemblyAIRealtimeSTTProvider(api_key="bb857c0cf0ae4adb8549aa38c975fdaa")

    def test_websocket_url_generation(self):
        url = self.provider.get_websocket_url(sample_rate=16000, model="universal-3-5-pro", language_code="hi")
        self.assertIn("wss://streaming.assemblyai.com/v3/ws", url)
        self.assertIn("sample_rate=16000", url)
        self.assertIn("speech_model=universal-3-5-pro", url)
        self.assertIn("language_code=hi", url)

    def test_headers(self):
        headers = self.provider.get_headers()
        self.assertEqual(headers["Authorization"], "bb857c0cf0ae4adb8549aa38c975fdaa")
        self.assertNotIn("Bearer", headers["Authorization"])

    def test_parse_event_turn_partial(self):
        raw_msg = '{"type": "Turn", "turn_order": 1, "end_of_turn": false, "transcript": "Check my project", "language_code": "en"}'
        parsed = self.provider.parse_event(raw_msg)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["event"], "transcript.partial")
        self.assertEqual(parsed["text"], "Check my project")
        self.assertFalse(parsed["end_of_turn"])

    def test_parse_event_turn_final(self):
        raw_msg = '{"type": "Turn", "turn_order": 1, "end_of_turn": true, "transcript": "Check my project status.", "language_code": "en"}'
        parsed = self.provider.parse_event(raw_msg)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["event"], "transcript.final")
        self.assertEqual(parsed["text"], "Check my project status.")
        self.assertTrue(parsed["end_of_turn"])

if __name__ == "__main__":
    unittest.main()

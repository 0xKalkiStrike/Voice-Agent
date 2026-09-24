import unittest
from backend.agent.brain import brain

class TestAgentBrain(unittest.TestCase):
    def test_math_turn(self):
        res = brain.process_turn("2 + 2")
        self.assertEqual(res["status"], "completed")
        self.assertIn("Calculated result", res["response"])

    def test_project_status_turn(self):
        res = brain.process_turn("check project status")
        self.assertEqual(res["status"], "completed")
        self.assertIn("Project Status", res["response"])

if __name__ == "__main__":
    unittest.main()

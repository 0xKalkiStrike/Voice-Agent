import unittest
from backend.tools.registry import tool_registry

class TestToolRegistry(unittest.TestCase):
    def test_list_tools(self):
        tools = tool_registry.list_tools()
        self.assertGreater(len(tools), 5)
        names = [t["name"] for t in tools]
        self.assertIn("calculator", names)
        self.assertIn("project_status", names)

    def test_calculator_execution(self):
        tool = tool_registry.get_tool("calculator")
        self.assertIsNotNone(tool)
        res = tool.run({"expression": "10 + 20 * 2"})
        self.assertTrue(res["ok"])
        self.assertEqual(res["data"]["value"], 50)

    def test_project_status_execution(self):
        tool = tool_registry.get_tool("project_status")
        self.assertIsNotNone(tool)
        res = tool.run({})
        self.assertTrue(res["ok"])
        self.assertIn("total_tasks", res["data"])

if __name__ == "__main__":
    unittest.main()

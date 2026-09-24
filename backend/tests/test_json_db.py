import unittest
import shutil
from pathlib import Path
from backend.db.json_db import JSONDatabase

class TestJSONDatabase(unittest.TestCase):
    def setUp(self):
        self.test_dir = Path("data_test_temp")
        self.test_dir.mkdir(exist_ok=True)
        self.db = JSONDatabase(data_dir=self.test_dir)

    def tearDown(self):
        if self.test_dir.exists():
            shutil.rmtree(self.test_dir)

    def test_insert_and_read(self):
        item = {"id": "1", "name": "test_item"}
        self.db.insert("test_collection", item)
        res = self.db.read_collection("test_collection")
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["name"], "test_item")

    def test_query(self):
        self.db.insert("items", {"id": "1", "category": "a"})
        self.db.insert("items", {"id": "2", "category": "b"})
        hits = self.db.query("items", lambda x: x.get("category") == "a")
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]["id"], "1")

    def test_delete(self):
        self.db.insert("items", {"id": "1"})
        removed = self.db.delete("items", lambda x: x.get("id") == "1")
        self.assertEqual(removed, 1)
        res = self.db.read_collection("items")
        self.assertEqual(len(res), 0)

if __name__ == "__main__":
    unittest.main()

import os
from dotenv import load_dotenv
from supabase import create_client, Client
from typing import Optional, List, Dict, Any

# Load environment variables from .env
load_dotenv()

class SupabaseDB:
    def __init__(self):
        url: str = os.getenv("SUPABASE_URL")
        key: str = os.getenv("SUPABASE_KEY")

        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")

        self.client: Client = create_client(url, key)

    def select(
        self,
        table: str,
        columns: str = "*",
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch rows from a table.
        Example: select("users", "id, name", {"status": "active"})
        """
        query = self.client.table(table).select(columns)

        if filters:
            for col, val in filters.items():
                query = query.eq(col, val)

        response = query.execute()
        return response.data

    def insert(self, table: str, data: Dict[str, Any] | List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Insert one or multiple rows.
        Returns the inserted rows (if RLS allows).
        """
        response = self.client.table(table).insert(data).execute()
        return response.data

    def update(
        self,
        table: str,
        data: Dict[str, Any],
        match: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Update rows matching the match conditions.
        Example: update("users", {"name": "Alice"}, {"id": 1})
        """
        query = self.client.table(table).update(data)

        for col, val in match.items():
            query = query.eq(col, val)

        response = query.execute()
        return response.data

    def delete(self, table: str, match: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Delete rows matching the match conditions.
        Example: delete("users", {"id": 1})
        """
        query = self.client.table(table).delete()

        for col, val in match.items():
            query = query.eq(col, val)

        response = query.execute()
        return response.data

    def upsert(self, table: str, data: Dict[str, Any] | List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Insert or update based on primary key conflict.
        """
        response = self.client.table(table).upsert(data).execute()
        return response.data


# Singleton instance for your backend to import
db = SupabaseDB()
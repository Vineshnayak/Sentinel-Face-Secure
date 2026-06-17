"""
MongoDB database connection using Motor (async driver)
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "sentinel_face")

class Database:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    
    @classmethod
    async def connect(cls):
        try:
            # For MongoDB Atlas (mongodb+srv), we often need tlsCAFile to ensure SSL verification works in Docker
            if "mongodb+srv://" in MONGODB_URI:
                import certifi
                cls.client = AsyncIOMotorClient(MONGODB_URI, tlsCAFile=certifi.where())
            else:
                cls.client = AsyncIOMotorClient(MONGODB_URI)
                
            cls.db = cls.client[DB_NAME]
            await cls.client.admin.command('ping')
            print(f"Connected to MongoDB database: {DB_NAME}")
        except Exception as e:
            print(f"Failed to connect to MongoDB: {e}")
            raise e
    
    @classmethod
    async def disconnect(cls):
        if cls.client:
            cls.client.close()
            cls.client = None
            cls.db = None
            print("Disconnected from MongoDB")
    
    @classmethod
    def get_db(cls) -> AsyncIOMotorDatabase:
        if cls.db is None:
            raise RuntimeError("Database not connected. Call Database.connect() first.")
        return cls.db
    
    @classmethod
    def get_collection(cls, name: str):
        if cls.db is None:
            raise RuntimeError("Database not connected. Call Database.connect() first.")
        return cls.db[name]

USERS_COLLECTION = "users"
LOGS_COLLECTION = "logs"

"""MongoDB client + helpers."""
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, date
import uuid

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def to_iso(v):
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return v


def serialize_doc(doc: dict) -> dict:
    """Strip _id and convert datetime fields."""
    if not doc:
        return doc
    doc.pop('_id', None)
    for k, v in list(doc.items()):
        if isinstance(v, (datetime, date)):
            doc[k] = v.isoformat()
    return doc


async def find_one(collection: str, query: dict) -> dict | None:
    d = await db[collection].find_one(query, {"_id": 0})
    return d


async def find_many(collection: str, query: dict | None = None, limit: int = 1000, sort: list | None = None) -> list:
    cur = db[collection].find(query or {}, {"_id": 0})
    if sort:
        cur = cur.sort(sort)
    return await cur.to_list(limit)


async def insert_one(collection: str, doc: dict):
    # Make copy; don't mutate caller; ensure no _id leaks back.
    d = dict(doc)
    await db[collection].insert_one(d)
    d.pop('_id', None)
    return d


async def update_one(collection: str, query: dict, updates: dict) -> int:
    res = await db[collection].update_one(query, {"$set": updates})
    return res.modified_count


async def delete_one(collection: str, query: dict) -> int:
    res = await db[collection].delete_one(query)
    return res.deleted_count


async def count(collection: str, query: dict | None = None) -> int:
    return await db[collection].count_documents(query or {})

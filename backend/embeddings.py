"""Lightweight TF-IDF based embeddings + cosine similarity retrieval (Mongo-backed RAG).
No external model download. Suitable for our small corpus (controls + observations + policies).
"""
import re
import math
from collections import Counter
from db import db, find_many, insert_one, now_iso, new_id


_STOP = set("a an the is are was were be been being have has had do does did will would could should may might can of in to for and or but with on at by from this that these those it its as if not no".split())


def _tokenize(text: str) -> list[str]:
    if not text:
        return []
    text = text.lower()
    return [w for w in re.findall(r"[a-z0-9]+", text) if w not in _STOP and len(w) > 2]


def _tf(tokens: list[str]) -> dict[str, float]:
    c = Counter(tokens)
    total = sum(c.values()) or 1
    return {k: v / total for k, v in c.items()}


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    if not common:
        return 0.0
    dot = sum(a[k] * b[k] for k in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


async def upsert_embedding(source_type: str, source_id: str, content: str, metadata: dict | None = None):
    tokens = _tokenize(content)
    tf = _tf(tokens)
    await db.embeddings.update_one(
        {"source_type": source_type, "source_id": source_id},
        {"$set": {
            "source_type": source_type, "source_id": source_id,
            "tokens": list(tf.keys())[:200],  # truncate to avoid bloat
            "tf": tf, "metadata": metadata or {},
            "preview": content[:300],
            "updated_at": now_iso(),
        }},
        upsert=True,
    )


async def similarity_search(query: str, k: int = 5, source_type: str | None = None) -> list[dict]:
    q_tf = _tf(_tokenize(query))
    if not q_tf:
        return []
    flt = {}
    if source_type:
        flt["source_type"] = source_type
    docs = await find_many("embeddings", flt, limit=2000)
    scored = []
    for d in docs:
        score = _cosine(q_tf, d.get("tf", {}))
        if score > 0:
            scored.append({"source_type": d["source_type"], "source_id": d["source_id"], "preview": d.get("preview"), "score": round(score, 4), "metadata": d.get("metadata", {})})
    scored.sort(key=lambda x: -x["score"])
    return scored[:k]


async def reindex_all():
    """One-shot: rebuild embeddings for all controls, observations, policies."""
    await db.embeddings.delete_many({})

    for c in await find_many("controls", limit=500):
        text = f"{c['control_name']} {c.get('description','')} {c.get('risk_if_failed','')} {c.get('category','')}"
        await upsert_embedding("control", c["control_id"], text, {"name": c["control_name"], "code": c.get("control_code"), "severity": c.get("severity")})

    for o in await find_many("observations", limit=500):
        text = f"{o['title']} {o.get('description','')} {o.get('root_cause','')} {o.get('business_impact','')}"
        await upsert_embedding("observation", o["observation_id"], text, {"title": o["title"], "severity": o["severity"], "status": o.get("status")})

    for p in await find_many("policies", limit=200):
        text = f"{p['policy_name']} {p.get('content','')[:1500]}"
        await upsert_embedding("policy", p["policy_id"], text, {"name": p["policy_name"], "code": p.get("policy_code")})

"""Mirror in-memory background-job dicts to MongoDB so polling works across
workers / pods / restarts (fixes "Job not found")."""
import asyncio
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
_COLL = "ai_jobs"


def _clean(job: dict) -> dict:
    return json.loads(json.dumps(job, default=str))


async def save_job(db, job: dict):
    if db is None or not job.get("job_id"):
        return
    doc = _clean(job)
    doc["_synced_at"] = datetime.now(timezone.utc).isoformat()
    await db[_COLL].replace_one({"job_id": doc["job_id"]}, doc, upsert=True)


def start_mirror(db, job: dict, interval: float = 1.5):
    """Persist `job` now and every `interval`s until its status leaves 'running'."""
    async def _loop():
        try:
            while True:
                await save_job(db, job)
                if job.get("status") not in ("running", "queued"):
                    break
                await asyncio.sleep(interval)
        except Exception as e:
            logger.warning(f"[job_store] mirror failed for {job.get('job_id')}: {e}")
    return asyncio.create_task(_loop())


async def get_job(db, memory: dict, job_id: str):
    job = memory.get(job_id)
    if job is not None:
        return job
    if db is None:
        return None
    doc = await db[_COLL].find_one({"job_id": job_id}, {"_id": 0})
    if not doc:
        return None
    if doc.get("status") in ("running", "queued"):
        try:
            age = (datetime.now(timezone.utc) - datetime.fromisoformat(doc["_synced_at"])).total_seconds()
        except Exception:
            age = 0
        if age > 120:
            doc["status"] = "failed"
            doc["error"] = "The server restarted while this job was running. Please start it again."
    doc.pop("_synced_at", None)
    return doc

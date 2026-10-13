"""Applies seed_data/*.json (live products, banners, certificates, taxonomy images) so the
deployed app shows the same catalogue + imagery as preview. Idempotent; never overwrites
admin edits after the first apply."""
import json
import logging
from pathlib import Path

SEED = Path(__file__).resolve().parents[1] / "seed_data"
LIVE_VERSION = "celestaglow-live-v1"
TAXO_VERSION = "taxonomy-icons-v2"
logger = logging.getLogger(__name__)


async def _flag(db, key):
    return await db.admin_settings.find_one({"type": "seed_flag", "key": key})


async def _set_flag(db, key):
    await db.admin_settings.update_one({"type": "seed_flag", "key": key}, {"$set": {"type": "seed_flag", "key": key}}, upsert=True)


async def apply_live_seed(db):
    live_file = SEED / "celestaglow_live.json"
    if live_file.exists():
        data = json.loads(live_file.read_text())
        for p in data.get("products", []):
            if not await db.products.find_one({"slug": p["slug"]}, {"_id": 1}):
                await db.products.insert_one(dict(p))
        for c in data.get("combos", []):
            if not await db.combos.find_one({"combo_id": c["combo_id"]}, {"_id": 1}):
                await db.combos.insert_one(dict(c))
        if not await _flag(db, LIVE_VERSION):
            for p in data.get("products", []):
                await db.products.update_one({"slug": p["slug"]}, {"$set": {k: v for k, v in p.items() if k != "_id"}})
            await db.products.update_many({"slug": "cleanser"}, {"$set": {"is_active": False}})
            settings = {k: v for k, v in data.get("site_settings", {}).items() if not k.startswith("taxonomy_canonical")}
            await db.site_settings.update_one({"_id": "main"}, {"$set": settings}, upsert=True)
            await db.admin_settings.update_one({"type": "top_banner"}, {"$set": {"type": "top_banner", **data.get("top_banner", {})}}, upsert=True)
            await db.admin_settings.update_one({"type": "niche_mode"}, {"$set": {"type": "niche_mode", **data.get("niche_mode", {})}}, upsert=True)
            if data.get("before_after") and not await db.before_after_images.count_documents({}):
                await db.before_after_images.insert_many([dict(b) for b in data["before_after"]])
            await _set_flag(db, LIVE_VERSION)
            logger.info("[live_seed] applied %s", LIVE_VERSION)

    taxo_file = SEED / "taxonomy_images.json"
    if taxo_file.exists():
        mapping = json.loads(taxo_file.read_text())
        first = not await _flag(db, TAXO_VERSION)
        for key in ("concerns", "categories", "subcategories"):
            for slug, url in (mapping.get(key) or {}).items():
                q = {"slug": slug} if first else {"slug": slug, "image": {"$in": [None, ""]}}
                await db[key].update_many(q, {"$set": {"image": url}})
        if first:
            await _set_flag(db, TAXO_VERSION)
            logger.info("[live_seed] applied %s", TAXO_VERSION)

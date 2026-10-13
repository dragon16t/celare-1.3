"""Import the 4 anti-aging products, kit, certificates and homepage banners from celestaglow.com.
Images are copied to our Cloudinary account (durable in preview + production) and the
result is written to seed_data/celestaglow_live.json, which server startup applies."""
import asyncio, hashlib, json, os, re, time
from pathlib import Path
import requests
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
LIVE = "https://celestaglow.com/api"
SEED_FILE = ROOT / "seed_data" / "celestaglow_live.json"
cloudinary.config(
    cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
    api_key=os.environ["CLOUDINARY_API_KEY"],
    api_secret=os.environ["CLOUDINARY_API_SECRET"],
    secure=True,
)
_CACHE = {}
URL_RE = re.compile(r'https://(?:res\.cloudinary\.com|customer-assets\.emergentagent\.com)[^"\s]+')
SLUGS = ["anti-aging-serum", "sunscreen", "anti-aging-cream", "under-eye-cream"]


def localize(url: str) -> str:
    if f"res.cloudinary.com/{os.environ['CLOUDINARY_CLOUD_NAME']}/" in url:
        return url
    if url not in _CACHE:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        for attempt in range(5):
            try:
                res = cloudinary.uploader.upload(
                    r.content, folder="celesta-glow/live-import",
                    public_id=hashlib.md5(url.encode()).hexdigest()[:16], overwrite=False,
                )
                break
            except Exception:
                if attempt == 4:
                    raise
                time.sleep(3)
        _CACHE[url] = res["secure_url"].replace("/image/upload/", "/image/upload/f_auto,q_100/", 1)
    return _CACHE[url]


def rewrite(obj):
    s = json.dumps(obj)
    for u in set(URL_RE.findall(s)):
        try:
            s = s.replace(u, localize(u))
        except Exception as e:
            print("skip", u, e)
    return json.loads(s)


def get(path):
    r = requests.get(f"{LIVE}/{path}", timeout=60)
    r.raise_for_status()
    return r.json()


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    products = [rewrite(get(f"products/{s}")) for s in SLUGS]
    for p in products:
        p.pop("days_to_launch", None)
        await db.products.replace_one({"slug": p["slug"]}, p, upsert=True)
    await db.products.delete_many({"slug": {"$nin": SLUGS}})

    for c in rewrite(get("combos")):
        c.pop("days_to_launch", None)
        await db.combos.replace_one({"combo_id": c["combo_id"]}, c, upsert=True)

    settings = rewrite(get("site-settings"))
    await db.site_settings.replace_one({"_id": "main"}, {"_id": "main", **settings}, upsert=True)

    tb = rewrite(get("top-banner"))
    await db.admin_settings.update_one({"type": "top_banner"}, {"$set": {"type": "top_banner", **tb}}, upsert=True)
    nm = get("niche-mode")
    await db.admin_settings.update_one({"type": "niche_mode"}, {"$set": {"type": "niche_mode", **nm}}, upsert=True)

    ba = rewrite(get("before-after"))
    await db.before_after_images.delete_many({})
    if ba:
        await db.before_after_images.insert_many([dict(b) for b in ba])
    combos = rewrite(get("combos"))
    for c in combos:
        c.pop("days_to_launch", None)
    SEED_FILE.parent.mkdir(exist_ok=True)
    SEED_FILE.write_text(json.dumps({
        "products": products, "combos": combos, "site_settings": settings,
        "top_banner": tb, "niche_mode": nm, "before_after": ba,
    }, indent=1, default=str))
    print("imported", len(products), "products, images:", len(_CACHE))


if __name__ == "__main__":
    asyncio.run(main())

"""Generate Shop-by-Concern / Shop-by-Category circle images with Gemini (direct key)
in the style of seed_data/icon_style_ref.jpg. Uploads to Cloudinary, updates Mongo and
writes seed_data/taxonomy_images.json so production gets the same images on startup.
Resumable: items that already have one of our generated images are skipped."""
import asyncio, io, json, os, sys
from pathlib import Path
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from google import genai
from google.genai import types as gt
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
SEED = ROOT / "seed_data"
MAP_FILE = SEED / "taxonomy_images.json"
REF = (SEED / "icon_style_ref.jpg").read_bytes()
FOLDER = "celesta-glow/taxonomy-icons"
cloudinary.config(cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"], api_key=os.environ["CLOUDINARY_API_KEY"],
                  api_secret=os.environ["CLOUDINARY_API_SECRET"], secure=True)
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
PALETTE = ["soft sage green", "blush pink", "warm peach", "powder blue", "buttery pale yellow",
           "light cream beige", "mint green", "pale lavender", "soft coral", "pale aqua"]


def prompt_for(kind, name, parent, i):
    color = PALETTE[i % len(PALETTE)]
    what = f"the skin concern '{name}'" if kind == "concern" else f"the skincare product type '{name}'" + (f" (a kind of {parent})" if parent else "")
    return (
        "The attached image shows a set of skincare icons. Create ONE NEW icon in EXACTLY that same visual style: "
        "a photorealistic macro close-up of a single cosmetic texture (gel blob, cream swatch, foam, serum droplets, "
        "oil drops, bubbles, powder, speckles or similar), softly lit, glossy and clean, centred, on a smooth "
        f"{color} pastel background that fills the whole square frame edge to edge. "
        f"The texture must clearly and creatively represent {what}. "
        "Square 1:1. No circle border, no ring, no text, no letters, no logo, no packaging, no hands, no faces."
    )


def gen_image(prompt):
    resp = client.models.generate_content(
        model="gemini-2.5-flash-image",
        contents=[prompt, gt.Part.from_bytes(data=REF, mime_type="image/jpeg")],
    )
    for part in (resp.candidates[0].content.parts if resp.candidates else []):
        if getattr(part, "inline_data", None) and part.inline_data.data:
            return part.inline_data.data
    raise RuntimeError("no image returned")


def to_jpeg(data):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def work(kind, item, i):
    for attempt in range(3):
        try:
            data = to_jpeg(gen_image(prompt_for(kind, item["name"], item.get("parent"), i)))
            res = cloudinary.uploader.upload(data, folder=FOLDER, public_id=f"{kind}-{item['slug']}", overwrite=True)
            return res["secure_url"]
        except Exception as e:
            print(f"retry {kind} {item['slug']}: {str(e)[:120]}", flush=True)
    return None


async def main():
    force = "--force" in sys.argv
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    mapping = json.loads(MAP_FILE.read_text()) if MAP_FILE.exists() else {"concerns": {}, "categories": {}}
    mapping.setdefault("subcategories", {})
    concerns = await db.concerns.find({"is_active": True}, {"_id": 0, "slug": 1, "name": 1, "image": 1}).to_list(500)
    cats = await db.categories.find(
        {"niche": {"$in": [None, "", "skincare", "skin-care"]}},
        {"_id": 0, "slug": 1, "name": 1, "parent": 1, "image": 1},
    ).to_list(1000)
    subs = await db.subcategories.find(
        {"niche": {"$in": [None, "", "skincare", "skin-care"]}},
        {"_id": 0, "slug": 1, "name": 1, "parent_category": 1, "image": 1},
    ).to_list(1000)
    for s in subs:
        s["parent"] = s.get("parent_category")
    jobs = [("concern", c) for c in concerns] + [("category", c) for c in cats] + [("subcategory", s) for s in subs]
    jobs = [(k, it) for k, it in jobs if force or FOLDER not in (it.get("image") or "")]
    print("to generate:", len(jobs), flush=True)
    sem = asyncio.Semaphore(4)

    async def run(i, kind, it):
        async with sem:
            url = await asyncio.to_thread(work, kind, it, i)
        if not url:
            print("FAILED", kind, it["slug"], flush=True)
            return
        coll, key = {"concern": (db.concerns, "concerns"), "category": (db.categories, "categories"),
                     "subcategory": (db.subcategories, "subcategories")}[kind]
        await coll.update_many({"slug": it["slug"]}, {"$set": {"image": url}})
        mapping[key][it["slug"]] = url
        MAP_FILE.write_text(json.dumps(mapping, indent=1))
        print("ok", kind, it["slug"], flush=True)

    await asyncio.gather(*(run(i, k, it) for i, (k, it) in enumerate(jobs)))
    print("DONE", flush=True)


if __name__ == "__main__":
    asyncio.run(main())

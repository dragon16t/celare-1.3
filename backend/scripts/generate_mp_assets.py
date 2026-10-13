"""Generate brand-consistent category tile images + sample doctor headshots via Gemini,
store locally and update Mongo. Run: python3 scripts/generate_mp_assets.py"""
import asyncio
import base64
import sys
from pathlib import Path

sys.path.insert(0, "/app/backend")
from dotenv import dotenv_values  # noqa: E402

KEY = dotenv_values("/app/backend/.env").get("EMERGENT_LLM_KEY")
OUT = Path("/app/backend/uploads/mp")
OUT.mkdir(parents=True, exist_ok=True)

STYLE = ("Professional square photograph for a premium Indian skincare brand. Soft natural window light, "
         "clean sage-green and white palette, minimal luxury spa aesthetic, shallow depth of field. "
         "No text, no words, no logos, no watermarks.")

CAT_SUBJECTS = {
    "Acne & Pimples": "close-up of a woman applying a clear gel spot treatment to her cheek, clean bathroom setting",
    "Pigmentation": "woman holding a small amber serum bottle near her face, even glowing skin",
    "Anti-Aging": "elegant Indian woman in her 40s applying face cream, radiant firm skin",
    "Hair & Scalp": "woman massaging oil into her hair roots, glossy healthy hair",
    "Sensitive Skin": "gentle hands applying fragrance-free white cream to an arm, soft towel nearby",
    "Skin Concerns": "dermatologist hands examining a patient's skin with a dermatoscope, clinic setting",
    "General Dermatology": "friendly dermatology clinic desk with stethoscope, plants and skin models",
    "View All": "flat lay of assorted skincare bottles and green leaves on white marble",
    "Facials": "woman relaxing during a facial treatment with white towel headband, spa room",
    "Hair Colouring": "stylist applying hair colour with a brush in a bright salon, foils visible",
    "Hair Spa": "woman enjoying a steam hair spa treatment, towel wrap, candles",
    "Hair & Scalp Care": "therapist massaging a client's scalp at a wash basin, spa salon",
    "Skin Cleansing": "woman washing her face with foam cleanser over a white sink, fresh and bright",
    "Beauty & Grooming": "neatly arranged grooming kit with scissors, comb and cream jars on green cloth",
    "Wellness Treatments": "relaxing back massage in a serene spa with candles and green plants",
    "View All Services": "spa flat lay with towels, candles, oil bottles and eucalyptus on white",
}

DOCTOR_SHOTS = {
    "dr.meera@sample.celestaglow.com": ("doc-sample-meera.png", "Professional headshot portrait of an Indian woman dermatologist in her late 30s, shoulder-length black hair, white clinic coat over a teal blouse, warm confident smile, pure white background, photorealistic, no text"),
    "dr.arjun@sample.celestaglow.com": ("doc-sample-arjun.png", "Professional headshot portrait of an Indian man dermatologist in his 40s, short black hair, light stubble, white clinic coat over a blue shirt, confident friendly expression, pure white background, photorealistic, no text"),
    "dr.sana@sample.celestaglow.com": ("doc-sample-sana.png", "Professional headshot portrait of a young Indian woman dermatologist in her early 30s wearing a hijab-friendly clinic look, white coat, gentle smile, pure white background, photorealistic, no text"),
}


async def gen(prompt: str, path: Path) -> bool:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    try:
        chat = LlmChat(api_key=KEY, session_id=f"gen-{path.stem}", system_message="You are a professional commercial photographer.")
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
        _, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
        if images:
            path.write_bytes(base64.b64decode(images[0]["data"]))
            print(f"OK {path.name}", flush=True)
            return True
        print(f"EMPTY {path.name}", flush=True)
    except Exception as exc:
        print(f"FAIL {path.name}: {str(exc)[:120]}", flush=True)
    return False


def update_mongo():
    import os
    import pymongo
    cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = cli[os.environ.get("DB_NAME", "test_database")]
    for title in CAT_SUBJECTS:
        fname = f"cat-{abs(hash(title)) % 10**8}.png"
        if (OUT / fname).exists():
            db.mp_categories.update_many({"title": title}, {"$set": {"image": f"/api/mp/media/{fname}"}})
    for email, (fname, _) in DOCTOR_SHOTS.items():
        if (OUT / fname).exists():
            url = f"/api/mp/media/{fname}"
            db.mp_doctors.update_many({"personal.email": email}, {"$set": {
                "photo.original_url": url, "photo.chosen": url, "photo.status": "approved"}})
    print("mongo updated", flush=True)


async def main():
    for title, subject in CAT_SUBJECTS.items():
        fname = f"cat-{abs(hash(title)) % 10**8}.png"
        if not (OUT / fname).exists():
            await gen(f"{STYLE} Subject: {subject}.", OUT / fname)
    for _, (fname, prompt) in DOCTOR_SHOTS.items():
        if not (OUT / fname).exists():
            await gen(prompt, OUT / fname)
    update_mongo()


if __name__ == "__main__":
    asyncio.run(main())

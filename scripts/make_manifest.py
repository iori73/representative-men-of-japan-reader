import json, glob, os

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "chunks")
files = sorted(glob.glob(os.path.join(OUT_DIR, "*.chunks.json")))

icons = {
    "00_prefatory_note": "00-letter.svg",
    "01_saigo_takamori": "01-mountain.svg",
    "02_uesugi_yozan": "02-crest.svg",
    "03_ninomiya_sontoku": "03-sheaf.svg",
    "04_nakae_toju": "04-lantern.svg",
    "05_nichiren": "05-lotus.svg",
}

chapters = []
for i, f in enumerate(files, start=0):
    base = os.path.basename(f).replace(".chunks.json", "")
    chunks = json.load(open(f, encoding="utf-8"))
    title = chunks[0]
    word_count = sum(len(c.get("en", "").split()) for c in chunks)
    reading_minutes = max(1, round(word_count / 200))
    chapters.append({
        "num": i,
        "slug": base,
        "jp_title": title["jp"],
        "en_title": title["en"],
        "icon": icons[base],
        "chunk_count": len(chunks),
        "reading_minutes": reading_minutes,
    })

manifest_path = os.path.join(OUT_DIR, "chapters.json")
json.dump(chapters, open(manifest_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
for c in chapters:
    print(c["num"], c["slug"], c["jp_title"], "|", c["en_title"], "~", c["reading_minutes"], "min")

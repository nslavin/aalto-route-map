"""
Downloads all images referenced in aalto_details.json and creates optimized
versions for preview (thumbnail), carousel (medium), and lightbox (large).

Outputs:
  data/images/<featureIdx>/<imageIdx>-thumb.webp   — 300px wide
  data/images/<featureIdx>/<imageIdx>-medium.webp  — 800px wide
  data/images/<featureIdx>/<imageIdx>-large.webp   — 1600px wide
  data/aalto_details.json                          — updated with local_images

Usage:
  pip install requests Pillow
  python scripts/download_images.py
"""

import json
import sys
import time
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

ROOT    = Path(__file__).parent.parent / "data"
INPUT   = ROOT / "aalto_details.json"
IMG_DIR = ROOT / "images"
HEADERS = {"User-Agent": "AaltoMapImageDL/1.0"}

SIZES = {
    "thumb":  300,
    "medium": 800,
    "large":  1600,
}


def download_image(url: str) -> Image.Image | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30, stream=True)
        r.raise_for_status()
        return Image.open(BytesIO(r.content))
    except Exception as e:
        print(f"    !! {url[:80]}: {e}")
        return None


def save_resized(img: Image.Image, out_dir: Path, basename: str) -> dict:
    paths = {}
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    w, h = img.size
    for label, max_w in SIZES.items():
        if w <= max_w:
            resized = img
        else:
            ratio = max_w / w
            resized = img.resize((max_w, round(h * ratio)), Image.LANCZOS)
        out = out_dir / f"{basename}-{label}.webp"
        resized.save(out, "WEBP", quality=82)
        paths[label] = str(out.relative_to(ROOT.parent))
    return paths


def process_feature(idx: str, det: dict) -> dict:
    out_dir = IMG_DIR / idx
    out_dir.mkdir(parents=True, exist_ok=True)

    local_images = {}

    cover = det.get("cover", {})
    cover_url = cover.get("url", "")
    if cover_url:
        existing = out_dir / "cover-thumb.webp"
        if existing.exists():
            local_images["cover"] = {
                label: f"data/images/{idx}/cover-{label}.webp"
                for label in SIZES
            }
        else:
            img = download_image(cover_url)
            if img:
                paths = save_resized(img, out_dir, "cover")
                local_images["cover"] = paths
                time.sleep(0.15)

    gallery = det.get("gallery", [])
    gallery_locals = []
    for gi, item in enumerate(gallery):
        url = item.get("url", "")
        if not url:
            gallery_locals.append({})
            continue
        if url == cover_url and "cover" in local_images:
            gallery_locals.append(local_images["cover"])
            continue
        existing = out_dir / f"{gi}-thumb.webp"
        if existing.exists():
            gallery_locals.append({
                label: f"data/images/{idx}/{gi}-{label}.webp"
                for label in SIZES
            })
        else:
            img = download_image(url)
            if img:
                paths = save_resized(img, out_dir, str(gi))
                gallery_locals.append(paths)
                time.sleep(0.15)
            else:
                gallery_locals.append({})

    local_images["gallery"] = gallery_locals
    return local_images


def main():
    details = json.loads(INPUT.read_text(encoding="utf-8"))
    IMG_DIR.mkdir(parents=True, exist_ok=True)

    total = len(details)
    for i, (idx, det) in enumerate(sorted(details.items(), key=lambda x: int(x[0]))):
        name_hint = det.get("cover", {}).get("caption", "")[:40] or f"feature {idx}"
        print(f"[{i+1:02d}/{total}] {idx}: {name_hint}")
        local = process_feature(idx, det)
        det["local_images"] = local

    INPUT.write_text(
        json.dumps(details, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"\n✓  Images saved to {IMG_DIR}")
    print(f"   Updated {INPUT}")


if __name__ == "__main__":
    main()

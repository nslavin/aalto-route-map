"""
Enriches aalto_route.geojson with per-object data scraped from visit.alvaraalto.fi.

Outputs:
  data/aalto_details.json   — dict keyed by feature index ("0"…"71")
  data/enrich_cache.json    — raw HTML per URL (re-extraction happens on every run)

Each entry in aalto_details.json:
  cover          — full-res featured image (og:image), with figcaption
  description    — EN full text (all paragraphs from div#paateksti)
  description_fi — FI full text
  phone          — contact phone number
  website        — official external website
  social         — { instagram, facebook, twitter } (object-specific accounts only)
  gallery        — [ { url, caption } … ] full-res images with figcaption captions

Usage (run on your local machine — needs internet access):
  pip install requests beautifulsoup4
  python scripts/enrich_aalto_route.py

Note: if upgrading from a previous version that cached extracted data,
delete data/enrich_cache.json so pages are re-fetched as raw HTML.
"""

import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT    = Path(__file__).parent.parent / "data"
INPUT   = ROOT / "aalto_route.geojson"
OUTPUT  = ROOT / "aalto_details.json"
CACHE   = ROOT / "enrich_cache.json"

HEADERS = {"User-Agent": "AaltoMapEnricher/1.0"}
DELAY   = 0.5  # seconds between requests

# Site-wide social accounts to ignore (not object-specific)
SITE_ACCOUNTS = {"visitalvaraalto", "alvaraaltoroute", "alvaraalto"}


# ── Cache (stores raw HTML strings) ───────────────────────────────────────────
def load_cache() -> dict:
    if CACHE.exists():
        data = json.loads(CACHE.read_text(encoding="utf-8"))
        # Detect old format (values were dicts, not strings) — discard it
        vals = list(data.values())
        if vals and not isinstance(vals[0], str):
            print("  Cache format changed — old cache discarded, will re-fetch all pages.")
            return {}
        return data
    return {}

def save_cache(cache: dict):
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


# ── HTTP ──────────────────────────────────────────────────────────────────────
def fetch_html(url: str) -> str | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        return r.text
    except Exception as e:
        print(f"    !! {url}: {e}")
        return None

def get_soup(url: str, cache: dict) -> BeautifulSoup | None:
    if url not in cache:
        html = fetch_html(url)
        if html is None:
            return None
        cache[url] = html
        save_cache(cache)
        time.sleep(DELAY)
    return BeautifulSoup(cache[url], "html.parser")


# ── Shared helper ─────────────────────────────────────────────────────────────
def base_key(url: str) -> str:
    """Strip size suffix and query string to get a canonical image key."""
    path = url.split("?")[0]
    path = re.sub(r"-\d+x\d+(\.[a-z]+)$", r"\1", path, flags=re.I)
    path = re.sub(r"-scaled(\.[a-z]+)$", r"\1", path, flags=re.I)
    return path


# ── Extractors ────────────────────────────────────────────────────────────────
def figcaption_for_link(a_tag) -> str:
    """Return figcaption text for an <a> tag, looking up through parent figures."""
    fig = a_tag.find_parent("figure")
    if fig:
        fc = fig.find("figcaption")
        if fc:
            return fc.get_text(" ", strip=True)
        # WordPress classic: <p class="wp-caption-text">
        wp = fig.find(class_="wp-caption-text")
        if wp:
            return wp.get_text(" ", strip=True)
    return ""


def extract_cover(soup: BeautifulSoup) -> dict:
    """og:image + figcaption (falling back to og:image:alt)."""
    url_tag = soup.find("meta", property="og:image")
    cover_url = url_tag["content"].strip() if url_tag and url_tag.get("content") else ""

    caption = ""
    if cover_url:
        cover_key = base_key(cover_url)
        for a in soup.find_all("a", href=True):
            if "/app/uploads/" in a["href"] and base_key(a["href"]) == cover_key:
                caption = figcaption_for_link(a)
                if caption:
                    break

    if not caption:
        alt_tag = soup.find("meta", property="og:image:alt")
        caption = alt_tag["content"].strip() if alt_tag and alt_tag.get("content") else ""

    return {"url": cover_url, "caption": caption}


def extract_description(soup: BeautifulSoup) -> str:
    """All paragraphs from div#paateksti, joined with double newline."""
    block = soup.find(id="paateksti")
    if not block:
        return ""
    parts = []
    for p in block.find_all("p"):
        text = p.get_text(" ", strip=True)
        if len(text) > 30:
            parts.append(text)
    return "\n\n".join(parts)


def extract_phone(soup: BeautifulSoup) -> str:
    a = soup.find("a", href=re.compile(r"^tel:"))
    return a.get_text(strip=True) if a else ""


def extract_website(soup: BeautifulSoup) -> str:
    for strong in soup.find_all("strong"):
        if "website" in strong.get_text(strip=True).lower():
            a = strong.find_next_sibling("a") or strong.find_next("a")
            if a and str(a.get("href", "")).startswith("http"):
                return a["href"].strip()
    return ""


def extract_social(soup: BeautifulSoup) -> dict:
    """Object-specific social links, skipping site-wide accounts."""
    result = {"instagram": "", "facebook": "", "twitter": ""}
    patterns = {
        "instagram": r"instagram\.com/([^/?#\"]+)",
        "facebook":  r"facebook\.com/([^/?#\"]+)",
        "twitter":   r"(?:twitter|x)\.com/([^/?#\"]+)",
    }
    for a in soup.find_all("a", href=True):
        href = a["href"]
        for network, pat in patterns.items():
            if result[network]:
                continue
            m = re.search(pat, href, re.I)
            if m:
                account = m.group(1).strip("/").lower()
                if account not in SITE_ACCOUNTS:
                    result[network] = href.strip()
    return result


def extract_gallery(soup: BeautifulSoup) -> list[dict]:
    """
    Full-res gallery images from <a href="…/app/uploads/…"><img></a>.
    Caption priority: <figcaption> > wp-caption-text > img alt.
    Deduplicates, preferring originals over thumbnails.
    """
    collected: dict[str, str] = {}   # url → caption

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/app/uploads/" not in href:
            continue
        if not re.search(r"\.(jpe?g|png|webp)(\?.*)?$", href, re.I):
            continue

        # Caption: figcaption > img alt
        caption = figcaption_for_link(a)
        if not caption:
            img = a.find("img")
            caption = img.get("alt", "").strip() if img else ""

        if href not in collected:
            collected[href] = caption

    # Deduplicate: prefer unsized/scaled over -NNNxNNN variants
    base_urls: dict[str, tuple[str, str]] = {}   # base_key → (url, caption)

    def is_sized(url: str) -> bool:
        return bool(re.search(r"-\d+x\d+\.", url))

    # First pass: unsized/scaled
    for url, cap in collected.items():
        if not is_sized(url):
            key = base_key(url)
            base_urls[key] = (url, cap)

    # Second pass: sized only if no better version exists
    for url, cap in collected.items():
        if is_sized(url):
            key = base_key(url)
            if key not in base_urls:
                base_urls[key] = (url, cap)

    return [{"url": url, "caption": cap} for url, cap in base_urls.values()]


# ── Scrape one page ────────────────────────────────────────────────────────────
def scrape_en(soup: BeautifulSoup) -> dict:
    return {
        "cover":       extract_cover(soup),
        "description": extract_description(soup),
        "phone":       extract_phone(soup),
        "website":     extract_website(soup),
        "social":      extract_social(soup),
        "gallery":     extract_gallery(soup),
    }


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    geojson  = json.loads(INPUT.read_text(encoding="utf-8"))
    cache    = load_cache()
    features = geojson["features"]
    details  = {}

    for i, feature in enumerate(features):
        props  = feature["properties"]
        url    = props.get("url") or ""
        url_fi = props.get("url_fi") or ""
        name   = props.get("name", "?")
        print(f"[{i+1:02d}/{len(features)}] {name}")

        # EN page
        soup_en = get_soup(url, cache) if url else None
        en = scrape_en(soup_en) if soup_en else {}

        # FI description
        fi_desc = ""
        if url_fi:
            soup_fi = get_soup(url_fi, cache)
            fi_desc = extract_description(soup_fi) if soup_fi else ""

        details[str(i)] = {
            "cover":          en.get("cover", {"url": "", "caption": ""}),
            "description":    en.get("description", ""),
            "description_fi": fi_desc,
            "phone":          en.get("phone", ""),
            "website":        en.get("website", ""),
            "social":         en.get("social", {"instagram": "", "facebook": "", "twitter": ""}),
            "gallery":        en.get("gallery", []),
        }

    OUTPUT.write_text(
        json.dumps(details, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"\n✓  {len(details)} objects → {OUTPUT}")
    print(f"   cache: {len(cache)} entries → {CACHE}")


if __name__ == "__main__":
    main()

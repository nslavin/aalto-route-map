import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

# Локали: EN и FI. Файлы можно скачать curl'ом (см. ниже).
HTML_EN = Path("data/aalto_route.html")
HTML_FI = Path("data/aalto_route_fi.html")
CACHE_EN_FI_URLS = Path("data/en_fi_url_cache.json")
BASE_URL = "https://visit.alvaraalto.fi"


def slug_from_url(url: str | None) -> str | None:
    """Из URL страницы объекта вытаскиваем slug для сопоставления EN/FI."""
    if not url:
        return None
    path = urlparse(url).path.rstrip("/")
    if not path:
        return None
    return path.split("/")[-1]


def read_lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines()


def extract_features(lines: list[str], lang: str):
    coord_re = re.compile(
        r"L\.marker\(\s*\[\s*([0-9.\-]+)\s*,\s*([0-9.\-]+)\s*\]",
    )

    features = []

    for i, line in enumerate(lines):
        if "L.marker(" not in line:
            continue

        m = coord_re.search(line)
        if not m:
            continue

        lat = float(m.group(1))
        lon = float(m.group(2))

        popup_line = line
        if ".bindPopup(" not in popup_line and i + 1 < len(lines):
            popup_line = lines[i + 1]

        popup_html = None
        if ".bindPopup(" in popup_line:
            first = popup_line.find("'")
            last = popup_line.rfind("'")
            if first != -1 and last != -1 and last > first:
                popup_html_raw = popup_line[first + 1 : last]
                # Только JS-экраны \' и \\ — без unicode_escape, он ломает UTF-8 (ä→Ã¤)
                popup_html = popup_html_raw.replace("\\'", "'").replace("\\\\", "\\")

        name = None
        address = None
        url = None
        image_url = None

        if popup_html:
            soup = BeautifulSoup(popup_html, "html.parser")

            a_tag = soup.find("a")
            url = a_tag["href"] if a_tag and a_tag.has_attr("href") else None

            h3 = soup.find("h3")
            name = h3.get_text(strip=True) if h3 else None

            addr_p = soup.find("p", class_="popup-osoite")
            address = addr_p.get_text(strip=True) if addr_p else None

            img = soup.find("img")
            if img and img.get("src"):
                image_url = img["src"].strip()

        slug = slug_from_url(url)

        feature = {
            "type": "Feature",
            "properties": {
                "name": name,
                "address": address,
                "url": url,
                "image": image_url,
                "slug": slug,
                "_lang": lang,
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat],
            },
        }
        features.append(feature)

    return features


def load_en_fi_cache() -> dict[str, str]:
    """en_url -> fi_url (из кэша или пусто)."""
    if CACHE_EN_FI_URLS.exists():
        return json.loads(CACHE_EN_FI_URLS.read_text(encoding="utf-8"))
    return {}


def save_en_fi_cache(cache: dict[str, str]) -> None:
    CACHE_EN_FI_URLS.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def get_fi_url_from_en_page(en_url: str, cache: dict[str, str], session: requests.Session) -> str | None:
    """Со страницы EN-объекта достаём ссылку на финскую версию (hreflang=fi)."""
    if en_url in cache:
        return cache[en_url] or None
    try:
        r = session.get(en_url, timeout=15)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        link = soup.find("link", rel="alternate", hreflang="fi")
        if link and link.get("href"):
            fi_url = link["href"].strip()
            cache[en_url] = fi_url
            return fi_url
    except Exception:
        pass
    cache[en_url] = ""
    return None


def merge_en_fi_by_links(
    features_en: list,
    features_fi: list,
    *,
    use_cache: bool = True,
    fetch_missing: bool = True,
) -> list:
    """
    Ровно 72 фичи (как EN). Для каждого EN-объекта ищем FI-страницу по ссылке
    со страницы (hreflang), затем подставляем name_fi, address_fi, url_fi из наших FI-данных.
    """
    cache = load_en_fi_cache() if use_cache else {}
    fi_by_url: dict[str, dict] = {}
    for f in features_fi:
        u = (f.get("properties") or {}).get("url")
        if u:
            fi_by_url[u] = f["properties"]

    session = requests.Session()
    session.headers.setdefault("User-Agent", "Mozilla/5.0 (compatible; AaltoMap/1.0)")
    out = []

    for f in features_en:
        feat = dict(f)
        p = feat["properties"]
        en_url = p.get("url")

        url_fi = None
        name_fi = None
        address_fi = None

        if en_url and fetch_missing:
            url_fi = get_fi_url_from_en_page(en_url, cache, session)
            if url_fi and url_fi in fi_by_url:
                fi_data = fi_by_url[url_fi]
                name_fi = fi_data.get("name")
                address_fi = fi_data.get("address")
                if not p.get("image") and fi_data.get("image"):
                    p["image"] = fi_data["image"]

        feat["properties"] = {
            "name": p.get("name"),
            "name_fi": name_fi,
            "address": p.get("address"),
            "address_fi": address_fi,
            "url": en_url,
            "url_fi": url_fi,
            "image": p.get("image"),
        }
        out.append(feat)
        if fetch_missing:
            time.sleep(0.35)

    if use_cache:
        save_en_fi_cache(cache)

    return out


def to_geojson(features: list) -> dict:
    return {"type": "FeatureCollection", "features": features}


def main():
    if not HTML_EN.exists():
        print(
            "EN HTML not found. Download:\n"
            f'  curl -L "https://visit.alvaraalto.fi/en/alvar-aalto-route/" -o {HTML_EN.name}'
        )
        if not HTML_FI.exists():
            print(
                f'  curl -L "https://visit.alvaraalto.fi/fi/alvar-aalto-reitti/" -o {HTML_FI.name}'
            )
        raise SystemExit(1)

    lines_en = read_lines(HTML_EN)
    features_en = extract_features(lines_en, "en")

    if HTML_FI.exists():
        lines_fi = read_lines(HTML_FI)
        features_fi = extract_features(lines_fi, "fi")
        features = merge_en_fi_by_links(features_en, features_fi)
        print(f"Merged by page links: {len(features)} features (EN {len(features_en)} + FI data by hreflang)")
    else:
        features = features_en
        for f in features:
            p = f["properties"]
            p.pop("slug", None)
            p.pop("_lang", None)
        print(
            f"Extracted {len(features)} features (EN only). For FI add:\n"
            f'  curl -L "https://visit.alvaraalto.fi/fi/alvar-aalto-reitti/" -o {HTML_FI.name}'
        )

    out_path = "data/aalto_route.geojson"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(to_geojson(features), f, ensure_ascii=False, indent=2)

    print(f"Written {out_path}")


if __name__ == "__main__":
    main()


#!/usr/bin/env python3
"""
Создаёт три кластеризованных GeoJSON:
1. aalto_clusters_countries.geojson — по странам (взвешенный центр, count, objects)
2. aalto_clusters_cities.geojson — по городам
3. aalto_clusters_helsinki_metropolitan.geojson — Helsinki metropolitan area: районы Хельсинки + Espoo + Vantaa
"""

import json
import re
from pathlib import Path
from collections import defaultdict

INPUT_GEOJSON = Path("data/aalto_route.geojson")
HELSINKI_DISTRICTS_CACHE = Path("data/helsinki_districts.geojson")
WFS_HELSINKI = (
    "https://kartta.hel.fi/ws/geoserver/avoindata/wfs"
    "?service=WFS&version=2.0.0&request=GetFeature"
    "&typeName=avoindata:Kaupunginosajako&outputFormat=json&SRSNAME=EPSG:4326"
)

# Ключевые слова для определения страны из адреса
COUNTRY_KEYS = {
    "Finland": ["Finland", "Suomi"],
    "Germany": ["Saksa", "Germany"],
    "Italy": ["Italia", "Italy"],
    "France": ["Ranska", "France"],
    "Estonia": ["Viro", "Estonia"],
    "Russia": ["Venäjä", "Russia", "Venaja"],
}

# Страны: EN → FI
COUNTRY_FI = {
    "Finland": "Suomi",
    "Germany": "Saksa",
    "Italy": "Italia",
    "France": "Ranska",
    "Estonia": "Viro",
    "Russia": "Venäjä",
}

# Районы Хельсинки: nimi_fi (UPPER) → (EN, FI)
HELSINKI_DISTRICT_I18N = {
    "ALPPIHARJU": ("Alppiharju", "Alppiharju"),
    "ETU-TÖÖLÖ": ("Etu-Töölö", "Etu-Töölö"),
    "KAARTINKAUPUNKI": ("City Centre", "Kaartinkaupunki"),
    "KALLIO": ("Kallio", "Kallio"),
    "KRUUNUNHAKA": ("Kruununhaka", "Kruununhaka"),
    "PUNAVUORI": ("Punavuori", "Punavuori"),
    "SILTASAARI": ("Siltasaari", "Siltasaari"),
    "VANHAKAUPUNKI": ("Vanhakaupunki", "Vanhakaupunki"),
}


def point_in_polygon(x: float, y: float, poly: list) -> bool:
    """Ray-casting: точка (lon, lat) внутри полигона."""
    n = len(poly)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i][0], poly[i][1]
        xj, yj = poly[j][0], poly[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def parse_country(address: str) -> str:
    """Определяем страну по адресу."""
    if not address:
        return "Unknown"
    addr = address.strip()
    for country, keys in COUNTRY_KEYS.items():
        if any(k.lower() in addr.lower() for k in keys):
            return country
    return "Finland"  # по умолчанию


def parse_city(address: str) -> str:
    """Извлекаем город из адреса (XXXXX City, Country)."""
    if not address:
        return "Unknown"
    parts = [p.strip() for p in address.split(",")]
    if len(parts) < 2:
        return "Unknown"
    # Предпоследняя часть часто: "XXXXX City" или "City Region"
    before_country = parts[-2]
    # Убираем почтовый индекс (5 цифр в начале)
    m = re.match(r"^\d{5}\s+(.+)$", before_country)
    if m:
        return m.group(1).strip()
    # Или последнее слово — регион, тогда предпредпоследняя — город
    tokens = before_country.split()
    for t in tokens:
        if not t.isdigit() and len(t) > 2:
            return t
    return before_country


def load_helsinki_districts() -> list[dict]:
    """Загружаем границы районов Хельсинки (из кэша или WFS)."""
    if HELSINKI_DISTRICTS_CACHE.exists():
        fc = json.loads(HELSINKI_DISTRICTS_CACHE.read_text(encoding="utf-8"))
        return fc.get("features", [])

    try:
        import urllib.request

        with urllib.request.urlopen(WFS_HELSINKI, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        fc = data if data.get("type") == "FeatureCollection" else {"features": data}
        HELSINKI_DISTRICTS_CACHE.write_text(
            json.dumps(fc, ensure_ascii=False), encoding="utf-8"
        )
        return fc.get("features", [])
    except Exception:
        return []


def find_helsinki_district(lon: float, lat: float, districts: list) -> str | None:
    """Определяем район Хельсинки по координатам."""
    for f in districts:
        geom = f.get("geometry")
        if not geom or geom.get("type") != "Polygon":
            continue
        coords = geom["coordinates"][0]
        if point_in_polygon(lon, lat, coords):
            return f.get("properties", {}).get("nimi_fi")
    return None


def to_feature_dict(f: dict) -> dict:
    """Краткое представление объекта для вложенного списка."""
    p = f.get("properties", {})
    return {
        "name": p.get("name"),
        "name_fi": p.get("name_fi"),
        "url": p.get("url"),
        "url_fi": p.get("url_fi"),
    }


def densest_centroid(features: list) -> tuple[float, float]:
    """Centroid of the densest local sub-group (~5 km proximity bucket)."""
    if not features:
        return (0.0, 0.0)
    coords = []
    for f in features:
        c = f.get("geometry", {}).get("coordinates")
        if c and len(c) >= 2:
            coords.append((c[0], c[1]))
    if not coords:
        return (0.0, 0.0)
    if len(coords) == 1:
        return coords[0]
    # Group by ~5 km proximity (0.05° ≈ 5 km)
    groups: dict = defaultdict(list)
    for lon, lat in coords:
        key = (round(lon / 0.05) * 0.05, round(lat / 0.05) * 0.05)
        groups[key].append((lon, lat))
    densest = max(groups.values(), key=len)
    return (sum(p[0] for p in densest) / len(densest), sum(p[1] for p in densest) / len(densest))


def build_clusters(
    features: list, key_fn, label_fn=None, label_fn_fi=None
) -> list[dict]:
    """Группируем по ключу. label_fn/label_fn_fi возвращают (name, name_fi) или строку."""
    groups = defaultdict(list)
    for f in features:
        k = key_fn(f)
        if k:
            groups[k].append(f)

    out = []
    for key, group in sorted(groups.items()):
        lon, lat = densest_centroid(group)
        label = label_fn(key) if label_fn else key
        if isinstance(label, tuple):
            name_en, name_fi = label[0], label[1]
        else:
            name_en = label
            name_fi = label_fn_fi(key) if label_fn_fi else label
        out.append({
            "type": "Feature",
            "properties": {
                "name": name_en,
                "name_fi": name_fi,
                "count": len(group),
                "objects": [to_feature_dict(g) for g in group],
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat],
            },
        })
    return out


def main():
    if not INPUT_GEOJSON.exists():
        raise SystemExit(f"Input {INPUT_GEOJSON} not found. Run extract_aalto_route.py first.")

    fc = json.loads(INPUT_GEOJSON.read_text(encoding="utf-8"))
    features = fc.get("features", [])

    # 1) По странам (name + name_fi + cities + city если один)
    def country_key_fn(f):
        return parse_country(f.get("properties", {}).get("address") or "")

    clusters_countries = build_clusters(
        features,
        key_fn=country_key_fn,
        label_fn=lambda k: (k, COUNTRY_FI.get(k, k)),
    )

    # Добавляем cities и city (если город один в стране)
    for feat in clusters_countries:
        country_name = feat["properties"]["name"]
        country_features = [f for f in features if country_key_fn(f) == country_name]
        cities_en = sorted({parse_city(f.get("properties", {}).get("address") or "") for f in country_features})
        cities_fi = sorted({parse_city(f.get("properties", {}).get("address_fi") or "") for f in country_features})
        cities_en = [c for c in cities_en if c and c != "Unknown"]
        cities_fi = [c for c in cities_fi if c and c != "Unknown"]
        if not cities_fi:
            cities_fi = cities_en
        feat["properties"]["cities"] = cities_en
        feat["properties"]["cities_fi"] = cities_fi
        if len(cities_en) == 1:
            feat["properties"]["city"] = cities_en[0]
            feat["properties"]["city_fi"] = cities_fi[0] if cities_fi else cities_en[0]

    Path("data/aalto_clusters_countries.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": clusters_countries}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Written aalto_clusters_countries.geojson ({len(clusters_countries)} clusters)")

    # 2) По городам (ключ: "City, Country")
    def city_key(f):
        props = f.get("properties", {})
        addr = props.get("address") or ""
        country = parse_country(addr)
        city = parse_city(addr)
        return f"{city}|{country}"

    def city_label(k):
        city, country = k.split("|", 1)
        country_fi = COUNTRY_FI.get(country, country)
        return (f"{city}, {country}", f"{city}, {country_fi}")

    clusters_cities = build_clusters(features, key_fn=city_key, label_fn=city_label)

    # Add object_name for single-object city clusters (used in map label)
    for feat in clusters_cities:
        if feat["properties"]["count"] == 1:
            obj = feat["properties"]["objects"][0]
            feat["properties"]["object_name"] = obj.get("name") or ""
            feat["properties"]["object_name_fi"] = obj.get("name_fi") or obj.get("name") or ""

    Path("data/aalto_clusters_cities.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": clusters_cities}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Written aalto_clusters_cities.geojson ({len(clusters_cities)} clusters)")

    # 3) Helsinki metropolitan area: Helsinki + Espoo + Vantaa (районы)
    districts = load_helsinki_districts()
    metro_features = []
    for f in features:
        props = f.get("properties", {})
        addr = (props.get("address") or "").lower()
        addr_fi = (props.get("address_fi") or "").lower()
        combined = addr + " " + addr_fi
        if not any(x in combined for x in ["helsinki", "helsingfors", "espoo", "vantaa"]):
            continue
        coords = f.get("geometry", {}).get("coordinates")
        if not coords or len(coords) < 2:
            continue
        metro_features.append(f)

    if not districts:
        print("Warning: Helsinki districts not available. Skipping aalto_clusters_helsinki_metropolitan.geojson")
    else:

        def metro_district_key(f):
            props = f.get("properties", {})
            addr = (props.get("address") or "").lower()
            addr_fi = (props.get("address_fi") or "").lower()
            combined = addr + " " + addr_fi
            coords = f.get("geometry", {}).get("coordinates")
            if not coords or len(coords) < 2:
                return None
            lon, lat = coords[0], coords[1]
            if "espoo" in combined:
                return "Espoo"
            if "vantaa" in combined:
                return "Vantaa"
            d = find_helsinki_district(lon, lat, districts)
            return d or "Helsinki (other)"

        def metro_label(k):
            if k == "Espoo":
                return ("Espoo", "Espoo")
            if k == "Vantaa":
                return ("Vantaa", "Vantaa")
            if k == "Helsinki (other)":
                return ("Helsinki (other)", "Helsinki (muut)")
            en, fi = HELSINKI_DISTRICT_I18N.get(k.upper() if k else "", (k.title(), k.title() if k else k))
            return (en, fi)

        clusters_metro = build_clusters(
            metro_features, key_fn=metro_district_key, label_fn=metro_label
        )
        # Add object_name for single-object metro clusters
        for feat in clusters_metro:
            if feat["properties"]["count"] == 1:
                obj = feat["properties"]["objects"][0]
                feat["properties"]["object_name"] = obj.get("name") or ""
                feat["properties"]["object_name_fi"] = obj.get("name_fi") or obj.get("name") or ""

        Path("data/aalto_clusters_helsinki_metropolitan.geojson").write_text(
            json.dumps({"type": "FeatureCollection", "features": clusters_metro}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"Written aalto_clusters_helsinki_metropolitan.geojson ({len(clusters_metro)} districts)")


if __name__ == "__main__":
    main()

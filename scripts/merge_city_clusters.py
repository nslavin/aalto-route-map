#!/usr/bin/env python3
"""
Merge city clusters with Helsinki metropolitan area clusters.

Removes Helsinki, Espoo, Vantaa entries from aalto_clusters_cities.geojson
and replaces them with the finer-grained features from
aalto_clusters_helsinki_metropolitan.geojson.

Output: data/aalto_clusters_cities_merged.geojson
"""

import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"

METRO_CITY_NAMES = {
    "Helsinki, Finland",
    "Espoo, Finland",
    "Vantaa, Finland",
}

def main():
    cities = json.loads((DATA / "aalto_clusters_cities.geojson").read_text("utf-8"))
    helsinki = json.loads((DATA / "aalto_clusters_helsinki_metropolitan.geojson").read_text("utf-8"))

    # Filter out Helsinki/Espoo/Vantaa from cities
    filtered = [f for f in cities["features"] if f["properties"]["name"] not in METRO_CITY_NAMES]

    # Add Helsinki metropolitan features
    filtered.extend(helsinki["features"])

    merged = {"type": "FeatureCollection", "features": filtered}

    out = DATA / "aalto_clusters_cities_merged.geojson"
    out.write_text(json.dumps(merged, ensure_ascii=False, indent=2), "utf-8")
    print(f"Wrote {len(filtered)} features to {out.name}")


if __name__ == "__main__":
    main()

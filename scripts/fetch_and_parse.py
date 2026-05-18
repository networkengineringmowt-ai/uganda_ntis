#!/usr/bin/env python3
"""
Fetch TIS AADT Excel files from Google Drive and parse to JSON.
Run BEFORE load_from_gdrive.py.

Requires:  pip install gdown openpyxl pandas
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

SCRIPT_DIR = Path(__file__).parent
DOWNLOAD_DIR = SCRIPT_DIR / "_downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)

# ── File catalogue ────────────────────────────────────────────────────────────
# Format: output_json_stem -> (gdrive_file_id, survey_year_hint, parser)
FILES = {
    "tis_2021": ("1YG1TyCcgOieZ_hNX87z9z9ubROwS776Q", 2021, "tis"),
    "tis_2022": ("1x0oRUi5YLYCyChm6y3AKCSTq1JF3TOFl", 2022, "tis"),
    "tis_2023": ("1fTDVMH2pYFXjkib50fE8QsqHY0M2M0sN", 2023, "tis"),
    "tis_2024": ("1w_NTWgDarzWR_3slQtv2pyZzqtQ22wn0", 2024, "tis"),
    "tis_2025": ("1TIhmzdrSLc-XL6p5JDl4fyei_QtcJgKc", 2025, "tis"),
    "tis_2017_2020": ("1GA0CxOVy_BA73MGV6C4jG7tUA3Xim1BY", None, "tis"),
    "stations_full": ("12oQIXVMKIJyr6ReVVA5dzSvi3J1NeOa7", None, "stations"),
    "atc_summary_full": ("1Fbw8QumEZ8KGwTml9pgJQohANazelPfK", None, "atc"),
    "aadt_summary": ("1a1Rdt0mhGbIWQx4gOD5clPSQWo1jv8zr", None, "aadt"),
}

# ── Download helpers ──────────────────────────────────────────────────────────

def download_gdrive(file_id: str, dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 1000:
        print(f"  Already downloaded: {dest.name}")
        return True
    print(f"  Downloading {dest.name} ...", end=" ", flush=True)
    try:
        import gdown
        gdown.download(id=file_id, output=str(dest), quiet=True)
        if dest.exists() and dest.stat().st_size > 500:
            print(f"OK ({dest.stat().st_size//1024} KB)")
            return True
        print("EMPTY - retrying without cookies")
        gdown.download(id=file_id, output=str(dest), quiet=True, use_cookies=False)
        if dest.exists() and dest.stat().st_size > 500:
            print(f"OK ({dest.stat().st_size//1024} KB)")
            return True
    except ImportError:
        print("gdown not installed — pip install gdown")
    except Exception as e:
        print(f"gdown error: {e}")

    # Fallback via requests (works for publicly shared files)
    try:
        import requests
        url = f"https://drive.google.com/uc?export=download&id={file_id}"
        s = requests.Session()
        r = s.get(url, stream=True, timeout=60)
        # Handle the "too large for virus scan" confirmation
        if "confirm=" in r.text:
            token = re.search(r'confirm=([0-9A-Za-z_-]+)', r.text)
            if token:
                r = s.get(url + f"&confirm={token.group(1)}", stream=True, timeout=120)
        dest.write_bytes(r.content)
        if dest.stat().st_size > 500:
            print(f"OK via requests ({dest.stat().st_size//1024} KB)")
            return True
    except Exception as e:
        print(f"requests error: {e}")

    print("FAILED")
    return False


# ── Parsing helpers ───────────────────────────────────────────────────────────

def to_int(v) -> int:
    try:
        return int(str(v).replace(",", "").strip().split(".")[0])
    except Exception:
        return 0


def open_excel(path: Path):
    """Return list of (sheet_name, DataFrame) with raw header=None."""
    try:
        xl = pd.ExcelFile(path, engine="openpyxl")
        result = []
        for sn in xl.sheet_names:
            try:
                df = xl.parse(sn, header=None)
                result.append((sn, df))
            except Exception:
                pass
        return result
    except Exception as e:
        print(f"  Cannot open {path.name}: {e}")
        return []


def find_header_row(df: pd.DataFrame, keywords: list[str]) -> int | None:
    """Scan first 40 rows for a row containing any keyword."""
    for i in range(min(40, len(df))):
        row_str = " ".join(str(v).lower() for v in df.iloc[i] if pd.notna(v))
        if any(kw.lower() in row_str for kw in keywords):
            return i
    return None


def col_index(header: list[str], *fragments) -> int | None:
    """Return first column index whose header contains any fragment (case-insensitive)."""
    for frag in fragments:
        for i, h in enumerate(header):
            if frag.lower() in h.lower():
                return i
    return None


def parse_date(raw) -> str:
    if isinstance(raw, str):
        raw = raw.strip()
        for fmt in ("%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d %b %Y"):
            try:
                return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
            except ValueError:
                pass
        return raw[:10] if raw else ""
    try:
        return pd.Timestamp(raw).strftime("%Y-%m-%d")
    except Exception:
        return ""


# ── TIS parser ────────────────────────────────────────────────────────────────

def parse_tis(path: Path, year_hint: int | None) -> list[dict]:
    """Parse a TIS AADT Excel file into a list of traffic count dicts."""
    records = []
    sheets = open_excel(path)
    if not sheets:
        return records

    for sheet_name, df in sheets:
        hr = find_header_row(df, ["weekday", "weekend", "link id", "link_id"])
        if hr is None:
            continue

        raw_header = [str(v).strip() for v in df.iloc[hr]]
        df2 = df.iloc[hr + 1 :].copy()
        df2.columns = range(len(df2.columns))
        df2 = df2.dropna(how="all").reset_index(drop=True)

        # Column mapping — try named columns, fall back to positional
        ci = lambda *frags: col_index(raw_header, *frags)
        c_section = ci("section id", "section_id") or 1
        c_link    = ci("link id", "link_id", "link no") or 2
        c_name    = ci("link name", "road name", "section name") or 3
        c_date    = ci("date", "count date", "survey date") or 4
        c_dir     = ci("direction") or 7
        c_nmt     = ci("nmt", "non-motor") or 10
        c_moto    = ci("motorcycle", "scooter") or 11
        c_car     = ci("saloon", "car", "taxi") or 12
        c_lgv     = ci("light goods", "lgv", "van", "pickup") or 13
        c_smb     = ci("small bus", "minibus", "matatu") or 14
        c_mdb     = ci("medium bus", "coaster") or 15
        c_lbus    = ci("large bus") or 16
        c_ltr     = ci("light.*truck", "light single") or 17
        c_hvt     = ci("heavy", "medium.*truck", "large.*truck") or 18
        c_trl     = ci("trailer", "semi") or 19

        for _, row in df2.iterrows():
            link_id = str(row.get(c_link, "")).strip()
            if not link_id or link_id.lower() in ("nan", "", "none"):
                continue

            count_date = parse_date(row.get(c_date, ""))
            # Infer year from date if no hint
            yr = year_hint
            if not yr and count_date and len(count_date) >= 4:
                try:
                    yr = int(count_date[:4])
                except ValueError:
                    pass

            moto = to_int(row.get(c_moto, 0))
            cars = to_int(row.get(c_car, 0))
            lgv  = to_int(row.get(c_lgv, 0))
            smb  = to_int(row.get(c_smb, 0))
            mdb  = to_int(row.get(c_mdb, 0))
            bus  = to_int(row.get(c_lbus, 0))
            ltr  = to_int(row.get(c_ltr, 0))
            hvt  = to_int(row.get(c_hvt, 0))
            trl  = to_int(row.get(c_trl, 0))
            nmt  = to_int(row.get(c_nmt, 0))

            dir_raw = row.get(c_dir, "")
            try:
                direction = int(dir_raw) if str(dir_raw).isdigit() else 0
            except Exception:
                direction = 0

            records.append({
                "link_id":     link_id,
                "section_id":  str(row.get(c_section, "")).strip(),
                "link_name":   str(row.get(c_name, "")).strip(),
                "count_date":  count_date,
                "survey_year": yr or 0,
                "direction":   direction,
                "total_count": moto + cars + lgv + smb + mdb + bus + ltr + hvt + trl,
                "motorcycles": moto,
                "cars_taxis":  cars + lgv,
                "buses":       smb + mdb + bus,
                "trucks":      ltr + hvt + trl,
                "nmt":         nmt,
            })

    return records


# ── Stations parser ───────────────────────────────────────────────────────────

def parse_stations(path: Path) -> list[dict]:
    records = []
    sheets = open_excel(path)
    for sheet_name, df in sheets:
        hr = find_header_row(df, ["station", "station id", "station_id", "atc"])
        if hr is None:
            continue

        raw_header = [str(v).strip() for v in df.iloc[hr]]
        df2 = df.iloc[hr + 1 :].copy()
        df2.columns = range(len(df2.columns))
        df2 = df2.dropna(how="all").reset_index(drop=True)

        ci = lambda *frags: col_index(raw_header, *frags)
        c_sid  = ci("station id", "station_id", "atc id", "counter") or 0
        c_name = ci("station name", "name") or 1
        c_link = ci("link id", "link_id") or 2
        c_lnm  = ci("link name", "road name") or 3
        c_lat  = ci("lat") or 4
        c_lon  = ci("lon", "lng") or 5
        c_reg  = ci("region", "district") or 6

        for _, row in df2.iterrows():
            sid = str(row.get(c_sid, "")).strip()
            if not sid or sid.lower() in ("nan", "", "none"):
                continue
            try:
                lat = float(row.get(c_lat, 0) or 0)
                lon = float(row.get(c_lon, 0) or 0)
            except Exception:
                lat = lon = 0.0

            records.append({
                "station_id":   sid,
                "station_name": str(row.get(c_name, sid)).strip(),
                "link_id":      str(row.get(c_link, "")).strip(),
                "link_name":    str(row.get(c_lnm, "")).strip(),
                "latitude":     lat or None,
                "longitude":    lon or None,
                "region":       str(row.get(c_reg, "")).strip() or None,
            })
    return records


# ── ATC summary parser ────────────────────────────────────────────────────────
# The ATC DATA SUMMARY file uses a wide format: one sheet per station,
# row 0 = ["Station Name", "Sum of Mon-YY", ...], last row = Grand Total.

_MON_ABBR = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

def _parse_mon_year(col_header: str):
    """Parse 'Sum of Aug-16' -> (2016, 8).  Returns (None, None) on failure."""
    m = re.search(r"([A-Za-z]{3})-?(\d{2,4})", str(col_header))
    if not m:
        return None, None
    mon = _MON_ABBR.get(m.group(1).lower())
    yr_raw = int(m.group(2))
    year = yr_raw + 2000 if yr_raw < 100 else yr_raw
    return year, mon


def parse_atc(path: Path) -> list[dict]:
    records = []
    sheets = open_excel(path)
    for sheet_name, df in sheets:
        if sheet_name.strip().lower().startswith("atc data summary"):
            continue  # skip the wide pivot summary sheet
        if "Kutools" in sheet_name:
            continue
        if df.empty or len(df.columns) < 3:
            continue

        # Row 0 = headers: col 0 = station/category label, cols 1+ = "Sum of Mon-YY"
        headers = [str(v).strip() for v in df.iloc[0]]
        station_id = headers[0].replace(" (ADT)", "").strip() or sheet_name.strip()

        # Find the Grand Total row
        grand_row = None
        for i in range(1, len(df)):
            cell = str(df.iloc[i, 0]).strip().lower()
            if "grand total" in cell or "total" == cell:
                grand_row = i
                break
        if grand_row is None:
            continue

        total_row = df.iloc[grand_row]
        for j in range(1, len(headers)):
            year, month = _parse_mon_year(headers[j])
            if not year:
                continue
            aadt = to_int(total_row.iloc[j])
            if aadt == 0:
                continue
            records.append({
                "station_id": station_id,
                "year":       year,
                "month":      month,
                "aadt":       aadt,
            })

    return records


# ── AADT/Growth Factor parser ─────────────────────────────────────────────────

def parse_aadt(path: Path) -> list[dict]:
    records = []
    sheets = open_excel(path)
    for sheet_name, df in sheets:
        hr = find_header_row(df, ["link", "aadt", "year", "growth"])
        if hr is None:
            hr = 0

        raw_header = [str(v).strip() for v in df.iloc[hr]]
        df2 = df.iloc[hr + 1 :].copy()
        df2.columns = range(len(df2.columns))
        df2 = df2.dropna(how="all").reset_index(drop=True)

        ci = lambda *frags: col_index(raw_header, *frags)
        c_link = ci("link id", "link_id") or 0
        c_name = ci("link name", "road name") or 1
        c_year = ci("year") or 2
        c_aadt = ci("aadt", "adt", "traffic") or 3

        for _, row in df2.iterrows():
            link_id = str(row.get(c_link, "")).strip()
            if not link_id or link_id.lower() in ("nan", "", "none"):
                continue
            aadt = to_int(row.get(c_aadt, 0))
            if aadt == 0:
                continue
            records.append({
                "link_id":   link_id,
                "link_name": str(row.get(c_name, "")).strip(),
                "year":      to_int(row.get(c_year, 0)),
                "aadt":      aadt,
            })
    return records


# ── Main ──────────────────────────────────────────────────────────────────────

PARSERS = {
    "tis":      parse_tis,
    "stations": parse_stations,
    "atc":      parse_atc,
    "aadt":     parse_aadt,
}

def main():
    print("=== fetch_and_parse.py: Fetching Google Drive traffic files ===\n")

    total_records = 0

    for stem, (file_id, year_hint, parser_key) in FILES.items():
        dest_xlsx = DOWNLOAD_DIR / f"{stem}.xlsx"
        out_json  = SCRIPT_DIR / f"{stem}.json"

        print(f"[{stem}]")
        if not download_gdrive(file_id, dest_xlsx):
            print(f"  SKIP — could not download\n")
            continue

        parser_fn = PARSERS[parser_key]
        try:
            if parser_key == "tis":
                records = parser_fn(dest_xlsx, year_hint)
            else:
                records = parser_fn(dest_xlsx)
        except Exception as e:
            print(f"  Parse error: {e}")
            records = []

        out_json.write_text(json.dumps(records, indent=2, default=str), encoding="utf-8")
        print(f"  Parsed {len(records)} records -> {out_json.name}")
        total_records += len(records)
        print()

    print(f"Total records parsed: {total_records}")
    print(f"JSON files written to: {SCRIPT_DIR}")
    print("\nNext step: python load_from_gdrive.py")


if __name__ == "__main__":
    main()

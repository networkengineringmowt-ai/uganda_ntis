import os
import sqlite3
import pandas as pd
import warnings
from pathlib import Path
from datetime import datetime
warnings.filterwarnings('ignore')

DATA_DIR = r"S:\ANNUAL DATA COLLECTION"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "traffic_platform.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS od_surveys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_id TEXT,
            survey_date TEXT,
            origin TEXT,
            destination TEXT,
            vehicle_type TEXT,
            trip_purpose TEXT,
            cargo_type TEXT,
            capacity_tons REAL,
            source_file TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS raw_tc_counts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_id TEXT,
            survey_date TEXT,
            motorcycles INTEGER,
            cars INTEGER,
            pickups INTEGER,
            minibuses INTEGER,
            buses INTEGER,
            trucks INTEGER,
            total INTEGER,
            source_file TEXT
        )
    """)
    conn.commit()
    return conn

def parse_od_file(filepath, conn):
    try:
        df_head = pd.read_excel(filepath, header=None, nrows=10)
        station_id = "UNKNOWN"
        survey_date = "UNKNOWN"
        for i, row in df_head.iterrows():
            row_str = " ".join([str(x).upper() for x in row.dropna()])
            if "STATION" in row_str:
                for val in row.dropna():
                    if "A0" in str(val) or "C" in str(val):
                        station_id = str(val).strip()
            if "DATE" in row_str:
                for val in row.dropna():
                    if isinstance(val, datetime):
                        survey_date = val.strftime("%Y-%m-%d")
                        break
        
        df = pd.read_excel(filepath, skiprows=7)
        if len(df) == 0:
            return 0
        
        orig_col = [c for c in df.columns if 'origin' in str(c).lower()]
        dest_col = [c for c in df.columns if 'dest' in str(c).lower()]
        type_col = [c for c in df.columns if 'type' in str(c).lower() and 'veh' in str(c).lower()]
        
        if orig_col and dest_col:
            records = []
            for _, row in df.iterrows():
                if pd.isna(row[orig_col[0]]) or pd.isna(row[dest_col[0]]):
                    continue
                records.append((
                    station_id,
                    survey_date,
                    str(row[orig_col[0]]),
                    str(row[dest_col[0]]),
                    str(row[type_col[0]]) if type_col else "UNKNOWN",
                    "UNKNOWN",
                    "UNKNOWN",
                    0.0,
                    os.path.basename(filepath)
                ))
            
            if records:
                cursor = conn.cursor()
                cursor.executemany("""
                    INSERT INTO od_surveys (station_id, survey_date, origin, destination, vehicle_type, trip_purpose, cargo_type, capacity_tons, source_file)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, records)
                conn.commit()
                return len(records)
    except Exception as e:
        print(f"Failed to parse OD {os.path.basename(filepath)}")
    return 0

def parse_tc_file(filepath, conn):
    try:
        df = pd.read_excel(filepath, header=None, nrows=25)
        motorcycles = 0
        cars = 0
        pickups = 0
        minibuses = 0
        buses = 0
        trucks = 0
        total = 0
        
        station_id = "UNKNOWN"
        if "TC_" in os.path.basename(filepath):
            station_id = os.path.basename(filepath).replace("TC_", "").replace(".xlsx", "").replace(".xls", "")
            
        for i, row in df.iterrows():
            row_str = " ".join([str(x).upper() for x in row.dropna()])
            if "MOTORCYCLE" in row_str:
                motorcycles = int(pd.to_numeric(row[1:8], errors='coerce').sum())
            elif "CARS" in row_str or "TAXIS" in row_str:
                cars = int(pd.to_numeric(row[1:8], errors='coerce').sum())
            elif "PICKUP" in row_str or "4WD" in row_str:
                pickups = int(pd.to_numeric(row[1:8], errors='coerce').sum())
            elif "MINIBUS" in row_str:
                minibuses = int(pd.to_numeric(row[1:8], errors='coerce').sum())
            elif "BUS" in row_str and "MINI" not in row_str:
                buses += int(pd.to_numeric(row[1:8], errors='coerce').sum())
            elif "TRUCK" in row_str or "LORRIES" in row_str or "TRAILER" in row_str:
                trucks += int(pd.to_numeric(row[1:8], errors='coerce').sum())
            elif "TOTAL" in row_str and "MOTORCYCLE" not in row_str:
                total = int(pd.to_numeric(row[1:8], errors='coerce').sum())
                
        if total > 0 or motorcycles > 0:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO raw_tc_counts (station_id, survey_date, motorcycles, cars, pickups, minibuses, buses, trucks, total, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (station_id, "2023-01-01", motorcycles, cars, pickups, minibuses, buses, trucks, total, os.path.basename(filepath)))
            conn.commit()
            return 1
            
    except Exception as e:
        print(f"Failed to parse TC {os.path.basename(filepath)}")
    return 0

def run_ingestion():
    print("Starting ETL ingestion from S:\ANNUAL DATA COLLECTION")
    conn = init_db()
    
    total_od = 0
    total_tc = 0
    files_processed = 0
    
    limit = 50000
    
    for root, _, files in os.walk(DATA_DIR):
        for f in files:
            if files_processed >= limit:
                break
                
            if f.endswith('.xlsx') or f.endswith('.xls') or f.endswith('.csv'):
                filepath = os.path.join(root, f)
                fname_lower = f.lower()
                root_lower = root.lower()
                
                # Check file name or parent folder name for clues
                is_od = 'od' in fname_lower or 'origin' in fname_lower or 'od' in root_lower.split(os.sep)[-1]
                is_tc = 'tc' in fname_lower or 'traffic count' in fname_lower or 'mcc' in fname_lower or 'mccc' in root_lower.split(os.sep)[-1]
                
                if is_od:
                    od_recs = parse_od_file(filepath, conn)
                    total_od += od_recs
                    if od_recs > 0:
                        print(f"Ingested {od_recs} OD records from {f}")
                elif is_tc:
                    tc_recs = parse_tc_file(filepath, conn)
                    total_tc += tc_recs
                    if tc_recs > 0:
                        print(f"Ingested TC summary from {f}")
                        
                files_processed += 1
                
        if files_processed >= limit:
            print("Reached file processing limit for this initial batch.")
            break
            
    print(f"--- INGESTION COMPLETE ---")
    print(f"Total OD records inserted: {total_od}")
    print(f"Total TC summaries inserted: {total_tc}")
    conn.close()

if __name__ == "__main__":
    run_ingestion()

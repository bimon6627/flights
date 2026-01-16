import os
import time
import json
import requests
import xml.etree.ElementTree as ET
import psycopg2
from datetime import datetime, timezone
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

# --- CONFIG ---
DB_URL = os.getenv("DATABASE_URL")
STATE_FILE = "flight_state.json"
API_URL = "https://asrv.avinor.no/XmlFeed/v1.0"

# Time window for the fetch (in hours)
TIME_FROM = 12
TIME_TO = 72
FULL_SYNC_HOURS = 24

def get_db_connection():
    return psycopg2.connect(DB_URL)

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f)

def parse_and_upsert(xml_content, current_airport_code, cur):
    try:
        root = ET.fromstring(xml_content)
        api_last_update = root.attrib.get('lastUpdate') 
        flights_container = root.find('flights')
        if flights_container is None: return api_last_update

        flight_data = []
        
        for flight in flights_container.findall('flight'):
            unique_id = flight.attrib.get('uniqueID') or flight.attrib.get('uniqueId')
            if not unique_id: continue
            
            # 1. Basic Info
            direction = flight.findtext('arr_dep') # 'A' or 'D'
            remote_airport = flight.findtext('airport')
            
            if not remote_airport: continue

            # 3. Prepare Simple Row
            # We treat the data as "True for this airport only"
            row = {
                "uniqueId": unique_id,
                "scanned_airport": current_airport_code, # PART OF KEY
                "flightId": flight.findtext('flight_id') or flight.findtext('flightId'),
                "airline": flight.findtext('airline'),
                "direction": direction,
                "related_airport": remote_airport,
                "schedule_time": flight.findtext('schedule_time'),
                "dom_int": flight.findtext('dom_int'),
                
                # These attributes are generic now
                "gate": flight.findtext('gate'),
                "status_code": flight.find('status').attrib.get('code') if flight.find('status') is not None else None,
                "status_time": flight.find('status').attrib.get('time') if flight.find('status') is not None else None,
                
                "check_in": flight.findtext('check_in'),
                "belt": flight.findtext('belt_number'),
                "via": flight.findtext('via_airport').split(',') if flight.findtext('via_airport') is not None else [],
                "updatedAt": datetime.now(),
            }
            flight_data.append(row)

        if not flight_data: return api_last_update

        # 4. Upsert with Composite Key
        # Note the ON CONFLICT target is now (uniqueId, scanned_airport)
        query = """
            INSERT INTO flights (
                "uniqueId", "scanned_airport", "flightId", "airline", "direction", 
                "related_airport", "schedule_time", "gate", "status_code", "status_time", 
                "check_in", "belt", "via", "dom_int", "updatedAt"
            ) VALUES (
                %(uniqueId)s, %(scanned_airport)s, %(flightId)s, %(airline)s, %(direction)s,
                %(related_airport)s, %(schedule_time)s, %(gate)s, %(status_code)s, %(status_time)s,
                %(check_in)s, %(belt)s, %(via)s, %(dom_int)s, %(updatedAt)s
            )
            ON CONFLICT ("uniqueId", "scanned_airport") DO UPDATE SET
                "flightId"        = EXCLUDED."flightId",
                "airline"         = EXCLUDED."airline",
                "direction"       = EXCLUDED."direction",
                "related_airport" = EXCLUDED."related_airport",
                "schedule_time"   = EXCLUDED."schedule_time",
                "gate"            = EXCLUDED."gate",
                "status_code"     = EXCLUDED."status_code",
                "status_time"     = EXCLUDED."status_time",
                "check_in"        = EXCLUDED."check_in",
                "belt"            = EXCLUDED."belt",
                "via"             = EXCLUDED."via",
                "updatedAt"       = EXCLUDED."updatedAt",
                "dom_int"         = EXCLUDED."dom_int";
        """
        
        cur.executemany(query, flight_data)
        return api_last_update

    except Exception as e:
        print(f"Error parsing XML for {current_airport_code}: {e}")
        return None

def sync_job():
    conn = get_db_connection()
    cur = conn.cursor()
    state = load_state()

    # Get airports list
    cur.execute('SELECT code FROM "avinorAirports"')
    airports = [row[0] for row in cur.fetchall()]

    print(f"--- Starting Sync for {len(airports)} airports ---")

    # Check when we last did a FULL sync (globally)
    last_full_sync_str = state.get('__GLOBAL_LAST_FULL_SYNC__')
    should_do_full_sync = False
    
    if not last_full_sync_str:
        should_do_full_sync = True
    else:
        last_full = datetime.fromisoformat(last_full_sync_str)
        if datetime.now() - last_full > timedelta(hours=FULL_SYNC_HOURS):
            should_do_full_sync = True

    if should_do_full_sync:
        print(f"!! DOING FULL SCHEDULE REFRESH (Every {FULL_SYNC_HOURS}h) !!")

    headers = {
    'User-Agent': 'bawmDepartureBoard/1.0',
    'From': 'post@bawm.no'
    }

    for code in airports:
        last_update = state.get(code)
        
        # Base URL
        url = f"{API_URL}?airport={code}&TimeFrom={TIME_FROM}&TimeTo={TIME_TO}"
        
        # LOGIC: Only attach lastUpdate if we represent a "Quick Update"
        # If should_do_full_sync is True, we OMIT lastUpdate to get everything.
        if last_update and not should_do_full_sync:
            url += f"&lastUpdate={last_update}"

        try:
            resp = requests.get(url, headers=headers, timeout=10)
            resp.raise_for_status()
            
            new_timestamp = parse_and_upsert(resp.content, code, cur)
            
            # Update state with the new timestamp provided by Avinor
            if new_timestamp:
                state[code] = new_timestamp
            
            conn.commit()
            
        except Exception as e:
            print(f"Failed to fetch {code}: {e}")
            conn.rollback()

    # Update the Global Full Sync timestamp if we just finished one
    if should_do_full_sync:
        state['__GLOBAL_LAST_FULL_SYNC__'] = datetime.now().isoformat()

    save_state(state)
    cur.close()
    conn.close()
    print("--- Sync Complete ---")

if __name__ == "__main__":
    sync_job()
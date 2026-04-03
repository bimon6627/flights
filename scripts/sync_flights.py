import os
import json
import requests
import xml.etree.ElementTree as ET
import psycopg2
from datetime import datetime
from dotenv import load_dotenv
from datetime import timedelta, timezone
import json

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


def generate_avinor_id(flight_id, from_iata, to_iata, schedule_time):    
    date_part = schedule_time.split('T')[0].replace('-', '')
    return f"{flight_id}-{from_iata}-{to_iata}-{date_part}".lower()



def sync_json_details(airport_code, cur):
    today_str = datetime.now().strftime('%Y-%m-%d')
    
    # We need to check both directions because the JSON API splits them
    for direction in ['departure', 'arrival']:
        url = f"https://www.avinor.no/api/v1/flights/{direction}/{airport_code}?dateTime={today_str}"
        
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            
            flight_legs = data.get('flightLegs', [])
            upsert_data = []

            for leg in flight_legs:
                # The JSON 'id' usually matches the XML 'uniqueID' format
                unique_id = leg.get('id')
                
                # Extract Gate/Belt info safely
                dep = leg.get('departure', {})
                arr = leg.get('arrival', {})
                gate_info = dep.get('gate') or {}
                belt_info = arr.get('belt') or {}

                row = {
                    "uniqueId": unique_id,
                    "scanned_airport": airport_code,
                    "gate": gate_info.get('gate'),
                    "gate_status_code": gate_info.get('status'),
                    "gate_status_desc": gate_info.get('statusDescription'),
                    "belt": belt_info.get('belt'),
                    "belt_status_code": belt_info.get('status'),
                    "belt_status_desc": belt_info.get('statusDescription'),
                    "lastSyncSource": "JSON",
                    "updatedAt": datetime.now(timezone.utc)
                }
                upsert_data.append(row)

            if upsert_data:
                query = """
                    UPDATE flights SET
                    "gate" = %(gate)s,
                    "gate_status_code" = %(gate_status_code)s,
                    "gate_status_desc" = %(gate_status_desc)s,
                    "belt" = %(belt)s,
                    "belt_status_code" = %(belt_status_code)s,
                    "belt_status_desc" = %(belt_status_desc)s,
                    "lastSyncSource" = %(lastSyncSource)s,
                    "updatedAt" = %(updatedAt)s
                    WHERE "uniqueId" = %(uniqueId)s AND "scanned_airport" = %(scanned_airport)s;
                """
                cur.executemany(query, upsert_data)

        except Exception as e:
            print(f"JSON Sync failed for {airport_code} {direction}: {e}")

def parse_and_upsert(xml_content, current_airport_code, cur):
    try:
        root = ET.fromstring(xml_content)
        api_last_update = root.attrib.get('lastUpdate') 
        flights_container = root.find('flights')
        if flights_container is None: return api_last_update

        flight_data = []
        
        for flight in flights_container.findall('flight'):
            flight_id = flight.findtext('flight_id') or flight.findtext('flightId')
            remote_airport = flight.findtext('airport')
            direction = flight.findtext('arr_dep')

            from_iata = current_airport_code if direction == 'D' else remote_airport
            to_iata = remote_airport if direction == 'D' else current_airport_code
            generated_id = generate_avinor_id(flight_id, from_iata, to_iata, flight.findtext('schedule_time'))
            
            unique_id = flight.attrib.get('uniqueID') or flight.attrib.get('uniqueId')
            if not unique_id: continue
            
            # 1. Basic Info
            direction = flight.findtext('arr_dep') # 'A' or 'D'
            remote_airport = flight.findtext('airport')
            
            if not remote_airport: continue

            # 3. Prepare Simple Row
            # We treat the data as "True for this airport only"
            row = {
                "uniqueId": generated_id,
                "scanned_airport": current_airport_code, # PART OF KEY
                "flightId": flight_id,
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
                "flightId" = EXCLUDED."flightId",
                "airline" = EXCLUDED."airline",
                "schedule_time" = EXCLUDED."schedule_time",
                "status_code" = EXCLUDED."status_code",
                "status_time" = EXCLUDED."status_time",
                "gate" = COALESCE(EXCLUDED."gate", flights."gate"),
                "belt" = COALESCE(EXCLUDED."belt", flights."belt"),
                "updatedAt" = EXCLUDED."updatedAt";
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
            
            sync_json_details(code, cur)
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
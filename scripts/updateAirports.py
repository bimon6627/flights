import os
import requests
import xml.etree.ElementTree as ET
import psycopg2
from dotenv import load_dotenv

load_dotenv() 

API_URL = "https://asrv.avinor.no/airportNames/v1.0"
DB_URL = os.getenv("DATABASE_URL")

def fetch_and_parse_xml(url):
    print(f"Fetching data from {url}...")
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        # --- THE FIX ---
        # 1. Ask the requests library to analyze the raw bytes and guess the encoding.
        #    This fixes cases where the server headers say "ISO-8859-1" but the data is actually "UTF-8".
        response.encoding = response.apparent_encoding

        # 2. Get the text using the detected encoding
        xml_content = response.text
        
        # 3. Parse the string
        root = ET.fromstring(xml_content)
        
        data_to_insert = []
        
        # Check for Airports
        for item in root.findall('airportName'):
            code = item.get('code')
            name = item.get('name')
            if code and name:
                data_to_insert.append((code, name))
                
        # Check for Airlines
        for item in root.findall('airlineName'):
            code = item.get('code')
            name = item.get('name')
            if code and name:
                data_to_insert.append((code, name))
                
        return data_to_insert

    except Exception as e:
        print(f"Error fetching or parsing XML: {e}")
        return []

        
def push_to_database(data):
    if not data:
        print("No data to insert.")
        return

    print(f"Connecting to database to insert {len(data)} records...")
    conn = None
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()

        query = """
            INSERT INTO "airportNames" (code, name)
            VALUES (%s, %s)
            ON CONFLICT (code) 
            DO UPDATE SET name = EXCLUDED.name;
        """

        cur.executemany(query, data)
        conn.commit()
        print("Success! Data pushed to database.")
        cur.close()
    except Exception as e:
        print(f"Database error: {e}")
    finally:
        if conn is not None:
            conn.close()

if __name__ == "__main__":
    airports = fetch_and_parse_xml(API_URL)
    push_to_database(airports)
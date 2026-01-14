import os
import requests
import xml.etree.ElementTree as ET
import psycopg2
from dotenv import load_dotenv

load_dotenv() 

API_URL = "https://asrv.avinor.no/airlineNames/v1.0"
DB_URL = os.getenv("DATABASE_URL")

def fetch_and_parse_xml(url):
    print(f"Fetching data from {url}...")
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        # --- THE FIX ---
        # "WiderÃ¸e" proves the content is UTF-8. 
        # We explicitly tell requests to read it as UTF-8, ignoring whatever the server header says.
        response.encoding = 'utf-8'
        
        xml_content = response.text
        root = ET.fromstring(xml_content)
        
        data_to_insert = []
        
        for airline in root.findall('airlineName'):
            code = airline.get('code')
            name = airline.get('name')
            
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
            INSERT INTO "airlineNames" (code, name)
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
    airlines = fetch_and_parse_xml(API_URL)
    push_to_database(airlines)
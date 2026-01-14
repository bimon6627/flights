import os
import csv
import io
import psycopg2
from dotenv import load_dotenv

# 1. Load database credentials
load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

# 2. Your CSV Data (Embedded for convenience)
csv_content = """name;code
Alta lufthavn;ALF
Andøya lufthavn, Andenes;ANX
Bardufoss lufthavn;BDU
Bergen lufthavn, Flesland;BGO
Berlevåg lufthavn;BVG
Bodø lufthavn;BOO
Brønnøysund lufthavn, Brønnøy;BNN
Båtsfjord lufthavn;BJF
Fagernes lufthavn, Leirin;VDB
Florø lufthamn;FRO
Førde lufthamn, Bringeland;FDE
Hammerfest lufthavn;HFT
Harstad/Narvik lufthavn, Evenes;EVE
Hasvik lufthavn;HAA
Honningsvåg lufthavn;HVG
Kirkenes lufthavn, Høybuktmoen;KKN
Kristiansand lufthavn, Kjevik;KRS
Kristiansund lufthavn, Kvernberget;KSU
Lakselv lufthavn, Banak;LKL
Leknes lufthavn;LKN
Mehamn lufthavn;MEH
Mo i Rana lufthavn, Røssvoll;MQN
Molde lufthavn, Årø;MOL
Mosjøen lufthavn, Kjærstad;MJF
Namsos lufthavn;OSY
Oslo lufthavn;OSL
Røros lufthavn;RRS
Rørvik lufthavn, Ryum;RVK
Røst lufthavn;RET
Sandane lufthamn, Anda;SDN
Sandnessjøen lufthavn, Stokka;SSJ
Sogndal lufthamn, Haukåsen;SOG
Stavanger lufthavn, Sola;SVG
Stokmarknes lufthavn, Skagen;SKN
Svalbard lufthavn, Longyear;LYR
Svolvær lufthavn, Helle;SVJ
Sørkjosen lufthavn;SOJ
Tromsø lufthavn;TOS
Trondheim lufthavn, Værnes;TRD
Vadsø lufthavn;VDS
Vardø lufthavn, Svartnes;VAW
Værøy helikopterhavn;VRY
Ørsta/Volda lufthamn, Hovden;HOV
Ålesund lufthavn, Vigra;AES"""

def import_csv_data():
    print("Connecting to database...")
    conn = None
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()

        # Use io.StringIO to treat the string above like a file
        f = io.StringIO(csv_content)
        # Note: delimiter is set to semicolon ';'
        reader = csv.DictReader(f, delimiter=';')

        records_to_insert = []

        for row in reader:
            raw_name = row['name']
            code = row['code']

            # Logic: Split at the first comma
            if ',' in raw_name:
                parts = raw_name.split(',', 1)
                name = parts[0].strip()      # "Andøya lufthavn"
                alt_name = parts[1].strip()  # "Andenes"
            else:
                name = raw_name.strip()      # "Alta lufthavn"
                alt_name = ""                # Empty if no comma

            records_to_insert.append((code, name, alt_name))

        # SQL Query with Upsert (ON CONFLICT)
        query = """
            INSERT INTO "avinorAirports" (code, name, "altName")
            VALUES (%s, %s, %s)
            ON CONFLICT (code) 
            DO UPDATE SET 
                name = EXCLUDED.name, 
                "altName" = EXCLUDED."altName";
        """

        print(f"Inserting {len(records_to_insert)} airports...")
        cur.executemany(query, records_to_insert)
        
        conn.commit()
        print("Success! Data imported.")
        cur.close()

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    import_csv_data()
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def clear_flights():
    try:
        # Connect to the database
        conn = psycopg2.connect(os.getenv("DATABASE_URL"))
        cur = conn.cursor()

        print("Clearing all records from the 'flights' table...")
        
        # TRUNCATE is much faster than DELETE for clearing a table
        # We use quotes "flights" to respect the case-sensitivity of your schema
        cur.execute('TRUNCATE TABLE "flights";')
        
        conn.commit()
        print("Success! The table is now empty.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    confirm = input("Are you sure you want to delete ALL flights? (yes/no): ")
    if confirm.lower() == "yes":
        clear_flights()
    else:
        print("Operation cancelled.")
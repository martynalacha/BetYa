import psycopg2
from pathlib import Path
from dotenv import load_dotenv
import os
load_dotenv()

DATABASE_CONFIG = {
    "dbname": os.getenv("DB_NAME"),
    "user":  os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
}

def get_connection():
    return psycopg2.connect(**DATABASE_CONFIG)

# Dependency dla FastAPI
def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    sql_file = Path(__file__).parent / "models.sql"
    with open(sql_file, "r", encoding="utf-8") as f:
        sql_code = f.read()

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql_code)
            conn.commit()
        print("✅ Tabele zostały utworzone / sprawdzone")
    finally:
        conn.close()

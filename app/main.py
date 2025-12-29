print("✅ ŁADUJE SIĘ PLIK: app/main.py")

from fastapi import FastAPI
from app.routers import logowanie, rejestracja, home, znajomi, wyzwania
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
app = FastAPI(title="BetYa")

# inicjalizacja bazy przy starcie serwera
init_db()

# pozwalamy na połączenia z frontendu
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rejestrujemy routery
app.include_router(logowanie.router)
app.include_router(rejestracja.router)
app.include_router(home.router)
app.include_router(znajomi.router)
app.include_router(wyzwania.router)

@app.get("/")
def read_root():
    return {"message": "Witaj w BetYa API!"}

from fastapi import APIRouter, Depends, HTTPException
from app import schemas
from app.database import get_db
import bcrypt
from app.auth.jwt import create_access_token
router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


@router.get("/")
def read_root():
    return {"message": "Witaj w Logowaniu!"}

@router.post("/logowanie", response_model=schemas.AuthResponse)
def logowanie(uzytkownik: schemas.UzytkownikLogin, conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, nazwa_uzytkownika, email, hashed_haslo FROM widok_dane_logowania WHERE nazwa_uzytkownika = %s",
            (uzytkownik.nazwa_uzytkownika,)
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Nieprawidłowa nazwa użytkownika lub hasło")

    try:
        user_id, nazwa_uzytkownika, email, hashed_haslo = row
    except Exception as e:
        print("Błąd przy rozpakowywaniu:", e)
        raise HTTPException(status_code=500, detail="Błąd serwera przy odczycie użytkownika")

    if not bcrypt.checkpw(uzytkownik.haslo.encode("utf-8"), hashed_haslo.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Nieprawidłowe hasło")

    access_token = create_access_token(data={"uzytkownik_id": user_id})

    return schemas.AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=schemas.UzytkownikOut(
            id=user_id,
            nazwa_uzytkownika=nazwa_uzytkownika,
            email=email
        )
    )


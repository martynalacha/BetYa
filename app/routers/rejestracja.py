from fastapi import APIRouter, Depends, HTTPException
from app import schemas
from app.database import get_db
import bcrypt
from app.auth.jwt import create_access_token
from psycopg2.errors import UniqueViolation, CheckViolation

router = APIRouter(
    prefix="/register",
    tags=["auth"]
)

@router.get("/")
def read_root():
    return {"message": "Witaj w Rejestracji!"}

@router.post("/rejestracja", response_model=schemas.AuthResponse)
def rejestracja(uzytkownik: schemas.UzytkownikCreate, conn=Depends(get_db)):
    # Hashowanie hasła
    password_bytes = uzytkownik.haslo.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")

    new_id = None

    try:
        with conn.cursor() as cur:
            # Wywołanie FUNKCJI WBUDOWANEJ (Wymaganie 6c)
            cur.execute(
                "SELECT zarejestruj_uzytkownika(%s, %s, %s)",
                (uzytkownik.nazwa_uzytkownika, uzytkownik.email, hashed)
            )

            new_id = cur.fetchone()[0]
            conn.commit()

    except UniqueViolation:
        conn.rollback()
        # "Kontrola spójności danych" (niepozwolenie na duplikaty)
        raise HTTPException(status_code=400, detail="Nazwa użytkownika lub email już istnieje")

    except CheckViolation as e:
        conn.rollback()
        # To spełnia: "Blokada wprowadzania niepoprawnych wartości"
        # (np. email bez @ albo zbyt krótka nazwa)

        nazwa_constraintu = e.diag.constraint_name

        if nazwa_constraintu == "chk_email_poprawny":
            msg = "Podany adres email jest nieprawidłowy (musi zawierać znak '@')."
        elif nazwa_constraintu == "chk_nazwa_dlugosc":
            msg = "Nazwa użytkownika jest za krótka (wymagane min. 3 znaki)."
        else:
            msg = f"Dane nie spełniają wymagań bazy danych ({nazwa_constraintu})."

        raise HTTPException(status_code=400, detail=msg)

    except Exception as e:
        conn.rollback()
        print(f"Błąd bazy: {e}")
        raise HTTPException(status_code=500, detail="Błąd serwera podczas rejestracji")

    # 3. Generowanie tokena
    access_token = create_access_token(data={"uzytkownik_id": new_id})

    return schemas.AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=schemas.UzytkownikOut(
            id=new_id,
            nazwa_uzytkownika=uzytkownik.nazwa_uzytkownika,
            email=uzytkownik.email
        )
    )
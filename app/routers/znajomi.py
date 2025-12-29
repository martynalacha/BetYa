from fastapi import APIRouter, Depends, HTTPException, Query, Path
from typing import List
from app import schemas
from app.database import get_db
from app.auth.jwt import get_current_user_id
import psycopg2

from app.schemas import ZnajomyOut

router = APIRouter(prefix="/znajomi", tags=["znajomi"])


@router.get("/")
def read_root():
    return {"message": "Witaj w znajomi!"}

@router.get("/wszyscy", response_model=List[ZnajomyOut]
            )
def znajomi(user_id: int = Depends(get_current_user_id), conn=Depends(get_db)):
    """
    Pobiera listę znajomych wykorzystując WIDOK (Wymaganie 2a).
    """
    wynik = []
    with conn.cursor() as cur:
        cur.execute("""
                    SELECT
                        CASE WHEN uzytkownik_id = %s THEN adresat_nazwa ELSE inicjator_nazwa END,
                        CASE WHEN uzytkownik_id = %s THEN adresat_email ELSE inicjator_email END,
                        CASE WHEN uzytkownik_id = %s THEN znajomy_id ELSE uzytkownik_id END,
                        CASE WHEN uzytkownik_id = %s THEN adresat_profilowe_url ELSE inicjator_profilowe_url END
                    FROM widok_szczegoly_relacji
                    WHERE (uzytkownik_id = %s OR znajomy_id = %s)
                      AND sa_znajomymi = TRUE
                    """, (user_id, user_id, user_id, user_id, user_id, user_id))

        dane = cur.fetchall()
        for nazwa, email, uid, profilowe_url  in dane:
            wynik.append(
                ZnajomyOut(
                    id=uid,
                    nazwa_uzytkownika=nazwa,
                    email=email,
                    profilowe_url=profilowe_url
                )
            )
    return wynik


@router.get("/pending/wyslane", response_model=List[schemas.PendingZaproszenieOut])
def pending_wyslane(user_id: int = Depends(get_current_user_id), conn=Depends(get_db)):
    """
    Pobiera wysłane zaproszenia używając widoku.
    """
    wynik = []
    with conn.cursor() as cur:
        cur.execute("""
                    SELECT relacja_id, adresat_id, adresat_nazwa, adresat_email
                    FROM (
                             SELECT relacja_id, znajomy_id as adresat_id, adresat_nazwa, adresat_email, uzytkownik_id, status
                             FROM widok_szczegoly_relacji
                         ) as sub
                    WHERE uzytkownik_id = %s AND status = 'oczekujacy'
                    """, (user_id,))
        dane = cur.fetchall()

        for rel_id, uid, nazwa, email in dane:
            wynik.append(
                schemas.PendingZaproszenieOut(
                    relacja_id=rel_id,
                    uzytkownik=schemas.ZnajomyOut(
                        id=uid,
                        nazwa_uzytkownika=nazwa,
                        email=email
                    )
                )
            )
    return wynik


@router.get("/pending/odebrane", response_model=List[schemas.PendingZaproszenieOut])
def pending_odebrane(user_id: int = Depends(get_current_user_id), conn=Depends(get_db)):
    """
    Pobiera odebrane zaproszenia używając widoku.
    """
    wynik = []
    with conn.cursor() as cur:
        cur.execute("""
                    SELECT relacja_id, uzytkownik_id, inicjator_nazwa, inicjator_email
                    FROM widok_szczegoly_relacji
                    WHERE znajomy_id = %s AND status = 'oczekujacy'
                    """, (user_id,))

        for rel_id, uid, nazwa, email in cur.fetchall():
            wynik.append(
                schemas.PendingZaproszenieOut(
                    relacja_id=rel_id,
                    uzytkownik=schemas.ZnajomyOut(
                        id=uid,
                        nazwa_uzytkownika=nazwa,
                        email=email
                    )
                )
            )
    return wynik


@router.get("/szukaj", response_model=List[schemas.UzytkownikOut])
def szukaj_uzytkownikow(
        q: str = Query(..., min_length=1, description="Szukaj nowego znajomego"),
        conn=Depends(get_db),
        user_id: int = Depends(get_current_user_id),
):
    """
    Wyszukiwanie wykorzystujące funkcję wbudowaną w PL/PGSQL (Wymaganie 6c).
    """
    with conn.cursor() as cur:
        cur.callproc('szukaj_potencjalnych_znajomych', (q, user_id))
        wyniki = cur.fetchall()

    final_results = []
    for u_id, nazwa, email in wyniki:
        final_results.append(
            schemas.UzytkownikOut(
                id=u_id,
                nazwa_uzytkownika=nazwa,
                email=email
            )
        )
    return final_results


@router.post("/dodaj_znajomego", response_model=schemas.ZaproszenieOut)
def dodaj_znajomego(
        zaproszenie: schemas.ZaproszenieCreate,
        conn=Depends(get_db),
        user_id: int = Depends(get_current_user_id)
):
    """
    Wstawianie z wykorzystaniem funkcji wbudowanej (Wymaganie 6c).
    Walidacja duplikatów odbywa się w bazie.
    """
    try:
        with conn.cursor() as cur:
            cur.callproc('wyslij_zaproszenie', (user_id, zaproszenie.znajomy_id))
            relacja = cur.fetchone()
            conn.commit()

            # relacja = (id, status, data)
            return schemas.ZaproszenieOut(
                id=relacja[0],
                uzytkownik_id=user_id,
                znajomy_id=zaproszenie.znajomy_id,
                status=relacja[1],
                sa_znajomymi=False,
                data_zaproszenia=relacja[2]
            )
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{zaproszenie_id}/akceptuj", response_model=schemas.ZaproszenieOut)
def akceptuj_zaproszenie(
        zaproszenie_id: int = Path(..., description="ID relacji znajomości"),
        conn=Depends(get_db),
        user_id: int = Depends(get_current_user_id)
):
    """
    Zmiana statusu zaproszenia (zaakceptowanie/odrzucenie) z wykorzystaniem funkcji wbudowanej w PL/PGSQL.
    Wymagania spełnione:
    - 6b: walidacja danych (sprawdzenie, czy użytkownik jest adresatem)
    - 6c: funkcja wbudowana, kontrola spójności danych
    """

    try:
        with conn.cursor() as cur:
            cur.callproc('zmien_status_zaproszenia', (zaproszenie_id, user_id, 'zaakceptowany'))
            updated = cur.fetchone()
            conn.commit()

        return schemas.ZaproszenieOut(
            id=updated[0],
            uzytkownik_id=updated[1],
            znajomy_id=updated[2],
            status=updated[3],
            sa_znajomymi=updated[4],
            data_zaproszenia=updated[5]
        )
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=404, detail="Błąd operacji: " + str(e))


@router.post("/{zaproszenie_id}/odrzuc", response_model=schemas.ZaproszenieOut)
def odrzuc_zaproszenie(
        zaproszenie_id: int = Path(..., description="ID relacji znajomości"),
        conn=Depends(get_db),
        user_id: int = Depends(get_current_user_id)
):
    try:
        with conn.cursor() as cur:
            cur.callproc('zmien_status_zaproszenia', (zaproszenie_id, user_id, 'odrzucony'))
            updated = cur.fetchone()
            conn.commit()

            return schemas.ZaproszenieOut(
                id=updated[0],
                uzytkownik_id=updated[1],
                znajomy_id=updated[2],
                status=updated[3],
                sa_znajomymi=updated[4],
                data_zaproszenia=updated[5]
            )
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=404, detail="Błąd operacji: " + str(e))


@router.get("/statystyki", response_model=schemas.StatystykiZnajomychOut)
def statystyki_znajomych(user_id: int = Depends(get_current_user_id), conn=Depends(get_db)):
    """
    Zwraca statystyki znajomych dla zalogowanego użytkownika:
    - liczba znajomych
    - liczba oczekujących zaproszeń
    2a (widok), 6c (funkcja wbudowana), 6a widok z GROUP BY
    """
    with conn.cursor() as cur:
        # Pobranie liczby znajomych z widoku
        cur.execute("""
                    SELECT liczba_znajomych
                    FROM widok_statystyki_znajomych
                    WHERE uzytkownik_id = %s
                    """, (user_id,))
        wynik = cur.fetchone()
        liczba_znajomych = wynik[0] if wynik else 0

        # Pobranie liczby oczekujących zaproszeń z funkcji
        cur.execute("SELECT zlicz_oczekujace_zaproszenia(%s)", (user_id,))
        liczba_oczekujacych = cur.fetchone()[0]

    return schemas.StatystykiZnajomychOut(
        liczba_znajomych=liczba_znajomych,
        liczba_oczekujacych_zaproszen=liczba_oczekujacych
    )

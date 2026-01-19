from fastapi import APIRouter, Depends, HTTPException
from app import schemas
from app.database import get_db
from app.auth.jwt import get_current_user_id
from typing import List
from psycopg2.extras import RealDictCursor
from datetime import date
router = APIRouter(
    prefix="/wyzwania",
    tags=["wyzwania"]
)


@router.get("/", response_model=schemas.WyzwaniaResponse)
def get_wyzwania(user_id: int = Depends(get_current_user_id), conn=Depends(get_db)):

    """
    Endpoint pobiera wszystkie wyzwania użytkownika:
    Spełnia wymagania:
    - 2a: wykorzystanie widoku w bazie (widok_moje_wyzwania)
    """

    with conn.cursor() as cur:
        cur.execute("SELECT rola FROM uzytkownicy WHERE id = %s", (user_id,))
        user_role = cur.fetchone()[0]

        if user_role == 'admin':
            # LOGIKA ADMINA: Pobierz wszystkie wyzwania z bazy
            cur.execute("""
                        SELECT DISTINCT id, nazwa, opis, czasowe, data_start, data_koniec, autor_id
                        FROM widok_moje_wyzwania
                        ORDER BY id DESC
                        """)
        else:
            cur.execute("""
                        SELECT DISTINCT id, nazwa, opis, czasowe, data_start, data_koniec, autor_id
                        FROM widok_moje_wyzwania
                        WHERE autor_id = %s OR (uczestnik_id = %s AND zaakceptowane = TRUE)
                        """, (user_id, user_id))

        rows = cur.fetchall()

        wyzwania_list: List[schemas.WyzwanieOut] = [
            schemas.WyzwanieOut(
                id=w[0],
                nazwa=w[1],
                opis=w[2],
                czasowe=w[3],
                data_start=w[4],
                data_koniec=w[5],
                autor_id=w[6]
            )
            for w in rows
        ]

    return schemas.WyzwaniaResponse(
        message="Wszystkie wyzwania użytkownika",
        status="success",
        data=wyzwania_list
    )


@router.post("/dodaj", response_model=schemas.WyzwanieCreateResponse)
def create_wyzwanie(
        wyzwanie_data: schemas.WyzwanieCreate,
        user_id: int = Depends(get_current_user_id),
        conn=Depends(get_db)
):
    """
    Tworzy nowe wyzwanie z zadaniami dziennymi i podzadaniami oraz dodaje uczestników.
    Wymagania spełnione: 6b (walidacja uczestników),
    6c (operacje wbudowane w PL/pgSQL / kontrola spójności)
    8b. mechanizm funkcji wbudowanych i wyzwalaczy obsługujący dodatkowe relacje(tabele),
    2a – widok
    """

    print("DEBUG: Uczestnicy IDs:", wyzwanie_data.uczestnicy_ids)
    with conn.cursor() as cur:

        # 1. Tworzymy wyzwanie
        cur.execute("""
                    INSERT INTO wyzwania (nazwa, opis, czasowe, data_start, data_koniec, autor_id)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """, (
                        wyzwanie_data.nazwa,
                        wyzwanie_data.opis,
                        wyzwanie_data.czasowe,
                        wyzwanie_data.data_start,
                        wyzwanie_data.data_koniec,
                        user_id
                    ))
        wyzwanie_id = cur.fetchone()[0]

        # 3. Znajomi jako uczestnicy
        for uid in wyzwanie_data.uczestnicy_ids:
            cur.execute("""
                        INSERT INTO uczestnicy_wyzwan (wyzwanie_id, uzytkownik_id, zaakceptowane)
                        VALUES (%s, %s, %s)
                        """, (wyzwanie_id, uid, False))

        # 4. Zadania dzienne i podzadania
        zadania_list = []
        for zadanie in wyzwanie_data.zadania_dzienne:
            cur.execute("""
                        INSERT INTO zadania_dzienne (wyzwanie_id, nazwa, opis)
                        VALUES (%s, %s, %s)
                        RETURNING id
                        """, (wyzwanie_id, zadanie.nazwa, zadanie.opis))
            zadanie_id = cur.fetchone()[0]

            podzadania_list = [
                schemas.PodzadanieOut(
                    id=cur.execute("""
                                   INSERT INTO podzadania (zadanie_id, nazwa, wymagane, waga)
                                   VALUES (%s, %s, %s, %s)
                                   RETURNING id
                                   """, (zadanie_id, p.nazwa, p.wymagane, p.waga)) or cur.fetchone()[0],
                    nazwa=p.nazwa,
                    waga=p.waga,
                    wymagane=p.wymagane
                )
                for p in zadanie.podzadania
            ]
            zadania_list.append(
                schemas.ZadanieDzienneOut(
                    id=zadanie_id,
                    nazwa=zadanie.nazwa,
                    opis=zadanie.opis,
                    podzadania=podzadania_list
                )
            )

        # 5. Pobieramy wszystkich uczestników (autor + znajomi)
        cur.execute("""
                    SELECT uzytkownik_id, nazwa_uzytkownika, zaakceptowane 
                    FROM widok_uczestnicy_wyzwania 
                    WHERE wyzwanie_id = %s
                    """, (wyzwanie_id,))
        uczestnicy_list = [
            schemas.UczestnikWyzwaniaOut(id=row[0], nazwa_uzytkownika=row[1], zaakceptowane=row[2])
            for row in cur.fetchall()
        ]
        conn.commit()

    return schemas.WyzwanieCreateResponse(
        id=wyzwanie_id,
        nazwa=wyzwanie_data.nazwa,
        opis=wyzwanie_data.opis,
        czasowe=wyzwanie_data.czasowe,
        data_start=wyzwanie_data.data_start,
        data_koniec=wyzwanie_data.data_koniec,
        autor_id=user_id,
        uczestnicy=uczestnicy_list,
        zadania_dzienne=zadania_list
    )


@router.get("/zaproszenia/odebrane", response_model=schemas.OdebraneZaproszeniaWyzwaniaResponse)
def get_zaproszenia(
        user_id: int = Depends(get_current_user_id),
        conn=Depends(get_db)
):
    """Pobiera zaproszenia do wyzwań otrzymane przez użytkownika.
    Wymagania spełnione: 2a (widok)
   """
    with conn.cursor() as cur:
        cur.execute("""
                    SELECT
                        uczestnictwo_id,
                        wyzwanie_id,
                        wyzwanie_nazwa,
                        wyzwanie_opis,
                        autor_id,
                        autor_nazwa
                    FROM widok_odebrane_zaproszenia_wyzwania
                    WHERE odbiorca_id = %s
                    """, (user_id,))

        results = [
            schemas.OdebraneZaproszenieWyzwanieOut(
                uczestnictwo_id=row[0],
                wyzwanie_id=row[1],
                nazwa=row[2],
                opis=row[3],
                autor_id=row[4],
                autor_nazwa=row[5]
            )
            for row in cur.fetchall()
        ]

    return schemas.OdebraneZaproszeniaWyzwaniaResponse(
        message="Odebrane zaproszenia do wyzwań",
        status="success",
        data=results
    )

@router.get("/zaproszenia/wyslane", response_model=schemas.WyslaneZaproszeniaWyzwaniaResponse)
def get_zaproszenia_wyslane(
        user_id: int = Depends(get_current_user_id),
        conn=Depends(get_db)
):
    with conn.cursor() as cur:
        cur.execute("""
                    SELECT
                        uczestnictwo_id,
                        wyzwanie_id,
                        wyzwanie_nazwa,
                        odbiorca_id,
                        odbiorca_nazwa
                    FROM widok_wyslane_zaproszenia_wyzwania
                    WHERE autor_id = %s
                    """, (user_id,))

        rows = cur.fetchall()

        # Konwersja każdego wiersza na instancję Pydantic
        zaproszenia = [
            schemas.WyslaneZaproszenieWyzwanieOut(
                uczestnictwo_id=row[0],
                wyzwanie_id=row[1],
                wyzwanie_nazwa=row[2],
                odbiorca_id=row[3],
                odbiorca_nazwa=row[4]
            )
            for row in rows
        ]
    return schemas.WyslaneZaproszeniaWyzwaniaResponse(
        message="Wysłane zaproszenia oczekujące na odpowiedź",
        status="success",
        data=zaproszenia
    )


@router.post("/zaproszenia/{uczestnictwo_id}/akceptuj", response_model=schemas.AkceptacjaZaproszeniaResponse)
def akceptuj_zaproszenie(
        uczestnictwo_id: int,
        user_id: int = Depends(get_current_user_id),
        conn=Depends(get_db)
):

    """Akceptuje zaproszenie do wyzwania.
         6c (funkcja wbudowana w PL/pgSQL)
         6b – walidacja danych w bazie, kontrola spójności danych
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT akceptuj_zaproszenie_wyzwania_func(%s, %s);",
            (uczestnictwo_id, user_id)
        )
        success = cur.fetchone()[0]

        if not success:
            raise HTTPException(
                status_code=404,
                detail="Zaproszenie nie istnieje lub zostało już obsłużone"
            )

        conn.commit()

    return schemas.AkceptacjaZaproszeniaResponse(
        status="success",
        message="Zaproszenie zaakceptowane"
    )

@router.post("/zaproszenia/{uczestnictwo_id}/odrzuc", response_model=schemas.OdrzucenieZaproszeniaResponse)
def odrzuc_zaproszenie(
        uczestnictwo_id: int,
        user_id: int = Depends(get_current_user_id),
        conn=Depends(get_db)
):
    """Odrzuca zaproszenie do wyzwania (usuwa je).
    6b – walidacja danych w bazie, kontrola spójności
    Wymagania spełnione: 6c (funkcja wbudowana w PL/pgSQL)
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT odrzuc_zaproszenie_wyzwania_func(%s, %s);",
            (uczestnictwo_id, user_id)
        )
        success = cur.fetchone()[0]

        if not success:
            raise HTTPException(
                status_code=404,
                detail="Zaproszenie nie istnieje lub zostało już obsłużone"
            )

        conn.commit()

    return schemas.OdrzucenieZaproszeniaResponse(
        status="success",
        message="Zaproszenie odrzucone"
    )

@router.get("/{wyzwanie_id}", response_model=schemas.WyzwanieResponse)
def get_wyzwanie(wyzwanie_id: int, conn=Depends(get_db)):
    """
    Zwraca pełne dane wyzwania w formacie JSON, łącznie z uczestnikami, zadaniami dziennymi i podzadaniami.
    6c (funkcja wbudowana w PL/pgSQL)
    6b – wykorzystanie funkcji agregujących, relacji 1-n i n-m, kontrola spójności danych poprzez klucze obce
    """

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Wywołanie funkcji SQL
        cur.execute("SELECT fn_get_wyzwanie_json(%s) AS wyzwanie", (wyzwanie_id,))
        result = cur.fetchone()

        if not result or result["wyzwanie"] is None:
            return schemas.WyzwanieResponse(status="error", message="Wyzwanie nie istnieje")

        return schemas.WyzwanieResponse(status="success", data=result["wyzwanie"])

@router.post("/progres/podzadania/{podzadanie_id}", response_model=schemas.UpdateProgresResponse)
def update_progres(
        podzadanie_id: int,
        wykonane: bool,
        conn=Depends(get_db),
        user_id: int = Depends(get_current_user_id)
):
    """
    Aktualizuje lub dodaje wpis o postępie użytkownika dla konkretnego podzadania
    2c widoki.
    :param podzadanie_id:
    :param wykonane:
    :param conn:
    :param user_id:
    :return:
    """
    with conn.cursor() as cur:

        # 1. Pobieramy uczestnik_id powiązany z użytkownikiem i tym podzadaniem
        cur.execute("""
                    SELECT uczestnik_id
                    FROM widok_uczestnik_podzadania
                    WHERE podzadanie_id = %s AND uzytkownik_id = %s
                    """, (podzadanie_id, user_id))

        row = cur.fetchone()
        if not row:
            cur.execute("SELECT rola FROM uzytkownicy WHERE id = %s", (user_id,))
            role_row = cur.fetchone()
            user_role = role_row[0] if role_row else 'user'

            if user_role == 'admin':
                return schemas.UpdateProgresResponse(
                    status="admin_readonly",
                    podzadanie_id=podzadanie_id,
                    wykonane=False,
                    message="Jesteś administratorem - to tylko podgląd."
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=schemas.UpdateProgresErrorResponse(
                        message="Użytkownik nie jest uczestnikiem tego wyzwania"
                    ).model_dump()
                )

        uczestnik_id = row[0]

        # 2. Zapisujemy/aktualizujemy progres
        cur.execute("""
                    INSERT INTO progres_podzadania (uczestnik_id, podzadanie_id, data, wykonane)
                    VALUES (%s, %s, CURRENT_DATE, %s)
                    ON CONFLICT (uczestnik_id, podzadanie_id, data)
                        DO UPDATE SET wykonane = EXCLUDED.wykonane
                    """, (uczestnik_id, podzadanie_id, wykonane))

        conn.commit()

    return schemas.UpdateProgresResponse(
        status="success",
        podzadanie_id=podzadanie_id,
        wykonane=wykonane
    )

@router.post("/progres/dzienne/{zadanie_id}", response_model=schemas.UpdateProgresResponse)
def update_progres_dzienne(
        zadanie_id: int,
        wykonane: bool,
        conn=Depends(get_db),
        user_id: int = Depends(get_current_user_id)
):
    with conn.cursor() as cur:
        """
        Aktualizuje lub dodaje dzienny progres użytkownika dla konkretnego zadania.
        2c widoki
        """

        # 1. Pobierz uczestnik_id dla danego użytkownika i wyzwania
        cur.execute("""
                    SELECT uczestnik_id
                    FROM widok_uczestnik_zadanie_dzienne
                    WHERE zadanie_id = %s AND uzytkownik_id = %s
                    """, (zadanie_id, user_id))

        row = cur.fetchone()
        if not row:
            cur.execute("SELECT rola FROM uzytkownicy WHERE id = %s", (user_id,))
            role_row = cur.fetchone()
            user_role = role_row[0] if role_row else 'user'

            if user_role == 'admin':
                return schemas.UpdateProgresResponse(
                    status="admin_readonly",
                    podzadanie_id=zadanie_id, # Tutaj używamy zadanie_id w polu podzadanie_id (lub musisz dodać pole zadanie_id do schematu jeśli je masz)
                    wykonane=False,
                    message="Jesteś administratorem - to tylko podgląd."
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=schemas.UpdateProgresErrorResponse(
                        message="Użytkownik nie jest uczestnikiem tego wyzwania"
                    ).model_dump()
                )

        uczestnik_id = row[0]

        # 2. Zapisz lub aktualizuj progres
        cur.execute("""
                    INSERT INTO progres_dzienne (uczestnik_id, zadanie_id, data, wykonane)
                    VALUES (%s, %s, CURRENT_DATE, %s)
                    ON CONFLICT (uczestnik_id, zadanie_id, data)
                        DO UPDATE SET wykonane = EXCLUDED.wykonane
                    """, (uczestnik_id, zadanie_id, wykonane))

        conn.commit()

    return schemas.UpdateProgresResponse(
        status="success",
        podzadanie_id=zadanie_id,
        wykonane=wykonane
    )


@router.get("/progres/dzienne/{zadanie_id}", response_model=schemas.GetProgresDzienneResponse)
def get_progres_dzienne(
        zadanie_id: int,
        conn=Depends(get_db),
        user_id: int = Depends(get_current_user_id)
):
    """
        Zwraca procent wykonania i informację, czy zadanie dzienne zostało wykonane przez użytkownika.
        6c – funkcja wbudowana w PL/pgSQL kontrolująca spójność danych i obsługująca brak uczestnictwa
        6b – agregacja procentu wykonania i kontrola spójności danych
        """

    with conn.cursor() as cur:

        cur.execute("SELECT rola FROM uzytkownicy WHERE id = %s", (user_id,))
        role_row = cur.fetchone()
        user_role = role_row[0] if role_row else 'user'

        # Pobierz procent wykonania z funkcji PL/pgSQL
        cur.execute(
            """
            SELECT *
            FROM fn_get_progres_dzienne(%s, %s)
            """,
            (zadanie_id, user_id)
        )
        row = cur.fetchone()
        if not row:
            if user_role == 'admin':
                # Admin widzi wyzwanie, ale w nim nie uczestniczy.
                # Zwracamy "fałszywe" dane, żeby frontend się nie posypał.
                wykonane = False
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Użytkownik nie jest uczestnikiem tego wyzwania"
                )

        else:
            procent, wykonane = row

    return schemas.GetProgresDzienneResponse(
        status="success",
        zadanie_id=zadanie_id,
        wykonane=wykonane
    )

@router.get("/progres/podzadania/{podzadanie_id}",
            response_model=schemas.GetProgresPodzadanieResponse | schemas.UpdateProgresErrorResponse)
def get_progres(podzadanie_id: int, conn=Depends(get_db), user_id: int = Depends(get_current_user_id)):
    """
    Zwraca informację, czy zalogowany użytkownik wykonał dziś dane podzadanie
    :param podzadanie_id:
    :param conn:
    :param user_id:
    :return:
    """
    with conn.cursor() as cur:
        # Pobieramy id uczestnika w wyzwaniu powiązanym z tym podzadaniem
        cur.execute("""
                    SELECT uw.id
                    FROM uczestnicy_wyzwan uw
                             JOIN zadania_dzienne zd ON zd.wyzwanie_id = uw.wyzwanie_id
                             JOIN podzadania p ON p.zadanie_id = zd.id
                    WHERE p.id = %s AND uw.uzytkownik_id = %s
                    """, (podzadanie_id, user_id))
        row = cur.fetchone()
        if not row:
            return schemas.UpdateProgresErrorResponse(
                message="Użytkownik nie jest uczestnikiem tego wyzwania"
            )
        uczestnik_id = row[0]

        # Pobranie progresu z tabeli progres_podzadania
        cur.execute("""
                    SELECT wykonane
                    FROM progres_podzadania
                    WHERE uczestnik_id = %s AND podzadanie_id = %s AND data = CURRENT_DATE
                    """, (uczestnik_id, podzadanie_id))
        row = cur.fetchone()
        wykonane = row[0] if row else False

    return schemas.GetProgresPodzadanieResponse(
        status="success",
        podzadanie_id=podzadanie_id,
        wykonane=wykonane
    )

@router.get("/progres/dzienne/historia/wszystkie/{zadanie_id}")
def get_progres_dzienne_historia_wszystkie(
        zadanie_id: int,
        conn=Depends(get_db)
):
    """
    Zwraca historię progresu dla zadania.
    Cała logika obliczeniowa i generowanie osi czasu odbywa się w bazie danych (Thick Database).
    """
    with conn.cursor() as cur:
        # Wywołujemy funkcję SQL, która zwraca gotowy JSON (listę obiektów)
        cur.execute("SELECT fn_pobierz_historie_wykresu(%s)", (zadanie_id,))

        # Pobieramy wynik (Postgres zwraca to jako pojedynczy ciąg JSON/obiekt)
        result_json = cur.fetchone()[0]

    return {
        "status": "success",
        "zadanie_id": zadanie_id,
        "historia": result_json  # To jest lista wygenerowana przez SQL
    }
@router.delete("/{wyzwanie_id}", response_model=schemas.DeleteWyzwanieResponse)
def delete_wyzwanie_admin(
        wyzwanie_id: int,
        user_id: int = Depends(get_current_user_id),
        conn=Depends(get_db)
):
    with conn.cursor() as cur:
        # Wywołujemy funkcję z dwoma parametrami
        cur.execute("SELECT usun_wyzwanie_admin(%s, %s)", (wyzwanie_id, user_id))
        result = cur.fetchone()[0]
        conn.commit()

        # Mapujemy wynik z bazy na format oczekiwany przez front-end
        if result == 'error_no_admin':
            return schemas.DeleteWyzwanieResponse(
                status="error",
                message="Brak uprawnień. Tylko administrator może usuwać wyzwania.",
                wyzwanie_id=wyzwanie_id
            )

        if result == 'error_not_found':
            return schemas.DeleteWyzwanieResponse(
                status="error",
                message="Wyzwanie nie istnieje.",
                wyzwanie_id=wyzwanie_id
            )

        # Jeśli baza zwróciła 'success'
        return schemas.DeleteWyzwanieResponse(
            status="success",
            message="Wyzwanie zostało pomyślnie usunięte.",
            wyzwanie_id=wyzwanie_id
        )

-- Tabela Użytkownicy
CREATE TABLE IF NOT EXISTS uzytkownicy (
    id SERIAL PRIMARY KEY,
    nazwa_uzytkownika VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_haslo VARCHAR(255) NOT NULL,
    profilowe_url VARCHAR(255),
    rola VARCHAR(20) NOT NULL DEFAULT 'user',

    CONSTRAINT chk_email_poprawny CHECK (email LIKE '%@%'),
    CONSTRAINT chk_nazwa_dlugosc CHECK (LENGTH(nazwa_uzytkownika) >= 3),
    CONSTRAINT chk_rola_wartosci CHECK (rola IN ('user', 'admin'))
    );

-- Tabela Znajomi
CREATE TABLE IF NOT EXISTS znajomi (
    id SERIAL PRIMARY KEY,
    uzytkownik_id INT NOT NULL REFERENCES uzytkownicy(id),
    znajomy_id INT NOT NULL REFERENCES uzytkownicy(id),
    status VARCHAR(50) DEFAULT 'oczekujacy',
    data_zaproszenia TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sa_znajomymi BOOLEAN DEFAULT FALSE
    );

-- Tabela Wyzwania
CREATE TABLE IF NOT EXISTS wyzwania (
    id SERIAL PRIMARY KEY,
    nazwa VARCHAR(255) NOT NULL,
    opis TEXT,
    czasowe BOOLEAN DEFAULT FALSE,
    data_start TIMESTAMP,
    data_koniec TIMESTAMP,
    autor_id INT NOT NULL REFERENCES uzytkownicy(id)
    );

-- Tabela Uczestnicy Wyzwań
CREATE TABLE IF NOT EXISTS uczestnicy_wyzwan (
    id SERIAL PRIMARY KEY,
    wyzwanie_id INT NOT NULL REFERENCES wyzwania(id),
    uzytkownik_id INT NOT NULL REFERENCES uzytkownicy(id),
    zaakceptowane BOOLEAN DEFAULT FALSE
    );

-- Tabela Zadania Dzienne
CREATE TABLE IF NOT EXISTS zadania_dzienne (
    id SERIAL PRIMARY KEY,
    wyzwanie_id INT NOT NULL REFERENCES wyzwania(id),
    nazwa VARCHAR(255) NOT NULL,
    opis TEXT
    );

-- Tabela Podzadania
CREATE TABLE IF NOT EXISTS podzadania (
    id SERIAL PRIMARY KEY,
    zadanie_id INT NOT NULL REFERENCES zadania_dzienne(id),
    nazwa VARCHAR(255) NOT NULL,
    wymagane BOOLEAN DEFAULT FALSE,
    waga FLOAT DEFAULT 1.0
    );

-- Tabela Progres Dzienne
CREATE TABLE IF NOT EXISTS progres_dzienne (
    id SERIAL PRIMARY KEY,
    uczestnik_id INT NOT NULL REFERENCES uczestnicy_wyzwan(id),
    zadanie_id INT NOT NULL REFERENCES zadania_dzienne(id),
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    wykonane BOOLEAN DEFAULT FALSE,
    wartosc FLOAT DEFAULT 0,
    CONSTRAINT unique_progress_dzienne UNIQUE (uczestnik_id, zadanie_id, data)
    );

-- Tabela Progres Podzadania
CREATE TABLE IF NOT EXISTS progres_podzadania (
    id SERIAL PRIMARY KEY,
    uczestnik_id INT NOT NULL REFERENCES uczestnicy_wyzwan(id),
    podzadanie_id INT NOT NULL REFERENCES podzadania(id),
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    wykonane BOOLEAN DEFAULT FALSE,
    CONSTRAINT unique_progress_podzadania UNIQUE (uczestnik_id, podzadanie_id, data)
    );


-------------------------Uzytkownicy-------------------------------
-- Spełnienie wymagania 2a: Wykorzystanie w bazie widoków
-- Security through obscurity (STO)
CREATE OR REPLACE VIEW widok_dane_logowania AS
SELECT
    id,
    nazwa_uzytkownika,
    email,
    hashed_haslo
FROM uzytkownicy;

-- Funkcja, którą uruchomi wyzwalacz
CREATE OR REPLACE FUNCTION wyzwalacz_czyszczenie_danych()
RETURNS TRIGGER AS $$
BEGIN
    -- Usuwamy białe znaki (spacje) z początku i końca
    NEW.nazwa_uzytkownika := TRIM(NEW.nazwa_uzytkownika);
    NEW.email := TRIM(NEW.email);
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Właściwy Wyzwalacz (Wymaganie 6c)
CREATE OR REPLACE TRIGGER trg_nowy_uzytkownik_czyszczenie
    BEFORE INSERT ON uzytkownicy
    FOR EACH ROW EXECUTE FUNCTION wyzwalacz_czyszczenie_danych();

-- Funkcja realizująca rejestrację (Wymaganie 6c - Funkcje wbudowane)
CREATE OR REPLACE FUNCTION zarejestruj_uzytkownika(
    p_nazwa VARCHAR,
    p_email VARCHAR,
    p_haslo VARCHAR
)
RETURNS INT AS $$
DECLARE
nowe_id INT;
BEGIN
    -- Próba wstawienia rekordu
    INSERT INTO uzytkownicy (nazwa_uzytkownika, email, hashed_haslo)
    VALUES (p_nazwa, p_email, p_haslo)
        RETURNING id INTO nowe_id;

    RETURN nowe_id;
END;
$$ LANGUAGE plpgsql;

-------------------------Znajomi-------------------------------

-- Widok łączący tabelę znajomi z danymi użytkowników
CREATE OR REPLACE VIEW widok_szczegoly_relacji AS
SELECT
    z.id AS relacja_id,
    z.uzytkownik_id,
    z.znajomy_id,
    z.status,
    z.sa_znajomymi,
    u1.nazwa_uzytkownika AS inicjator_nazwa,
    u1.email AS inicjator_email,
    u1.profilowe_url AS inicjator_profilowe_url,
    u2.nazwa_uzytkownika AS adresat_nazwa,
    u2.email AS adresat_email,
    u2.profilowe_url AS adresat_profilowe_url
FROM znajomi z
         JOIN uzytkownicy u1 ON z.uzytkownik_id = u1.id
         JOIN uzytkownicy u2 ON z.znajomy_id = u2.id;


-- Widok z agregacją (Wymaganie 6a: GROUP BY)
-- Zlicza ilu znajomych ma każdy użytkownik
-- Wymaganie 6a: Widok z funkcją agregującą
CREATE OR REPLACE VIEW widok_statystyki_znajomych AS
SELECT
    u.id AS uzytkownik_id,
    u.nazwa_uzytkownika,
    COUNT(t.friend_id) AS liczba_znajomych
FROM uzytkownicy u
         LEFT JOIN (
    -- 1. Przypadek: Ja zaprosiłem kogoś (jestem w kolumnie uzytkownik_id)
    SELECT uzytkownik_id AS user_id, znajomy_id AS friend_id
    FROM znajomi
    WHERE sa_znajomymi = TRUE

    UNION ALL

    -- 2. Przypadek: Ktoś zaprosił mnie (jestem w kolumnie znajomy_id)
    SELECT znajomy_id AS user_id, uzytkownik_id AS friend_id
    FROM znajomi
    WHERE sa_znajomymi = TRUE
) t ON u.id = t.user_id
GROUP BY u.id, u.nazwa_uzytkownika;


-- Spełnienie wymagania 2c (funkcja agregująca)
CREATE OR REPLACE FUNCTION zlicz_oczekujace_zaproszenia(p_uzytkownik_id INT)
RETURNS INT AS $$
DECLARE
liczba INT;
BEGIN
    -- Tutaj używamy funkcji agregującej COUNT
SELECT COUNT(*) INTO liczba
FROM znajomi
WHERE znajomy_id = p_uzytkownik_id AND status = 'oczekujacy';

RETURN liczba;
END;
$$ LANGUAGE plpgsql;

-- Funkcja do wyszukiwania osób, które NIE są jeszcze znajomymi ani nie ma zaproszeń
CREATE OR REPLACE FUNCTION szukaj_potencjalnych_znajomych(
    p_szukana_fraza VARCHAR,
    p_moje_id INT
)
RETURNS TABLE (
    id INT,
    nazwa_uzytkownika VARCHAR,
    email VARCHAR
) AS $$
BEGIN
RETURN QUERY
SELECT u.id, u.nazwa_uzytkownika, u.email
FROM uzytkownicy u
WHERE u.nazwa_uzytkownika ILIKE '%' || p_szukana_fraza || '%'
      AND u.id != p_moje_id
      AND NOT EXISTS (
          SELECT 1 FROM znajomi z
          WHERE (z.uzytkownik_id = p_moje_id AND z.znajomy_id = u.id)
             OR (z.uzytkownik_id = u.id AND z.znajomy_id = p_moje_id)
      );
END;
$$ LANGUAGE plpgsql;

-- Funkcja wysyłająca zaproszenie (z walidacją wewnątrz bazy)
CREATE OR REPLACE FUNCTION wyslij_zaproszenie(
    p_uzytkownik_id INT,
    p_znajomy_id INT
)
RETURNS TABLE (
    nowe_id INT,
    status VARCHAR,
    data TIMESTAMP
) AS $$
DECLARE
v_istnieje BOOLEAN;
BEGIN
    -- Walidacja: czy relacja już istnieje (Wymaganie 6b/6c)
SELECT EXISTS(
    SELECT 1 FROM znajomi
    WHERE (uzytkownik_id = p_uzytkownik_id AND znajomy_id = p_znajomy_id)
       OR (uzytkownik_id = p_znajomy_id AND znajomy_id = p_uzytkownik_id)
) INTO v_istnieje;

IF v_istnieje THEN
        RAISE EXCEPTION 'Relacja już istnieje';
END IF;

    -- Wstawienie danych
RETURN QUERY
    INSERT INTO znajomi (uzytkownik_id, znajomy_id, status, sa_znajomymi, data_zaproszenia)
    VALUES (p_uzytkownik_id, p_znajomy_id, 'oczekujacy', FALSE, NOW())
    RETURNING znajomi.id, znajomi.status, znajomi.data_zaproszenia;
END;
$$ LANGUAGE plpgsql;


-- Funkcja do zmiany statusu (Akceptacja/Odrzucenie)
CREATE OR REPLACE FUNCTION zmien_status_zaproszenia(
    p_zaproszenie_id INT,
    p_uzytkownik_id INT, -- ID osoby wykonującej akcję (security check)
    p_nowy_status VARCHAR
)
RETURNS TABLE (
    z_id INT,
    z_uzytkownik_id INT,
    z_znajomy_id INT,
    z_status VARCHAR,
    z_sa_znajomymi BOOLEAN,
    z_data_zaproszenia TIMESTAMP
) AS $$
DECLARE
v_czy_poprawny_adresat BOOLEAN;
BEGIN
    -- Sprawdzenie czy zaproszenie jest skierowane do tej osoby
SELECT EXISTS(
    SELECT 1 FROM znajomi
    WHERE id = p_zaproszenie_id AND znajomy_id = p_uzytkownik_id AND status = 'oczekujacy'
) INTO v_czy_poprawny_adresat;

IF NOT v_czy_poprawny_adresat THEN
        RAISE EXCEPTION 'Nie znaleziono zaproszenia lub brak uprawnień';
END IF;

    -- Aktualizacja
RETURN QUERY
UPDATE znajomi
SET status = p_nowy_status,
    sa_znajomymi = (p_nowy_status = 'zaakceptowany')
WHERE id = p_zaproszenie_id
    RETURNING id, uzytkownik_id, znajomy_id, status, sa_znajomymi, data_zaproszenia;
END;
$$ LANGUAGE plpgsql;


-------------------------Wyzwania-------------------------------
CREATE OR REPLACE VIEW widok_moje_wyzwania AS
SELECT DISTINCT
    w.id, w.nazwa, w.opis, w.czasowe, w.data_start, w.data_koniec, w.autor_id,
    uw.uzytkownik_id AS uczestnik_id,
    uw.zaakceptowane
FROM wyzwania w
         LEFT JOIN uczestnicy_wyzwan uw
                   ON uw.wyzwanie_id = w.id;

----------------------------DODAJ WYZWNIA---------------
----------Funkcja – obsługa relacji M:N
CREATE OR REPLACE FUNCTION fn_obsluga_relacji_uczestnicy()
RETURNS TRIGGER AS $$
BEGIN
    -- Autor zawsze zaakceptowany
    IF NEW.uzytkownik_id = (
        SELECT autor_id FROM wyzwania WHERE id = NEW.wyzwanie_id
    ) THEN
        NEW.zaakceptowane := TRUE;
END IF;

RETURN NEW;
END;
$$ LANGUAGE plpgsql;

------Trigger – kontrola relacji
DROP TRIGGER IF EXISTS trg_przed_dodaniem_uczestnika ON uczestnicy_wyzwan;

CREATE TRIGGER trg_przed_dodaniem_uczestnika
    BEFORE INSERT ON uczestnicy_wyzwan
    FOR EACH ROW
    EXECUTE FUNCTION fn_obsluga_relacji_uczestnicy();

CREATE OR REPLACE FUNCTION fn_dodaj_autora_do_wyzwania()
RETURNS TRIGGER AS $$
BEGIN
INSERT INTO uczestnicy_wyzwan (wyzwanie_id, uzytkownik_id, zaakceptowane)
VALUES (NEW.id, NEW.autor_id, TRUE);

RETURN NEW;
END;
$$ LANGUAGE plpgsql;


----------------Trigger – automatyczne tworzenie relacji
DROP TRIGGER IF EXISTS trg_po_utworzeniu_wyzwania ON wyzwania;

CREATE TRIGGER trg_po_utworzeniu_wyzwania
    AFTER INSERT ON wyzwania
    FOR EACH ROW
    EXECUTE FUNCTION fn_dodaj_autora_do_wyzwania();


DROP TRIGGER IF EXISTS trg_przed_dodaniem_uczestnika ON uczestnicy_wyzwan;

CREATE TRIGGER trg_przed_dodaniem_uczestnika
    BEFORE INSERT ON uczestnicy_wyzwan
    FOR EACH ROW
    EXECUTE FUNCTION fn_obsluga_relacji_uczestnicy();

-- Spełnienie wymagania 2a: Wykorzystanie w bazie widoków
CREATE OR REPLACE VIEW widok_uczestnicy_wyzwania AS
SELECT
    uw.wyzwanie_id,
    u.id AS uzytkownik_id,
    u.nazwa_uzytkownika,
    uw.zaakceptowane
FROM uczestnicy_wyzwan uw
         JOIN uzytkownicy u ON u.id = uw.uzytkownik_id;



-- Spełnienie wymagania 2a: Wykorzystanie w bazie widoków
CREATE OR REPLACE VIEW widok_wyslane_zaproszenia_wyzwania AS
SELECT
    uw.id AS uczestnictwo_id,
    w.id AS wyzwanie_id,
    w.nazwa AS wyzwanie_nazwa,
    w.autor_id,               -
    u.id AS odbiorca_id,
    u.nazwa_uzytkownika AS odbiorca_nazwa,
    uw.zaakceptowane
FROM uczestnicy_wyzwan uw
         JOIN wyzwania w ON w.id = uw.wyzwanie_id
         JOIN uzytkownicy u ON u.id = uw.uzytkownik_id
WHERE uw.zaakceptowane = FALSE;


-- Spełnienie wymagania 2a (widoki)
CREATE OR REPLACE VIEW widok_odebrane_zaproszenia_wyzwania AS
SELECT
    u.id AS uczestnictwo_id,
    u.uzytkownik_id AS odbiorca_id,
    w.id AS wyzwanie_id,
    w.nazwa AS wyzwanie_nazwa,
    w.opis AS wyzwanie_opis,
    w.autor_id,
    uz.nazwa_uzytkownika AS autor_nazwa
FROM uczestnicy_wyzwan u
         JOIN wyzwania w ON w.id = u.wyzwanie_id
         JOIN uzytkownicy uz ON uz.id = w.autor_id
WHERE u.zaakceptowane = FALSE;


CREATE OR REPLACE FUNCTION akceptuj_zaproszenie_wyzwania_func(p_id INT, p_user_id INT)
RETURNS BOOLEAN AS $$
DECLARE
    v_updated_rows INT;
BEGIN
    UPDATE uczestnicy_wyzwan
    SET zaakceptowane = TRUE
    WHERE id = p_id
      AND uzytkownik_id = p_user_id
      AND zaakceptowane = FALSE;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    RETURN v_updated_rows > 0;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION odrzuc_zaproszenie_wyzwania_func(p_id INT, p_user_id INT)
RETURNS BOOLEAN AS $$
DECLARE
v_deleted_rows INT;
BEGIN
    DELETE FROM uczestnicy_wyzwan
    WHERE id = p_id
      AND uzytkownik_id = p_user_id
      AND zaakceptowane = FALSE;

    GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;

    RETURN v_deleted_rows > 0;
END;
$$ LANGUAGE plpgsql;


   ------------------------- WIDOKI Z HAVING  -------------------------

-- 1. Widok obliczający procent wykonania zadań, które posiadają podzadania.
-- Spełnia wymaganie: Funkcja agregująca SUM w HAVING.
CREATE OR REPLACE VIEW widok_progres_zadan_zlozonych AS
SELECT
    uw.uzytkownik_id,
    zd.id AS zadanie_id,
    -- Obliczamy procent: (Suma wag wykonanych / Suma wszystkich wag) * 100
    CAST(
            ROUND(
                    (SUM(CASE WHEN pp.wykonane IS TRUE THEN p.waga ELSE 0 END) / SUM(p.waga)) * 100
            ) AS INT
    ) AS procent_wykonania
FROM uczestnicy_wyzwan uw
         JOIN zadania_dzienne zd ON uw.wyzwanie_id = zd.wyzwanie_id
         JOIN podzadania p ON zd.id = p.zadanie_id -- INNER JOIN wybiera tylko zadania z podzadaniami
         LEFT JOIN progres_podzadania pp ON p.id = pp.podzadanie_id
    AND pp.uczestnik_id = uw.id
    AND pp.data::date = CURRENT_DATE
GROUP BY uw.uzytkownik_id, zd.id
HAVING SUM(p.waga) > 0; -- Zabezpieczenie przed dzieleniem przez 0 oraz filtracja pustych zadań


-- 2. Widok pokazujący "Wyzwania Społecznościowe" (więcej niż 1 uczestnik).
-- Spełnia wymaganie: Funkcja agregująca COUNT w HAVING.
CREATE OR REPLACE VIEW widok_aktywne_wyzwania_statystyki AS
SELECT
    w.id,
    w.nazwa,
    COUNT(uw.id) as liczba_uczestnikow
FROM wyzwania w
         JOIN uczestnicy_wyzwan uw ON w.id = uw.wyzwanie_id
GROUP BY w.id, w.nazwa
HAVING COUNT(uw.id) > 1;


CREATE OR REPLACE FUNCTION fn_get_wyzwanie_json(p_wyzwanie_id INT)
RETURNS JSON AS $$
BEGIN
RETURN (
    SELECT json_build_object(
                   'id', w.id,
                   'nazwa', w.nazwa,
                   'opis', w.opis,
                   'czasowe', w.czasowe,

                   'data_start',
                   CASE
                       WHEN w.data_start IS NULL THEN NULL
                       ELSE to_char(w.data_start, 'YYYY-MM-DD"T"HH24:MI:SS')
                       END,

                   'data_koniec',
                   CASE
                       WHEN w.data_koniec IS NULL THEN NULL
                       ELSE to_char(w.data_koniec, 'YYYY-MM-DD"T"HH24:MI:SS')
                       END,

                   'autor_id', w.autor_id,

                   'uczestnicy', (
                       SELECT COALESCE(json_agg(
                                               json_build_object(
                                                       'id', u.id,
                                                       'nazwa_uzytkownika', u.nazwa_uzytkownika,
                                                       'zaakceptowane', uw.zaakceptowane
                                               )
                                                   ORDER BY u.id
                                       ), '[]'::json)
                       FROM uczestnicy_wyzwan uw
                                JOIN uzytkownicy u ON u.id = uw.uzytkownik_id
                       WHERE uw.wyzwanie_id = w.id
                   ),

                   'zadania_dzienne', (
                       SELECT COALESCE(json_agg(
                                               json_build_object(
                                                       'id', z.id,
                                                       'nazwa', z.nazwa,
                                                       'opis', z.opis,

                                                       'podzadania', (
                                                           SELECT COALESCE(json_agg(
                                                                                   json_build_object(
                                                                                           'id', p.id,
                                                                                           'nazwa', p.nazwa,
                                                                                           'wymagane', p.wymagane,
                                                                                           'waga', p.waga
                                                                                   )
                                                                                       ORDER BY p.id
                                                                           ), '[]'::json)
                                                           FROM podzadania p
                                                           WHERE p.zadanie_id = z.id
                                                       )
                                               )
                                                   ORDER BY z.id
                                       ), '[]'::json)
                       FROM zadania_dzienne z
                       WHERE z.wyzwanie_id = w.id
                   )
           )
    FROM wyzwania w
    WHERE w.id = p_wyzwanie_id
);
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE VIEW widok_uczestnik_podzadania AS
SELECT
    uw.id AS uczestnik_id,
    uw.uzytkownik_id,
    p.id AS podzadanie_id,
    zd.id AS zadanie_id,
    uw.wyzwanie_id
FROM uczestnicy_wyzwan uw
         JOIN zadania_dzienne zd ON zd.wyzwanie_id = uw.wyzwanie_id
         JOIN podzadania p ON p.zadanie_id = zd.id;


CREATE OR REPLACE VIEW widok_uczestnik_zadanie_dzienne AS
SELECT
    uw.id AS uczestnik_id,
    uw.uzytkownik_id,
    zd.id AS zadanie_id,
    uw.wyzwanie_id
FROM uczestnicy_wyzwan uw
         JOIN zadania_dzienne zd ON zd.wyzwanie_id = uw.wyzwanie_id;


CREATE OR REPLACE FUNCTION fn_get_progres_dzienne(
    p_zadanie_id INT,
    p_user_id INT
)
RETURNS TABLE (
    procent INT,
    wykonane BOOLEAN
) AS $$
BEGIN
RETURN QUERY
    WITH uczestnik AS (
        SELECT uw.id AS uczestnik_id
        FROM uczestnicy_wyzwan uw
                 JOIN zadania_dzienne zd ON zd.wyzwanie_id = uw.wyzwanie_id
        WHERE zd.id = p_zadanie_id AND uw.uzytkownik_id = p_user_id
    )
SELECT
    COALESCE(wpz.procent_wykonania,
             CASE WHEN pd.wykonane THEN 100 ELSE 0 END) AS procent,
    COALESCE(wpz.procent_wykonania,
             CASE WHEN pd.wykonane THEN 100 ELSE 0 END) = 100 AS wykonane
FROM uczestnik u
         LEFT JOIN widok_progres_zadan_zlozonych wpz
                   ON wpz.zadanie_id = p_zadanie_id AND wpz.uzytkownik_id = p_user_id
         LEFT JOIN progres_dzienne pd
                   ON pd.zadanie_id = p_zadanie_id AND pd.uczestnik_id = u.uczestnik_id
                       AND pd.data::date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;


   CREATE OR REPLACE FUNCTION usun_wyzwanie_admin(p_wyzwanie_id INT)
RETURNS VOID AS $$
BEGIN
    -- 1. Usuń progres podzadań (poprzez podzadania -> zadania)
DELETE FROM progres_podzadania
WHERE podzadanie_id IN (
    SELECT p.id FROM podzadania p
                         JOIN zadania_dzienne z ON p.zadanie_id = z.id
    WHERE z.wyzwanie_id = p_wyzwanie_id
);

-- 2. Usuń progres dzienny
DELETE FROM progres_dzienne
WHERE zadanie_id IN (
    SELECT id FROM zadania_dzienne WHERE wyzwanie_id = p_wyzwanie_id
);

-- 3. Usuń podzadania
DELETE FROM podzadania
WHERE zadanie_id IN (
    SELECT id FROM zadania_dzienne WHERE wyzwanie_id = p_wyzwanie_id
);

-- 4. Usuń zadania dzienne
DELETE FROM zadania_dzienne WHERE wyzwanie_id = p_wyzwanie_id;

-- 5. Usuń uczestników
DELETE FROM uczestnicy_wyzwan WHERE wyzwanie_id = p_wyzwanie_id;

-- 6. Na końcu usuń samo wyzwanie
DELETE FROM wyzwania WHERE id = p_wyzwanie_id;
END;
$$ LANGUAGE plpgsql;




-- ---------------------------------------------------------
-- KROK 1: Funkcja obliczająca procenty dla konkretnego dnia
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_oblicz_procent_zadania(
    p_uczestnik_id INT,
    p_zadanie_id INT,
    p_data DATE
)
RETURNS INT AS $$
DECLARE
v_suma_wag FLOAT;
    v_suma_wykonane FLOAT;
    v_czy_zlozone BOOLEAN;
    v_procent INT;
BEGIN
    -- 1. Sprawdzamy czy zadanie ma podzadania
SELECT EXISTS (SELECT 1 FROM podzadania WHERE zadanie_id = p_zadanie_id)
INTO v_czy_zlozone;

IF v_czy_zlozone THEN
        -- Logika dla zadań ZŁOŻONYCH (liczymy wagi)

        -- Suma wszystkich wag
SELECT COALESCE(SUM(waga), 0) INTO v_suma_wag
FROM podzadania
WHERE zadanie_id = p_zadanie_id;

-- Suma wag wykonanych w danym dniu
SELECT COALESCE(SUM(p.waga), 0) INTO v_suma_wykonane
FROM podzadania p
         JOIN progres_podzadania pp ON p.id = pp.podzadanie_id
WHERE p.zadanie_id = p_zadanie_id
  AND pp.uczestnik_id = p_uczestnik_id
  AND pp.data::date = p_data
          AND pp.wykonane = TRUE;

IF v_suma_wag > 0 THEN
            v_procent := ROUND((v_suma_wykonane / v_suma_wag) * 100);
ELSE
            v_procent := 0;
END IF;

ELSE
        -- Logika dla zadań PROSTYCH (0% lub 100%)
SELECT CASE WHEN EXISTS (
    SELECT 1 FROM progres_dzienne
    WHERE uczestnik_id = p_uczestnik_id
      AND zadanie_id = p_zadanie_id
      AND data::date = p_data
        AND wykonane = TRUE
) THEN 100 ELSE 0 END
INTO v_procent;
END IF;

RETURN v_procent;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------
-- KROK 2: Funkcja generująca JSON z historią (Thick DB)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_pobierz_historie_wykresu(p_zadanie_id INT)
RETURNS JSON AS $$
DECLARE
v_wyzwanie_id INT;
    v_data_start TIMESTAMP;
    v_data_koniec TIMESTAMP;
    v_czasowe BOOLEAN;

    -- Zmienne obliczone
    v_start_calc DATE;
    v_koniec_calc DATE;

    v_min_data_progres DATE;
    v_wynik JSON;
BEGIN
    -- 1. Pobieramy dane wyzwania
SELECT w.id, w.data_start, w.data_koniec, w.czasowe
INTO v_wyzwanie_id, v_data_start, v_data_koniec, v_czasowe
FROM wyzwania w
         JOIN zadania_dzienne zd ON w.id = zd.wyzwanie_id
WHERE zd.id = p_zadanie_id;

-- 2. Ustalanie daty KOŃCOWEJ
IF v_czasowe AND v_data_koniec IS NOT NULL AND v_data_koniec < NOW() THEN
        v_koniec_calc := v_data_koniec::date;
ELSE
        v_koniec_calc := CURRENT_DATE;
END IF;

    -- 3. Ustalanie daty STARTOWEJ
    IF v_czasowe AND v_data_start IS NOT NULL THEN
        v_start_calc := v_data_start::date;
ELSE
SELECT MIN(data::date) INTO v_min_data_progres
FROM progres_dzienne
WHERE zadanie_id = p_zadanie_id;

v_start_calc := COALESCE(v_min_data_progres, CURRENT_DATE);

        DECLARE
v_min_data_podzadania DATE;
BEGIN
SELECT MIN(pp.data::date) INTO v_min_data_podzadania
FROM progres_podzadania pp
         JOIN podzadania p ON p.id = pp.podzadanie_id
WHERE p.zadanie_id = p_zadanie_id;

v_start_calc := LEAST(COALESCE(v_start_calc, 'infinity'::date), COALESCE(v_min_data_podzadania, 'infinity'::date));

            IF v_start_calc = 'infinity'::date THEN
                v_start_calc := CURRENT_DATE;
END IF;
END;
END IF;

    -- 4. Generowanie JSON
SELECT json_agg(
               json_build_object(
                       'uczestnik_id', t.uczestnik_id,
                       'nazwa_uzytkownika', t.nazwa_uzytkownika,
                       'punkty', t.punkty_historia
               )
       ) INTO v_wynik
FROM (
         SELECT
             uw.id AS uczestnik_id,
             u.nazwa_uzytkownika,
             (
                 SELECT json_agg(
                                json_build_object(
                                        'data', to_char(d.dzien, 'YYYY-MM-DD'),
                                    -- !!! TUTAJ BYŁ BŁĄD - DODANO ::date !!!
                                        'procent', fn_oblicz_procent_zadania(uw.id, p_zadanie_id, d.dzien::date)
                                ) ORDER BY d.dzien
                        )
                 FROM generate_series(
                              v_start_calc,
                              v_koniec_calc,
                              '1 day'::interval
                      ) AS d(dzien)
             ) AS punkty_historia
         FROM uczestnicy_wyzwan uw
                  JOIN uzytkownicy u ON u.id = uw.uzytkownik_id
         WHERE uw.wyzwanie_id = v_wyzwanie_id
           AND uw.zaakceptowane = TRUE
     ) t;

RETURN COALESCE(v_wynik, '[]'::json);
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- ======================= SEED ============================
-- =========================================================
DO $$
BEGIN
    -- JEŚLI BAZA NIE JEST PUSTA → NIC NIE RÓB
    IF EXISTS (SELECT 1 FROM uzytkownicy) THEN
        RAISE NOTICE 'Seed pominięty – baza nie jest pusta';
        RETURN;
END IF;

    RAISE NOTICE 'Seed start – baza pusta';

    -- ================== UŻYTKOWNICY ==================
INSERT INTO uzytkownicy (nazwa_uzytkownika, email, hashed_haslo, rola)
VALUES
    ('admin', 'admin@betya.pl', '$2b$12$kHtd5NKwoRt/GxRj3xP4v.owxWGd/PzauU9d21XY7XE.VxHG9Y6ru', 'admin'),
    ('ala',   'ala@betya.pl',   '$2b$12$Z3IY/FCzgIAghvlqqtfvYOeiFuAv57wpirdNChSeKOKUHH7wEox6q',   'user'),
    ('ola',   'ola@betya.pl',   '$2b$12$UDypK9VnpJ46wbdFmYyvZu/jjc3hwp7hsCeRFKGKxjfa0IB/DbJeK',   'user'),
    ('tom',   'tom@betya.pl',   '$2b$12$.5Us4.O3mWC09iLzQXlZbuZoRyry08HYCp2Gs5SKxcmjODzS/Wj0O',   'user');

-- ================== ZNAJOMI ==================
-- ala ↔ ola, tom
INSERT INTO znajomi (uzytkownik_id, znajomy_id, status, sa_znajomymi)
SELECT u1.id, u2.id, 'zaakceptowany', TRUE
FROM uzytkownicy u1
         JOIN uzytkownicy u2 ON u2.nazwa_uzytkownika IN ('ola', 'tom')
WHERE u1.nazwa_uzytkownika = 'ala';

-- ola ↔ tom
INSERT INTO znajomi (uzytkownik_id, znajomy_id, status, sa_znajomymi)
SELECT u1.id, u2.id, 'zaakceptowany', TRUE
FROM uzytkownicy u1
         JOIN uzytkownicy u2 ON u2.nazwa_uzytkownika = 'tom'
WHERE u1.nazwa_uzytkownika = 'ola';

-- ================== WYZWANIE 1 ==================
INSERT INTO wyzwania (nazwa, opis, czasowe, autor_id)
VALUES (
           'test do usuniecia',
           'Testowe wyzwanie',
           FALSE,
           (SELECT id FROM uzytkownicy WHERE nazwa_uzytkownika = 'ola')
       );

-- uczestnicy (tylko ala akceptuje)
INSERT INTO uczestnicy_wyzwan (wyzwanie_id, uzytkownik_id, zaakceptowane)
SELECT w.id, u.id, (u.nazwa_uzytkownika = 'ala')
FROM wyzwania w
         JOIN uzytkownicy u ON u.nazwa_uzytkownika IN ('ala', 'tom')
WHERE w.nazwa = 'test do usuniecia';

-- zadanie dzienne
INSERT INTO zadania_dzienne (wyzwanie_id, nazwa)
SELECT id, 'test zadanie dzienne'
FROM wyzwania
WHERE nazwa = 'test do usuniecia';

-- ================== WYZWANIE 2 ==================
INSERT INTO wyzwania (nazwa, opis, czasowe, data_start, data_koniec, autor_id)
VALUES (
           'Przykładowe wyzwanie',
           'Zdrowe nawyki',
           TRUE,
           NOW() - INTERVAL '1 day',
           NOW() + INTERVAL '2 months',
           (SELECT id FROM uzytkownicy WHERE nazwa_uzytkownika = 'ola')
       );

-- uczestnicy (tylko ala akceptuje)
INSERT INTO uczestnicy_wyzwan (wyzwanie_id, uzytkownik_id, zaakceptowane)
SELECT w.id, u.id, (u.nazwa_uzytkownika = 'ala')
FROM wyzwania w
         JOIN uzytkownicy u ON u.nazwa_uzytkownika IN ('ala', 'tom')
WHERE w.nazwa = 'Przykładowe wyzwanie';

-- ================== ZADANIA ==================
INSERT INTO zadania_dzienne (wyzwanie_id, nazwa)
SELECT id, '8h snu'
FROM wyzwania
WHERE nazwa = 'Przykładowe wyzwanie';

INSERT INTO zadania_dzienne (wyzwanie_id, nazwa)
SELECT id, 'wypicie 1.5l wody'
FROM wyzwania WHERE nazwa = 'Przykładowe wyzwanie';

-- ================== PODZADANIA ==================
INSERT INTO podzadania (zadanie_id, nazwa, waga)
SELECT id, 'szklanka 0.5l', 1
FROM zadania_dzienne
WHERE nazwa = 'wypicie 1.5l wody';
INSERT INTO podzadania (zadanie_id, nazwa, waga)
SELECT id, 'szklanka 0.5l', 1
FROM zadania_dzienne
WHERE nazwa = 'wypicie 1.5l wody';
INSERT INTO podzadania (zadanie_id, nazwa, waga)
SELECT id, 'szklanka 0.5l', 1
FROM zadania_dzienne
WHERE nazwa = 'wypicie 1.5l wody';
--
-- ================== WCZORAJ – OLA ==================
-- 8h snu
INSERT INTO progres_dzienne (uczestnik_id, zadanie_id, data, wykonane, wartosc)
SELECT uw.id, z.id, CURRENT_DATE - 1, TRUE, 1
FROM uczestnicy_wyzwan uw
         JOIN uzytkownicy u ON u.id = uw.uzytkownik_id
         JOIN zadania_dzienne z ON z.wyzwanie_id = uw.wyzwanie_id
         JOIN wyzwania w ON w.id = uw.wyzwanie_id
WHERE u.nazwa_uzytkownika = 'ola'
  AND w.nazwa = 'Przykładowe wyzwanie'
  AND z.nazwa = '8h snu';

-- woda 1.5l (Ola)
INSERT INTO progres_dzienne (uczestnik_id, zadanie_id, data, wykonane, wartosc)
SELECT uw.id, z.id, CURRENT_DATE - 1, TRUE, SUM(p.waga)
FROM uczestnicy_wyzwan uw
         JOIN uzytkownicy u ON u.id = uw.uzytkownik_id
         JOIN zadania_dzienne z ON z.wyzwanie_id = uw.wyzwanie_id
         JOIN wyzwania w ON w.id = uw.wyzwanie_id
         JOIN podzadania p ON p.zadanie_id = z.id
WHERE u.nazwa_uzytkownika = 'ola'
  AND w.nazwa = 'Przykładowe wyzwanie'
  AND z.nazwa = 'wypicie 1.5l wody'
GROUP BY uw.id, z.id;

-- wszystkie podzadania wykonane
INSERT INTO progres_podzadania (uczestnik_id, podzadanie_id, data, wykonane)
SELECT uw.id, p.id, CURRENT_DATE - 1, TRUE
FROM uczestnicy_wyzwan uw
         JOIN uzytkownicy u ON u.id = uw.uzytkownik_id
         JOIN wyzwania w ON w.id = uw.wyzwanie_id
         JOIN zadania_dzienne z ON z.wyzwanie_id = w.id
         JOIN podzadania p ON p.zadanie_id = z.id
WHERE u.nazwa_uzytkownika = 'ola'
  AND w.nazwa = 'Przykładowe wyzwanie'
  AND z.nazwa = 'wypicie 1.5l wody';

-- ================== DZISIAJ – ALA ==================
-- 8h snu
INSERT INTO progres_dzienne (uczestnik_id, zadanie_id, data, wykonane, wartosc)
SELECT uw.id, z.id, CURRENT_DATE, TRUE, 1
FROM uczestnicy_wyzwan uw
         JOIN uzytkownicy u ON u.id = uw.uzytkownik_id
         JOIN zadania_dzienne z ON z.wyzwanie_id = uw.wyzwanie_id
         JOIN wyzwania w ON w.id = uw.wyzwanie_id
WHERE u.nazwa_uzytkownika = 'ala'
  AND w.nazwa = 'Przykładowe wyzwanie'
  AND z.nazwa = '8h snu';


RAISE NOTICE 'Seed zakończony poprawnie';
END $$;

from fastapi import APIRouter, Depends
from app.auth.jwt import get_current_user_id
from app.database import get_db

router = APIRouter(prefix="/home", tags=["home"])

@router.get("/")
def home(user_id: int = Depends(get_current_user_id), conn=Depends(get_db)):
    """Szybkie info dla frontendu na start"""
    return {
        "message": f"Witaj, użytkowniku {user_id}!",
        "status": "success",
    }




# from fastapi import APIRouter, Depends, HTTPException, Query, Path
# from typing import List
# from app import schemas
# from app.database import get_db
# from app.auth.jwt import  get_current_user_id
#
# router = APIRouter(
#     prefix="/home",
#     tags=["home"]
# )
#
# @router.get("/")
# def read_root():return{"message": "Witaj w home!"}
#
# # @router.get("/znajomi")
# # def get_znajomi(user_id: int = Depends(get_current_user_id), conn=Depends(get_db)):
# #     znajomi_list = []
# #     with conn.cursor() as cur:
# #         cur.execute("""
# #                     SELECT id, uzytkownik_id, znajomy_id
# #                     FROM znajomi
# #                     WHERE (uzytkownik_id = %s OR znajomy_id = %s) AND sa_znajomymi = TRUE
# #                     """, (user_id, user_id))
# #         znajomi_relacje = cur.fetchall()
# #
# #     for rel_id, u_id, z_id in znajomi_relacje:
# #         znajomy_id = z_id if u_id == user_id else u_id
# #         with conn.cursor() as cur:
# #             cur.execute("SELECT id, nazwa_uzytkownika, email FROM uzytkownicy WHERE id = %s", (znajomy_id,))
# #             row = cur.fetchone()
# #         if row:
# #             znajomi_list.append({
# #                 "id": row[0],
# #                 "nazwa_uzytkownika": row[1],
# #                 "email": row[2]
# #             })
# #
# #     return {
# #         "message": "Lista znajomych",
# #         "status": "success",
# #         "data": znajomi_list
# #     }
#
# # @router.get("/pending/wyslane")
# # def get_wyslane(user_id: int = Depends(get_current_user_id), conn=Depends(get_db)):
# #     wyslane_list = []
# #     with conn.cursor() as cur:
# #         cur.execute("""
# #                     SELECT id, znajomy_id FROM znajomi
# #                     WHERE uzytkownik_id = %s AND status = 'oczekujacy'
# #                     """, (user_id,))
# #         oczekujace_relacje = cur.fetchall()
# #
# #     for rel_id, znajomy_id in oczekujace_relacje:
# #         with conn.cursor() as cur:
# #             cur.execute("SELECT id, nazwa_uzytkownika, email FROM uzytkownicy WHERE id = %s", (znajomy_id,))
# #             row = cur.fetchone()
# #         if row:
# #             wyslane_list.append({
# #                 "relacja_id": rel_id,
# #                 "uzytkownik": {
# #                     "id": row[0],
# #                     "nazwa_uzytkownika": row[1],
# #                     "email": row[2]
# #                 }
# #             })
# #
# #     return {
# #         "message": "Wysłane oczekujące zaproszenia",
# #         "status": "success",
# #         "data": wyslane_list
# #     }
#
# # @router.get("/pending/odebrane")
# # def get_odebrane(user_id: int = Depends(get_current_user_id), conn=Depends(get_db)):
# #     odebrane_list = []
# #     with conn.cursor() as cur:
# #         cur.execute("""
# #                     SELECT id, uzytkownik_id FROM znajomi
# #                     WHERE znajomy_id = %s AND status = 'oczekujacy'
# #                     """, (user_id,))
# #         odebrane_relacje = cur.fetchall()
# #
# #     for rel_id, nadawca_id in odebrane_relacje:
# #         with conn.cursor() as cur:
# #             cur.execute("SELECT id, nazwa_uzytkownika, email FROM uzytkownicy WHERE id = %s", (nadawca_id,))
# #             row = cur.fetchone()
# #         if row:
# #             odebrane_list.append({
# #                 "relacja_id": rel_id,
# #                 "uzytkownik": {
# #                     "id": row[0],
# #                     "nazwa_uzytkownika": row[1],
# #                     "email": row[2]
# #                 }
# #             })
# #
# #     return {
# #         "message": "Odebrane oczekujące zaproszenia",
# #         "status": "success",
# #         "data": odebrane_list
# #     }
# #
#
#
#
# @router.get("/wyzwania")
# def get_wyzwania(user_id: int = Depends(get_current_user_id), conn=Depends(get_db)):
#     wyzwania_list = []
#     with conn.cursor() as cur:
#         cur.execute("""
#                     SELECT w.id, w.nazwa, w.opis, w.data_start, w.data_koniec, w.autor_id
#                     FROM wyzwania w
#                              LEFT JOIN uczestnicy_wyzwan u ON u.wyzwanie_id = w.id
#                     WHERE w.autor_id = %s OR u.uzytkownik_id = %s
#                     """, (user_id, user_id))
#         wszystkie_wyzwania = cur.fetchall()
#
#     for w_id, nazwa, opis, data_start, data_koniec, autor_id in wszystkie_wyzwania:
#         wyzwania_list.append({
#             "id": w_id,
#             "nazwa": nazwa,
#             "opis": opis,
#             "data_start": data_start,
#             "data_koniec": data_koniec,
#             "autor_id": autor_id
#         })
#
#     return {
#         "message": "Wszystkie wyzwania użytkownika",
#         "status": "success",
#         "data": wyzwania_list
#     }
#
#
# @router.post("/wyzwania_dodaj", response_model=schemas.WyzwanieOut)
# def create_wyzwanie(
#         wyzwanie_data: schemas.WyzwanieCreate,
#         user_id: int = Depends(get_current_user_id),
#         conn=Depends(get_db)
# ):
#     # 1. Tworzymy wyzwanie
#     with conn.cursor() as cur:
#         cur.execute("""
#                     INSERT INTO wyzwania (nazwa, opis, czasowe, data_start, data_koniec, autor_id)
#                     VALUES (%s, %s, %s, %s, %s, %s)
#                     RETURNING id
#                     """, (
#                         wyzwanie_data.nazwa,
#                         wyzwanie_data.opis,
#                         wyzwanie_data.czasowe,
#                         wyzwanie_data.data_start,
#                         wyzwanie_data.data_koniec,
#                         user_id
#                     ))
#         wyzwanie_id = cur.fetchone()[0]
#
#         # 2. Dodajemy uczestników
#         for uid in wyzwanie_data.uczestnicy_ids:
#             cur.execute("""
#                         INSERT INTO uczestnicy_wyzwan (wyzwanie_id, uzytkownik_id, zaakceptowane)
#                         VALUES (%s, %s, %s)
#                         """, (wyzwanie_id, uid, False))
#
#         # 3. Dodajemy zadania dzienne i podzadania
#         for zadanie_data in wyzwanie_data.zadania_dzienne:
#             cur.execute("""
#                         INSERT INTO zadania_dzienne (wyzwanie_id, nazwa, opis)
#                         VALUES (%s, %s, %s)
#                         RETURNING id
#                         """, (wyzwanie_id, zadanie_data.nazwa, zadanie_data.opis))
#             zadanie_id = cur.fetchone()[0]
#
#             for podzadanie_data in zadanie_data.podzadania:
#                 cur.execute("""
#                             INSERT INTO podzadania (zadanie_id, nazwa, wymagane, waga)
#                             VALUES (%s, %s, %s, %s)
#                             """, (
#                                 zadanie_id,
#                                 podzadanie_data.nazwa,
#                                 podzadanie_data.wymagane,
#                                 podzadanie_data.waga
#                             ))
#
#         conn.commit()
#
#     return {
#         "id": wyzwanie_id,
#         "nazwa": wyzwanie_data.nazwa,
#         "opis": wyzwanie_data.opis,
#         "czasowe": wyzwanie_data.czasowe,
#         "data_start": wyzwanie_data.data_start,
#         "data_koniec": wyzwanie_data.data_koniec,
#         "autor_id": user_id
#     }
#
#
# @router.post("/dodaj_znajomego", response_model=schemas.ZaproszenieOut)
# def dodaj_znajomego(
#         zaproszenie: schemas.ZaproszenieCreate,
#         conn=Depends(get_db),
#         user_id: int = Depends(get_current_user_id)
# ):
#     with conn.cursor() as cur:
#         # sprawdź czy relacja już istnieje
#         cur.execute("""
#                     SELECT id FROM znajomi
#                     WHERE (uzytkownik_id = %s AND znajomy_id = %s)
#                        OR (uzytkownik_id = %s AND znajomy_id = %s)
#                     """, (user_id, zaproszenie.znajomy_id, zaproszenie.znajomy_id, user_id))
#         if cur.fetchone():
#             raise HTTPException(status_code=400, detail="Relacja już istnieje")
#
#         # utwórz nowe zaproszenie
#         cur.execute("""
#                     INSERT INTO znajomi (uzytkownik_id, znajomy_id, status, sa_znajomymi, data_zaproszenia)
#                     VALUES (%s, %s, %s, %s, NOW())
#                     RETURNING id, uzytkownik_id, znajomy_id, status, sa_znajomymi, data_zaproszenia
#                     """, (user_id, zaproszenie.znajomy_id, "oczekujacy", False))
#         relacja = cur.fetchone()
#         conn.commit()
#
#     return {
#         "id": relacja[0],
#         "uzytkownik_id": relacja[1],
#         "znajomy_id": relacja[2],
#         "status": relacja[3],
#         "sa_znajomymi": relacja[4],
#         "data_zaproszenia": relacja[5]
#     }
#
#
# @router.post("/znajomi/{zaproszenie_id}/akceptuj", response_model=schemas.ZaproszenieOut)
# def akceptuj_zaproszenie(
#         zaproszenie_id: int = Path(..., description="ID relacji znajomości"),
#         conn=Depends(get_db),
#         user_id: int = Depends(get_current_user_id)
# ):
#     with conn.cursor() as cur:
#         cur.execute("""
#                     UPDATE znajomi
#                     SET status = 'zaakceptowany', sa_znajomymi = TRUE
#                     WHERE id = %s AND znajomy_id = %s AND status = 'oczekujacy'
#                     RETURNING id, uzytkownik_id, znajomy_id, status, sa_znajomymi, data_zaproszenia
#                     """, (zaproszenie_id, user_id))
#         relacja = cur.fetchone()
#         conn.commit()
#
#     if not relacja:
#         raise HTTPException(status_code=404, detail="Zaproszenie nie istnieje lub nie możesz go zaakceptować")
#
#     return {
#         "id": relacja[0],
#         "uzytkownik_id": relacja[1],
#         "znajomy_id": relacja[2],
#         "status": relacja[3],
#         "sa_znajomymi": relacja[4],
#         "data_zaproszenia": relacja[5]
#     }
#
#
# @router.post("/znajomi/{zaproszenie_id}/odrzuc", response_model=schemas.ZaproszenieOut)
# def odrzuc_zaproszenie(
#         zaproszenie_id: int = Path(..., description="ID relacji znajomości"),
#         conn=Depends(get_db),
#         user_id: int = Depends(get_current_user_id)
# ):
#     with conn.cursor() as cur:
#         # najpierw sprawdzamy czy relacja istnieje i należy do użytkownika
#         cur.execute("""
#                     SELECT id FROM znajomi
#                     WHERE id = %s AND znajomy_id = %s AND status = 'oczekujacy'
#                     """, (zaproszenie_id, user_id))
#         relacja = cur.fetchone()
#
#         if not relacja:
#             raise HTTPException(status_code=404, detail="Zaproszenie nie istnieje lub nie możesz go odrzucić")
#
#         # aktualizacja statusu
#         cur.execute("""
#                     UPDATE znajomi
#                     SET status = 'odrzucony', sa_znajomymi = FALSE
#                     WHERE id = %s
#                     RETURNING id, uzytkownik_id, znajomy_id, status, sa_znajomymi, data_zaproszenia
#                     """, (zaproszenie_id,))
#         updated = cur.fetchone()
#         conn.commit()
#
#     return {
#         "id": updated[0],
#         "uzytkownik_id": updated[1],
#         "znajomy_id": updated[2],
#         "status": updated[3],
#         "sa_znajomymi": updated[4],
#         "data_zaproszenia": updated[5]
#     }

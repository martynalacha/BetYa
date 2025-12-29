# app/schemas.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


# -------------------- Użytkownik --------------------

class UzytkownikCreate(BaseModel):
    nazwa_uzytkownika: str
    email: str
    haslo: str

class UzytkownikLogin(BaseModel):
    nazwa_uzytkownika: str
    haslo: str

class UzytkownikOut(BaseModel):
    id: int
    nazwa_uzytkownika: str
    email: str
    profilowe_url: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: UzytkownikOut

# -------------------- Znajomi --------------------
class ZaproszenieCreate(BaseModel):
    znajomy_id: int

class ZaproszenieOut(BaseModel):
    id: int
    uzytkownik_id: int  # kto wysłał zaproszenie
    znajomy_id: int     # do kogo
    status: str         # oczekujacy, zaakceptowany, zablokowany
    data_zaproszenia: datetime
    sa_znajomymi: bool

class ZnajomyOut(BaseModel):
    id: int
    nazwa_uzytkownika: str
    email: str
    profilowe_url: Optional[str] = None

class PendingZaproszenieOut(BaseModel):
    relacja_id: int
    uzytkownik: ZnajomyOut

class StatystykiZnajomychOut(BaseModel):
    liczba_znajomych: int
    liczba_oczekujacych_zaproszen: int

# -------------------- Wyzwania --------------------

class PodzadanieCreate(BaseModel):
    nazwa: str
    wymagane: bool = True
    waga: float = 1.0

class ZadanieDzienneCreate(BaseModel):
    nazwa: str
    opis: Optional[str] = None
    podzadania: List[PodzadanieCreate] = []

class WyzwanieCreate(BaseModel):
    nazwa: str
    opis: Optional[str] = None
    czasowe: bool = False
    data_start: Optional[datetime] = None
    data_koniec: Optional[datetime] = None
    uczestnicy_ids: List[int] = []
    zadania_dzienne: List[ZadanieDzienneCreate] = []

class WyzwanieOut(BaseModel):
    id: int
    nazwa: str
    opis: Optional[str] = None
    czasowe: bool
    data_start: Optional[datetime]
    data_koniec: Optional[datetime]
    autor_id: int

class WyzwaniaResponse(BaseModel):
    message: str
    status: str
    data: List[WyzwanieOut]

class UczestnikWyzwaniaOut(BaseModel):
    id: int
    nazwa_uzytkownika: str
    zaakceptowane: bool


class PodzadanieOut(BaseModel):
    id: int
    nazwa: str
    wymagane: bool
    waga: float


class ZadanieDzienneOut(BaseModel):
    id: int
    nazwa: str
    opis: Optional[str]
    podzadania: List[PodzadanieOut]


class WyzwanieCreateResponse(WyzwanieOut):
    uczestnicy: List[UczestnikWyzwaniaOut]
    zadania_dzienne: List[ZadanieDzienneOut]

class WyzwanieFullOut(BaseModel):
    id: int
    nazwa: str
    opis: Optional[str] = None
    czasowe: bool
    data_start: Optional[datetime] = None
    data_koniec: Optional[datetime] = None
    autor_id: int
    uczestnicy: List[UczestnikWyzwaniaOut] = []
    zadania_dzienne: List[ZadanieDzienneOut] = []

class WyzwanieResponse(BaseModel):
    status: str
    data: Optional[WyzwanieFullOut] = None
    message: Optional[str] = None

#--------------------- Wyzwanie zaproszenia---------------
class WyslaneZaproszenieWyzwanieOut(BaseModel):
    uczestnictwo_id: int
    wyzwanie_id: int
    wyzwanie_nazwa: str
    odbiorca_id: int
    odbiorca_nazwa: str


class WyslaneZaproszeniaWyzwaniaResponse(BaseModel):
    message: str
    status: str
    data: List[WyslaneZaproszenieWyzwanieOut]

class OdebraneZaproszenieWyzwanieOut(BaseModel):
    uczestnictwo_id: int
    wyzwanie_id: int
    nazwa: str
    opis: Optional[str] = None  # Opis może być nullem w bazie
    autor_id: int
    autor_nazwa: str


class OdebraneZaproszeniaWyzwaniaResponse(BaseModel):
    message: str
    status: str
    data: List[OdebraneZaproszenieWyzwanieOut]

class AkceptacjaZaproszeniaResponse(BaseModel):
    status: str
    message: str

# app/schemas.py

class OdrzucenieZaproszeniaResponse(BaseModel):
    status: str
    message: str

# -------------------- Zadania Dzienne i Podzadania --------------------

class UpdateProgresResponse(BaseModel):
    status: str
    podzadanie_id: int
    wykonane: bool
    message: Optional[str] = None

class UpdateProgresErrorResponse(BaseModel):
    status: str = "error"
    message: str

class GetProgresDzienneResponse(BaseModel):
    status: str
    zadanie_id: int
    wykonane: bool

class GetProgresPodzadanieResponse(BaseModel):
    status: str
    podzadanie_id: int
    wykonane: bool

class DeleteWyzwanieResponse(BaseModel):
    status: str  # "success" lub "error"
    message: str
    wyzwanie_id: Optional[int] = None  # Zwracamy ID usuniętego wyzwania przy sukcesie

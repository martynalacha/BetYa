# 🚀 BetYa – Social Challenges & Habits

BetYa to aplikacja społecznościowa do tworzenia wyzwań i budowania nawyków.
Umożliwia rywalizację ze znajomymi, śledzenie postępów oraz zarządzanie codziennymi zadaniami
w ramach wspólnych celów.

---

##  Wymagania

- Docker
- Docker Compose

---

##  Konfiguracja zmiennych środowiskowych

Projekt wykorzystuje Dockera, jednak do poprawnego działania wymaga pliku .env
z konfiguracją połączenia do bazy danych.

1. Skopiuj plik przykładowy:
   cp .env.example .env
   lub utwórz plik .env ręcznie w katalogu głównym projektu.

2. Upewnij się, że wartości w pliku .env są zgodne z Twoją konfiguracją środowiska.

---

##  Uruchomienie aplikacji (Docker Compose)

Upewnij się, że Docker Desktop jest uruchomiony, a następnie wykonaj:

docker-compose up --build

Po zakończeniu budowania kontenerów aplikacja będzie gotowa do użycia.

---

##  Testowanie i demonstracja

Po poprawnym uruchomieniu aplikacji dostępne są:

- Frontend (aplikacja):
  http://localhost:5173

- Backend (dokumentacja API – Swagger):
  http://localhost:8000/docs

---

##  Konta demonstracyjne (Demo)

Aby przetestować funkcjonalność aplikacji (wyzwania, system znajomych oraz role użytkowników)
bez konieczności rejestracji, możesz skorzystać z gotowych kont:

| Rola          | Login  | Hasło  |
|---------------|--------|--------|
| Użytkownik    | ola    | ola    |
| Użytkownik    | ala    | ala    |
| Administrator | admin  | admin  |


---

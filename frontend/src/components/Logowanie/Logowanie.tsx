import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import "./Logowanie.css"; //

export default function Logowanie() {
    // === Stany dla danych logowania i komunikatu ===
    const [nazwa, setNazwa] = useState("");
    const [haslo, setHaslo] = useState("");
    const [wiadomosc, setWiadomosc] = useState("");

    const navigate = useNavigate();

    // === Funkcja obsługująca wysyłkę formularza ===
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        console.log("Wysyłam dane logowania:", { nazwa_uzytkownika: nazwa, haslo });


        try {
            const res = await fetch("http://127.0.0.1:8000/auth/logowanie", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nazwa_uzytkownika: nazwa, haslo }),
            });

            const data = await res.json();

            if (res.ok) {
                // Zapisz token w localStorage
                localStorage.setItem("token", data.access_token);

                // Sukces logowania → przekierowanie
                navigate("/home", { state: { user: data.user } });
            } else {
                // Błąd logowania → FastAPI zwraca { detail: "..." }
                setWiadomosc(data.detail || "Nieprawidłowa nazwa użytkownika lub hasło");
            }
        } catch (error) {
            setWiadomosc("Błąd połączenia z serwerem");
            console.error(error);
        }
    };

    return (
        <div className="login-container">
            {/* === Nagłówek strony logowania === */}
            <h2 className="login-title">Zaloguj się</h2>

            {/* === Formularz logowania === */}
            <form onSubmit={handleSubmit} className="login-form">
                <input
                    placeholder="Nazwa użytkownika"
                    value={nazwa}
                    onChange={(e) => setNazwa(e.target.value)}
                    required
                />
                <input
                    placeholder="Hasło"
                    type="password"
                    value={haslo}
                    onChange={(e) => setHaslo(e.target.value)}
                    required
                />

                <button type="submit">Zaloguj</button>
            </form>

            {/* === Komunikat błędu / informacji === */}
            {wiadomosc && <p className="login-message">{wiadomosc}</p>}

            {/* === Sekcja przejścia do rejestracji === */}
            <div className="login-footer">
                <p>Nie masz konta?</p>
                <button
                    className="register-btn"
                    onClick={() => navigate("/rejestracja")}
                >
                    Zarejestruj się
                </button>
            </div>
        </div>
    );
}

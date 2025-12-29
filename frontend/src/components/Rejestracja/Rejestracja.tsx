import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import "./Rejestracja.css"; // importujemy dopasowane style

export default function Rejestracja() {
    // === Stany dla formularza ===
    const [nazwa, setNazwa] = useState("");
    const [email, setEmail] = useState("");
    const [haslo, setHaslo] = useState("");
    const [powtorzHaslo, setPowtorzHaslo] = useState("");

    // === Stany interfejsu ===
    const [wiadomosc, setWiadomosc] = useState("");
    const [resOk, setResOk] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false); // Blokada przycisku podczas wysyłania

    const navigate = useNavigate();

    // === Funkcja obsługująca wysyłkę formularza ===
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (haslo !== powtorzHaslo) {
            setResOk(false);
            setWiadomosc("Podane hasła nie są identyczne.");
            return;
        }

        // Resetujemy stany przed wysyłką
        setWiadomosc("");
        setResOk(null);
        setLoading(true);

        try {
            const res = await fetch("http://127.0.0.1:8000/register/rejestracja", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nazwa_uzytkownika: nazwa,
                    email,
                    haslo,
                }),
            });

            const data = await res.json();


            if (res.ok) {
                // Rejestracja OK
                setResOk(true);
                setWiadomosc("Rejestracja zakończona sukcesem!");
                setTimeout(() => navigate("/"), 1500);
            } else {
                // Błąd – backend zwraca np. { "detail": "Nazwa użytkownika lub email już istnieje" }
                setResOk(false);
                setWiadomosc(data.detail || "Nieznany błąd serwera");
            }
        } catch (err){
            console.error(err);
            setResOk(false);
            setWiadomosc("Błąd połączenia z serwerem");
        }
        finally {
            setLoading(false); // Odblokowujemy formularz niezależnie od wyniku
        }
    };

    return (
        <div className="register-container">
            {/* === Tytuł formularza === */}
            <h2 className="register-title">Rejestracja</h2>

            {/* === Formularz rejestracji === */}
            <form onSubmit={handleSubmit} className="register-form" >
                <input
                    placeholder="Nazwa użytkownika"
                    value={nazwa}
                    onChange={(e) => setNazwa(e.target.value)}
                    required
                    disabled={loading}
                />
                <input
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                />
                <input
                    placeholder="Hasło"
                    type="password"
                    value={haslo}
                    onChange={(e) => setHaslo(e.target.value)}
                    required
                    disabled={loading}
                />
                <input
                    placeholder="Powtórz hasło"
                    type="password"
                    value={powtorzHaslo}
                    onChange={(e) => setPowtorzHaslo(e.target.value)}
                    required
                    disabled={loading}
                />

                <button type="submit" disabled={loading}>
                    {loading ? "Rejestrowanie..." : "Zarejestruj"}
                </button>
            </form>

            {/* === Komunikat z backendu === */}
            {wiadomosc && (
                <p className={`register-message ${resOk ? "success" : "error"}`}>
                    {wiadomosc}
                </p>
            )}
        </div>
    );
}

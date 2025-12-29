import { useState, type ChangeEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import Logo from "../Logo/Logo";
import AddWyzwanie from "./AddWyzwanie.tsx"
import WyzwanieComponent  from "./Wyzwanie.tsx"

interface Znajomy {
    id: number;
    nazwa_uzytkownika: string;
    email?: string;
    profilowe_url?: string;
}

interface Relacja {
    relacja_id: number;
    uzytkownik: Znajomy;
}

interface Uczestnik {
    id: number;
    nazwa_uzytkownika: string;
    zaakceptowane: boolean;
}

interface Podzadanie {
    id: number;
    nazwa: string;
    wymagane: boolean;
    waga: number;
}


interface ZadanieDzienne {
    id: number;
    nazwa: string;
    opis?: string;
    podzadania: Podzadanie[];
}

interface Wyzwanie {
    id: number;
    nazwa: string;
    opis?: string;
    czasowe: boolean;
    data_start?: string;
    data_koniec?: string;
    autor_id: number;
    uczestnicy: Uczestnik[];
    zadania_dzienne: ZadanieDzienne[];
}

interface WyzwaniaZaproszeniaOdebrane {
    uczestnictwo_id: number;
    wyzwanie_id: number;
    nazwa: string;
    opis?: string;
    autor_id: number;
    autor_nazwa: string;
}

interface WyzwaniaZaproszeniaWyslane {
    uczestnictwo_id: number;
    wyzwanie_id: number;
    wyzwanie_nazwa: string;
    odbiorca_id: number;
    odbiorca_nazwa: string;
}

interface HomeData {
    znajomi: Znajomy[];
    pending_wyslane: Relacja[];
    pending_odebrane: Relacja[];
    wyzwania: Wyzwanie[];
    wyzwania_zaproszenia_odebrane: WyzwaniaZaproszeniaOdebrane[];
    wyzwania_zaproszenia_wyslane: WyzwaniaZaproszeniaWyslane[];
}

interface Statystyki {
    liczba_znajomych: number;
    liczba_oczekujacych_zaproszen: number;
}


export default function Home() {
    const [searchQuery, setSearchQuery] = useState("");
    const [suggestions, setSuggestions] = useState<Znajomy[]>([]);
    const [homeData, setHomeData] = useState<HomeData>({
        znajomi: [],
        pending_wyslane: [],
        pending_odebrane: [],
        wyzwania: [],
        wyzwania_zaproszenia_odebrane: [],
        wyzwania_zaproszenia_wyslane: [],
    });


    const [showForm, setShowForm] = useState(false)
    const [selectedWyzwanie, setSelectedWyzwanie] = useState<Wyzwanie | null>(null);
    const [statystyki, setStatystyki] = useState<Statystyki>({ liczba_znajomych: 0, liczba_oczekujacych_zaproszen: 0 });

    const navigate = useNavigate();

    // === Funkcja do pobrania aktualnych statystyk ===
    const updateStatystyki = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const res = await fetch("http://127.0.0.1:8000/znajomi/statystyki", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) return;

            const data: Statystyki = await res.json();
            setStatystyki(data);
        } catch (err) {
            console.error("Błąd pobierania statystyk:", err);
        }
    };

    // === Pobieranie danych znajomych ===
    useEffect(() => {
        const fetchHomeData = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) {
                    navigate("/logowanie");
                    return;
                }
                const headers: HeadersInit = { Authorization: `Bearer ${token}` };

                // Pobierz wszystkich znajomych
                const [
                    znajomiRes,
                    wyslaneRes,
                    odebraneRes,
                    wyzwaniaRes,
                    wyzwaniaZapOdebraneRes,
                    wyzwaniaZapWyslaneRes,
                ] = await Promise.all([
                    fetch("http://127.0.0.1:8000/znajomi/wszyscy", { headers }),
                    fetch("http://127.0.0.1:8000/znajomi/pending/wyslane", { headers }),
                    fetch("http://127.0.0.1:8000/znajomi/pending/odebrane", { headers }),
                    fetch("http://127.0.0.1:8000/wyzwania/", { headers }),
                    fetch("http://127.0.0.1:8000/wyzwania/zaproszenia/odebrane", { headers }),
                    fetch("http://127.0.0.1:8000/wyzwania/zaproszenia/wyslane", { headers }),
                ]);

                if ([znajomiRes, wyslaneRes, odebraneRes, wyzwaniaRes, wyzwaniaZapOdebraneRes, wyzwaniaZapWyslaneRes].some(r => r.status === 403)) {
                    alert("Twoja sesja wygasła. Zaloguj się ponownie.");
                    localStorage.removeItem("token");
                    navigate("/logowanie");
                    return;
                }

                const [znajomi, pending_wyslane, pending_odebrane, wyzwania, wyzwania_zaproszenia_odebrane, wyzwania_zaproszenia_wyslane] =
                    await Promise.all([
                        znajomiRes.json(),
                        wyslaneRes.json(),
                        odebraneRes.json(),
                        wyzwaniaRes.json(),
                        wyzwaniaZapOdebraneRes.json(),
                        wyzwaniaZapWyslaneRes.json(),
                    ]);

                setHomeData({
                    znajomi: Array.isArray(znajomi) ? znajomi : [],
                    pending_wyslane: Array.isArray(pending_wyslane) ? pending_wyslane : [],
                    pending_odebrane: Array.isArray(pending_odebrane) ? pending_odebrane : [],
                    wyzwania: wyzwania?.data || [],
                    wyzwania_zaproszenia_odebrane: wyzwania_zaproszenia_odebrane?.data || [],
                    wyzwania_zaproszenia_wyslane: wyzwania_zaproszenia_wyslane?.data || [],
                });
                await updateStatystyki();

            } catch (err) {
                console.error("Błąd fetch:", err);
            }
        };
        fetchHomeData().catch(err => console.error(err));
    }, [navigate]);

    // === Wyszukiwanie znajomych ===
    const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (!query.trim()) {
            setSuggestions([]);
            return;
        }

        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const res = await fetch(
                `http://127.0.0.1:8000/znajomi/szukaj?q=${encodeURIComponent(query.trim())}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (res.status === 403) {
                alert("Twoja sesja wygasła. Zaloguj się ponownie.");
                localStorage.removeItem("token");
                navigate("/logowanie");
                return;
            }

            const data: Znajomy[] = await res.json();
            setSuggestions(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Błąd fetch:", err);
            setSuggestions([]);
        }
    };

    // === Dodawanie znajomego ===
    const handleAddFriend = async (id: number, name: string) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("http://127.0.0.1:8000/znajomi/dodaj_znajomego", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify({ znajomy_id: id }),
            });

            if (!res.ok) {
                const data = await res.json();
                alert(data.detail || "Nie udało się wysłać zaproszenia");
                return;
            }

            const newRelacja = await res.json();

            // aktualizacja stanu: dodaj do pending_wyslane
            setHomeData(prev => ({
                ...prev,
                pending_wyslane: [...prev.pending_wyslane, {
                    relacja_id: newRelacja.id,
                    uzytkownik: {
                        id: newRelacja.znajomy_id,
                        nazwa_uzytkownika: name,
                        email: newRelacja.email || ""
                    }
                }]
            }));

            alert(`Zaproszenie wysłane do ${name}`);
            setSearchQuery("");
            setSuggestions([]);
        } catch (err) {
            console.error(err);
            alert("Błąd wysyłania zaproszenia");
        }
    };

    // === Akceptowanie / odrzucanie zaproszenia ===
    const handleUpdateFriend = async (id: number, action: "akceptuj" | "odrzuc") => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`http://127.0.0.1:8000/znajomi/${id}/${action}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
            });

            if (!res.ok) {
                const data = await res.json();
                alert(data.detail || "Nie udało się wykonać akcji");
                return;
            }

            // Pobierz aktualną listę znajomych
            const znajomiRes = await fetch("http://127.0.0.1:8000/znajomi/wszyscy", {
                headers: { Authorization: token ? `Bearer ${token}` : "" },
            });
            const wszyscy: Znajomy[] = await znajomiRes.json();

            setHomeData(prev => {
                if (!prev) return prev;

                const pending_odebrane = prev.pending_odebrane.filter(r => r.relacja_id !== id);

                return {
                    ...prev,
                    pending_odebrane,
                    znajomi: wszyscy, // tutaj aktualizujemy pełną listę znajomych
                };
            });
            updateStatystyki().catch(err => console.error(err));

            alert(action === "akceptuj" ? "Zaproszenie zaakceptowane!" : "Zaproszenie odrzucone!");
        } catch (err) {
            console.error(err);
            alert("Błąd wykonania akcji");
        }
    };


    const handleAcceptWyzwanie = async (uczestnictwo_id: number) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(
                `http://127.0.0.1:8000/wyzwania/zaproszenia/${uczestnictwo_id}/akceptuj`,
                { method: "POST", headers: { Authorization: `Bearer ${token}` } }
            );

            if (!res.ok) {
                if (res.status === 404) {
                    alert("To zaproszenie zostało już obsłużone.");
                } else {
                    const data = await res.json().catch(() => ({}));
                    alert(data.detail || "Nie udało się zaakceptować zaproszenia");
                }
                // Usuń zaproszenie z listy, żeby nie próbować ponownie
                setHomeData(prev => ({
                    ...prev,
                    wyzwania_zaproszenia_odebrane: prev.wyzwania_zaproszenia_odebrane.filter(
                        z => z.uczestnictwo_id !== uczestnictwo_id
                    )
                }));
                return;
            }

            const accepted = homeData.wyzwania_zaproszenia_odebrane.find(z => z.uczestnictwo_id === uczestnictwo_id);
            if (!accepted) return;

            const wyzwanieRes = await fetch(`http://127.0.0.1:8000/wyzwania/${accepted.wyzwanie_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const wyzwanieJson = await wyzwanieRes.json();
            const newWyzwanie = wyzwanieJson.data as Wyzwanie;

            setHomeData(prev => ({
                ...prev,
                wyzwania_zaproszenia_odebrane: prev.wyzwania_zaproszenia_odebrane.filter(
                    z => z.uczestnictwo_id !== uczestnictwo_id
                ),
                wyzwania: [...prev.wyzwania, newWyzwanie]
            }));


            alert("Zaproszenie zaakceptowane!");
        } catch (err) {
            console.error(err);
            alert("Błąd akceptacji wyzwania");
        }
    };


    const handleRejectWyzwanie = async (uczestnictwo_id: number) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(
                `http://127.0.0.1:8000/wyzwania/zaproszenia/${uczestnictwo_id}/odrzuc`,
                { method: "POST", headers: { Authorization: `Bearer ${token}` } }
            );

            if (!res.ok) {
                if (res.status === 404) {
                    alert("To zaproszenie zostało już obsłużone.");
                } else {
                    const data = await res.json().catch(() => ({}));
                    alert(data.detail || "Nie udało się odrzucić zaproszenia");
                }
            }

            setHomeData(prev => ({
                ...prev,
                wyzwania_zaproszenia_odebrane: prev.wyzwania_zaproszenia_odebrane.filter(
                    z => z.uczestnictwo_id !== uczestnictwo_id
                )
            }));

            alert("Zaproszenie odrzucone!");
        } catch (err) {
            console.error(err);
            alert("Błąd odrzucenia wyzwania");
        }
    };

    const loadWyzwanieDetails = async (id: number) => {
        const token = localStorage.getItem("token");
        const res = await fetch(`http://127.0.0.1:8000/wyzwania/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const json = await res.json();
        if (json.status === "success") {
            setSelectedWyzwanie(json.data);
        }
    };




    return (
        <div className="home-container">
            <div className="logo-header small-logo">
                <Logo />
            </div>

            <div className="left-panel">
                {/* === Odebrane wyzwania === */}
                <div className="friends-section">
                    <h5>🔥Odebrane wyzwania</h5>
                    {homeData.wyzwania_zaproszenia_odebrane.length ? (
                        <div className="cards-list">
                            {homeData.wyzwania_zaproszenia_odebrane.map((z) => (
                                <div key={`odebrane-${z.uczestnictwo_id}`} className="wyzwanie-card">
                                    <h4>{z.nazwa}</h4>
                                    {z.opis && <p>{z.opis}</p>}
                                    <p>Autor: <span className="odbiorca-name">{z.autor_nazwa}</span></p>
                                    <div className="wyzwania-actions">
                                        <button onClick={() => handleAcceptWyzwanie(z.uczestnictwo_id)}>Akceptuj</button>
                                        <button onClick={() => handleRejectWyzwanie(z.uczestnictwo_id)}>Odrzuć</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="no-results">Brak odebranych wyzwań</p>
                    )}
                </div>

                {/* === Wysłane wyzwania === */}
                <div className="friends-section">
                    <h5>⚡Wysłane wyzwania</h5>
                    {homeData.wyzwania_zaproszenia_wyslane.length ? (
                        <div className="cards-list">
                            {homeData.wyzwania_zaproszenia_wyslane.map((z) => (
                                <div key={`wyslane-${z.wyzwanie_id}-${z.odbiorca_id}`} className="wyzwanie-card sent">
                                <h4>{z.wyzwanie_nazwa}</h4>
                                    <p>
                                        Odbiorca: <span className="odbiorca-name">{z.odbiorca_nazwa}</span>
                                    </p>

                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="no-results">Brak wysłanych oczekujących wyzwań</p>
                    )}
                </div>
            </div>

            <div className="center-panel">
                <h3>💪Bet I will</h3>
                <button className="add-wyzwanie-btn" onClick={() => { console.log("Kliknięto przycisk"); setShowForm(true); }}>Dodaj wyzwanie</button>

                {showForm && (
                    <div className="popup-overlay" onClick={() => setShowForm(false)}>
                        <div className="popup-form" onClick={(e) => e.stopPropagation()}>
                            <AddWyzwanie
                                znajomi={homeData.znajomi}
                                onClose={() => setShowForm(false)}
                                onAdd={async (data) => {
                                    // 1. Wyślij dane na backend
                                    try {
                                        const token = localStorage.getItem("token");
                                        if (!token) return;

                                        const res = await fetch("http://127.0.0.1:8000/wyzwania/dodaj", {
                                            method: "POST",
                                            headers: {
                                                "Content-Type": "application/json",
                                                Authorization: `Bearer ${token}`,
                                            },
                                            body: JSON.stringify(data),
                                        });

                                        if (!res.ok) {
                                            const errorData = await res.json().catch(() => ({}));
                                            alert(errorData.detail || "Nie udało się dodać wyzwania");
                                            return;
                                        }

                                        const newWyzwanie = await res.json();

                                        // 2. Aktualizacja listy wyzwań
                                        setHomeData((prev) => ({
                                            ...prev,
                                            wyzwania: [...prev.wyzwania, newWyzwanie],
                                            // jeśli wysyłasz wyzwania do znajomych:
                                            wyzwania_zaproszenia_wyslane: data.uczestnicy_ids.length
                                                ? [
                                                    ...prev.wyzwania_zaproszenia_wyslane,
                                                    ...data.uczestnicy_ids.map((id) => {
                                                        const znajomy = homeData.znajomi.find(z => z.id === id);
                                                        return {
                                                            uczestnictwo_id: Math.random(), // tymczasowe ID
                                                            wyzwanie_id: newWyzwanie.id,
                                                            wyzwanie_nazwa: newWyzwanie.nazwa,
                                                            odbiorca_id: id,
                                                            odbiorca_nazwa: znajomy?.nazwa_uzytkownika || "Nieznany",
                                                        };
                                                    }),
                                                ]
                                                : prev.wyzwania_zaproszenia_wyslane,

                                        }));

                                        setShowForm(false); // zamknięcie popupu
                                    } catch (err) {
                                        console.error(err);
                                        alert("Błąd dodawania wyzwania");
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}

                <div className="wyzwania-list">
                    {homeData.wyzwania.length ? (
                        homeData.wyzwania?.map((w) => (
                            <div key={`wyzwanie-${w.id}`} className="wyzwanie-card" onClick={() =>loadWyzwanieDetails(w.id)}>
                                <h4>{w.nazwa}</h4>
                                <p>{w.opis}</p>
                            </div>
                        ))
                    ) : (
                        <p className="no-results">Brak wyzwań</p>
                    )}
                </div>
                {/* <<< Wklej popup tutaj */}
                {selectedWyzwanie && (
                    <div className="popup-overlay" onClick={() => setSelectedWyzwanie(null)}>
                        <div className="popup-form" onClick={(e) => e.stopPropagation()}>
                            <WyzwanieComponent
                                wyzwanie={selectedWyzwanie}
                                onClose={() => setSelectedWyzwanie(null)}
                            />
                        </div>
                    </div>
                )}

            </div>

            <div className="right-panel">
                <h3>✨Znajomi</h3>

                <div className="friends-section search-friends">
                    <h4>Dodaj nowych znajomych</h4>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={handleInputChange}
                        placeholder="Dodaj znajomych..."
                    />
                    {searchQuery.trim() && suggestions.length === 0 && (
                        <p className="no-results">Nie znaleziono użytkowników</p>
                    )}
                    {suggestions.length > 0 && (
                        <ul className="suggestions-list">
                            {suggestions.slice(0, 3).map((u) => (
                                <li key={u.id}>
                                    <span>{u.nazwa_uzytkownika}</span>
                                    <button onClick={() => handleAddFriend(u.id, u.nazwa_uzytkownika)}>
                                        Dodaj do znajomych
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="friends-section">
                    <h4>🤝Moi znajomi:   {statystyki.liczba_znajomych}</h4>
                    {homeData.znajomi.length ? (
                        <div className="cards-list">
                            {homeData.znajomi.map((u) => (
                                <div key={u.id} className="friend-card">
                                    <div className="friend-info">
                                        <span className="friend-name">{u.nazwa_uzytkownika}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="no-results">Brak znajomych</p>
                    )}
                </div>

                <div className="friends-section">
                    <h5>⏳ Zaproszenia: {statystyki.liczba_oczekujacych_zaproszen}</h5>
                    {homeData.pending_odebrane.length ? (
                        <div className="cards-list">
                            {homeData.pending_odebrane.map((rel) => (
                                <div key={rel.relacja_id} className="friend-card">
                                    <div className="friend-info">
                                        <span className="friend-name">{rel.uzytkownik.nazwa_uzytkownika}</span>
                                    </div>
                                    <div className="friend-actions">
                                        <button className="accept-btn" onClick={() => handleUpdateFriend(rel.relacja_id, "akceptuj")}>
                                            Akceptuj
                                        </button>
                                        <button className="reject-btn" onClick={() => handleUpdateFriend(rel.relacja_id, "odrzuc")}>
                                            Odrzuć
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="no-results">Brak oczekujących odebranych</p>
                    )}
                </div>

                <div className="friends-section">
                    <h5>Wysłane</h5>
                    {homeData.pending_wyslane.length ? (
                        <div className="cards-list">
                            {homeData.pending_wyslane.map((rel) => (
                                <div key={rel.relacja_id} className="friend-card">
                                    <div className="friend-info">
                                        <span className="friend-name">{rel.uzytkownik.nazwa_uzytkownika}</span>
                                    </div>
                                    <div className="friend-status">
                                        <span className="status-label">Zaproszenie wysłane</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="no-results">Brak oczekujących wysłanych</p>
                    )}
                </div>
            </div>
        </div>
    );
}

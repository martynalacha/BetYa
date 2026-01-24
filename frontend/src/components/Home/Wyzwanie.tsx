import React, { useEffect, useState, useMemo } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import "./Wyzwanie.css";

interface Znajomy {
    id: number;
    nazwa_uzytkownika: string;
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
    podzadania?: Podzadanie[];
}

interface Wyzwanie {
    id: number;
    nazwa: string;
    opis?: string;
    czasowe: boolean;
    data_start?: string;
    data_koniec?: string;
    autor_id: number;
    uczestnicy?: Uczestnik[];
    znajomi?: Znajomy[];
    zadania_dzienne?: ZadanieDzienne[];
}

interface Props {
    wyzwanie: Wyzwanie;
    onClose: () => void;
    onRefresh?: () => void;
}

interface APIPunkt {
    data: string;
    procent: number;
}

interface APIHistoriaUzytkownika {
    uczestnik_id: number;
    nazwa_uzytkownika: string;
    punkty: APIPunkt[];
}

interface PunktWykresu {
    date: string;
    [key: string]: string | number;
}

/**
 * Dekoduje payload tokena JWT.
 * Wykorzystuje mapowanie szesnastkowe (hex) i decodeURIComponent,
 * aby poprawnie obsłużyć polskie znaki (UTF-8) w nazwach użytkowników.
 */
const parseJwt = (token: string) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
};

/**
 * Sprowadza datę do formatu RRRR-MM-DD.
 * Odcina czas (wszystko po 'T'), co pozwala na łatwe porównywanie dni na wykresie.
 */
const normalizeDate = (dateStr: string | undefined): string => {
    if (!dateStr) return "";
    return dateStr.split('T')[0];
};

/**
 * Przypisuje unikalne kolory dla uczestników wyzwania.
 * Wykorzystuje operator modulo (%), aby bezpiecznie zapętlać paletę kolorów.
 */
const generateDistinctColors = (count: number) => {
    const palette = [
        "#0000FF", // Niebieski
        "#008000", // Ciemna zieleń
        "#FF00FF", // Magenta
        "#FFA500", // Pomarańczowy
        "#00FFFF", // Cyjan
        "#4B0082", // Indygo
        "#FFFF00", // Żółty
        "#8B4513", // Brązowy
        "#808080", // Szary
    ];

    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
        // Bierze kolor z listy. Jak braknie, zaczyna od początku listy (modulo)
        colors.push(palette[i % palette.length]);
    }
    return colors;
};

/**
 * Generuje tablicę wszystkich dni między startem a końcem wyzwania.
 * Tworzy obiekty daty ręcznie, aby uniknąć błędów związanych ze strefami czasowymi.
 */
const generateDateRange = (startDate: string, endDate: string) => {
    // Upewniamy się, że wchodzą czyste stringi YYYY-MM-DD
    const startStr = normalizeDate(startDate);
    const endStr = normalizeDate(endDate);

    if (!startStr || !endStr) return [];

    const dates = [];

    // Parsujemy ręcznie: rok, miesiąc-1, dzień
    const parseDate = (str: string) => {
        const parts = str.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    };

    const current = parseDate(startStr);
    const end = parseDate(endStr);

    // Zabezpieczenie pętli
    if (isNaN(current.getTime()) || isNaN(end.getTime())) return [];

    while (current <= end) {
        const year = current.getFullYear();
        // getMonth() zwraca 0-11, więc dodajemy 1 i formatujemy
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');

        // Tworzymy string idealnie pasujący do tego z normalizeDate
        dates.push(`${year}-${month}-${day}`);

        current.setDate(current.getDate() + 1);
    }
    return dates;
};

/**
 * Pobiera lokalną datę systemową w formacie RRRR-MM-DD.
 * Gwarantuje zgodność formatu z danymi z bazy danych.
 */
const getLocalToday = () => {
    const d = new Date();
    return d.getFullYear() + '-'
        + String(d.getMonth() + 1).padStart(2, '0') + '-'
        + String(d.getDate()).padStart(2, '0');
};

const Wyzwanie: React.FC<Props> = ({ wyzwanie, onClose, onRefresh }) => {
    const {currentUserId, userRole} = useMemo(() => {
        const token = localStorage.getItem("token");

        if (!token) {
            return { currentUserId: 0, userRole: null };
        }

        const decoded = parseJwt(token);

        const extractedId = decoded?.uzytkownik_id ||  0;
        const role = decoded?.rola || null;

        return { currentUserId: extractedId, userRole: role };
    }, []);

    /**
     Asynchronicznie usuwa wyzwanie z bazy danych przez API FastAPI.
     * Wymaga tokena Bearer. Po sukcesie zamyka widok i odświeża listę wyzwań.
     */
    const confirmDeleteWyzwanie = async () => {
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            const res = await fetch(`http://127.0.0.1:8000/wyzwania/${wyzwanie.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const json = await res.json();

            if (json.status === "success") {
                setShowDeleteConfirm(false);
                onClose(); // Zamyka cały popup wyzwania
                if (onRefresh) onRefresh(); // Odświeża kafelki w Home.tsx
            } else {
                alert(json.message || "Błąd usuwania");
            }
        } catch (e) {
            console.error(e);
            alert("Wystąpił błąd podczas usuwania.");
        }
    };

    /**
     * @variable uczestnicyAktywni
     * @description Filtruje listę uczestników, pozostawiając tylko tych, którzy zaakceptowali zaproszenie.
     * Używa operatora Nullish Coalescing (??), aby zapobiec błędom, gdy lista jest pusta.
     */
    const uczestnicyAktywni = useMemo(
        () => (wyzwanie.uczestnicy ?? []).filter(u => u.zaakceptowane),
        [wyzwanie.uczestnicy]
    );

    /**
     * @variable canEdit
     * @description Flaga logiczna określająca uprawnienia do edycji (np. odhaczania zadań).
     * Zwraca true, jeśli użytkownik jest autorem wyzwania lub jego aktywnym uczestnikiem.
     */
    const canEdit = useMemo(() => {
        const isAuthor = Number(wyzwanie.autor_id) === Number(currentUserId);
        const isParticipant = uczestnicyAktywni.some(u => u.id === Number(currentUserId));

        // Zwracamy true, jeśli jest autorem/uczestnikiem
        return isAuthor || isParticipant;
    }, [currentUserId, wyzwanie.autor_id, uczestnicyAktywni]);

    /**
     * @variable isAdmin
     * @description Flaga logiczna sprawdzająca, czy zalogowany użytkownik posiada uprawnienia administratora.
     * Zapamiętuje wynik (memoize) i aktualizuje go tylko przy zmianie roli użytkownika.
     */
    const isAdmin = useMemo(() => {
        return userRole === 'admin';
    }, [userRole]);

    const [progresPodzadania, setProgresPodzadania] = useState<Record<number, boolean>>({});
    const [progresZadania, setProgresZadania] = useState<Record<number, boolean>>({});
    const [wykresData, setWykresData] = useState<Record<number, PunktWykresu[]>>({});
    const [uczestnikColors, setUczestnikColors] = useState<Record<number, string>>({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


    /**
     * @hook useEffect
     * @description Generuje i przypisuje unikalne kolory dla aktywnych uczestników wyzwania.
     * Pomija zalogowanego użytkownika (currentUserId), który zazwyczaj ma stały kolor (np. niebieski).
     * @dependencies [uczestnicyAktywni, currentUserId] - odświeża paletę, gdy zmieni się lista osób.
     */
    useEffect(() => {
        const colors: Record<number, string> = {};
        const otherUsers = uczestnicyAktywni.filter(u => u.id !== currentUserId);
        const generatedColors = generateDistinctColors(otherUsers.length);

        otherUsers.forEach((u, index) => {
            colors[u.id] = generatedColors[index];
        });

        setUczestnikColors(colors);
    }, [uczestnicyAktywni, currentUserId]);

    /**
     * Oblicza procentowy postęp dnia wyzwania (0-100%).
     * Uwzględnia wagi podzadań lub stan głównego zadania, jeśli brak podzadań.
     */
    const getProgressForZadanie = (zd: ZadanieDzienne) => {
        const podzadania = zd.podzadania ?? [];
        if (podzadania.length === 0) return progresZadania[zd.id] ? 100 : 0;
        const sumaWagi = podzadania.reduce((sum, p) => sum + p.waga, 0);
        const sumaWykonane = podzadania.reduce(
            (sum, p) => sum + (progresPodzadania[p.id] ? p.waga : 0),
            0
        );
        return Math.round((sumaWykonane / sumaWagi) * 100);
    };

    /**
     * Synchronizuje stan aplikacji z serwerem FastAPI po otwarciu wyzwania.
     * Pobiera statusy zadań, podzadań oraz buduje ujednoliconą historię postępów do wykresów.
     */
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;

        const fetchProgressAndCharts = async () => {
            const podzadaniaProgress: Record<number, boolean> = {};
            const zadaniaProgress: Record<number, boolean> = {};
            const wykresy: Record<number, PunktWykresu[]> = {};

            const allUsers = uczestnicyAktywni.map(u => u.nazwa_uzytkownika);

            for (const zd of wyzwanie.zadania_dzienne ?? []) {
                // 1. Podzadania
                for (const pz of zd.podzadania ?? []) {
                    try {
                        const res = await fetch(
                            `http://127.0.0.1:8000/wyzwania/progres/podzadania/${pz.id}`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        const json = await res.json();
                        if (json.status === "success") {
                            podzadaniaProgress[pz.id] = json.wykonane;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }

                // 2. Zadania dzienne
                if (!(zd.podzadania?.length)) {
                    try {
                        const res = await fetch(
                            `http://127.0.0.1:8000/wyzwania/progres/dzienne/${zd.id}`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        const json = await res.json();
                        if (json.wykonane !== undefined) {
                            zadaniaProgress[zd.id] = json.wykonane;
                        } else if (json.status === "success") {
                            zadaniaProgress[zd.id] = json.wykonane;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }

                // 3. Wykresy
                try {
                    const res = await fetch(
                        `http://127.0.0.1:8000/wyzwania/progres/dzienne/historia/wszystkie/${zd.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const json = await res.json();

                    if (json.status === "success") {
                        const today = getLocalToday();

                        // Zbieramy daty z API i normalizujemy je
                        const apiDates: string[] = [];
                        json.historia.forEach((u: APIHistoriaUzytkownika) => {
                            u.punkty.forEach((p: APIPunkt) => {
                                apiDates.push(normalizeDate(p.data));
                            });
                        });
                        apiDates.sort();

                        // Normalizujemy daty wyzwania
                        const wyzStart = normalizeDate(wyzwanie.data_start);
                        const wyzEnd = normalizeDate(wyzwanie.data_koniec);

                        // Ustalanie zakresu
                        const startDate = (wyzwanie.czasowe && wyzStart)
                            ? wyzStart
                            : (apiDates.length > 0 ? apiDates[0] : today);

                        let endDate = today;
                        if (wyzwanie.czasowe && wyzEnd) {
                            endDate = (wyzEnd < today) ? wyzEnd : today;
                        }

                        // Generowanie mapy
                        const fullDateRange = generateDateRange(startDate, endDate);
                        const pointsMap: Record<string, PunktWykresu> = {};

                        fullDateRange.forEach(dateStr => {
                            pointsMap[dateStr] = { date: dateStr };
                            allUsers.forEach(user => {
                                pointsMap[dateStr][user] = 0;
                            });
                        });

                        // Wypełnianie danymi z API
                        json.historia.forEach((u: APIHistoriaUzytkownika) => {
                            u.punkty.forEach((p: APIPunkt) => {
                                const apiDate = normalizeDate(p.data);
                                if (pointsMap[apiDate]) {
                                    pointsMap[apiDate][u.nazwa_uzytkownika] = p.procent;
                                }
                            });
                        });

                        wykresy[zd.id] = Object.values(pointsMap);
                    }
                } catch (e) {
                    console.error(e);
                }
            }

            setProgresPodzadania(podzadaniaProgress);
            setProgresZadania(zadaniaProgress);
            setWykresData(wykresy);
        };

        fetchProgressAndCharts().then(() => {
            console.log('Charts updated');
        });
    }, [wyzwanie.zadania_dzienne, wyzwanie.czasowe, wyzwanie.data_start, wyzwanie.data_koniec, uczestnicyAktywni]);

    const refreshChart = async (zadanieId: number) => {
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            const today = getLocalToday();
            const wyzEnd = normalizeDate(wyzwanie.data_koniec);

            if (wyzwanie.czasowe && wyzEnd) {
                if (today > wyzEnd) {
                    alert(`Wyzwanie zakończone ${wyzEnd}.\nNie można zaktualizować wykresu dla daty ${today}.`);
                    return;
                }
            }

            let endDate = today;
            if (wyzwanie.czasowe && wyzEnd) {
                endDate = (wyzEnd < today) ? wyzEnd : today;
            }

            const res = await fetch(
                `http://127.0.0.1:8000/wyzwania/progres/dzienne/historia/wszystkie/${zadanieId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const json = await res.json();

            if (json.status === "success") {
                const allUsers = uczestnicyAktywni.map(u => u.nazwa_uzytkownika);

                const apiDates: string[] = [];
                json.historia.forEach((u: APIHistoriaUzytkownika) => {
                    u.punkty.forEach((p: APIPunkt) => apiDates.push(normalizeDate(p.data)));
                });
                apiDates.sort();

                const lastApiDate = apiDates.length > 0 ? apiDates[apiDates.length - 1] : null;

                const wyzStart = normalizeDate(wyzwanie.data_start);
                const startDate = (wyzwanie.czasowe && wyzStart)
                    ? wyzStart
                    : (apiDates.length > 0 ? apiDates[0] : today);

                if (lastApiDate && lastApiDate > endDate) {
                    alert(`Uwaga: Wykres nie został zaktualizowany.\n\nData wykonania zadania (${lastApiDate}) wykracza poza datę zakończenia wyzwania (${endDate}).`);
                    return;
                }

                const fullDateRange = generateDateRange(startDate, endDate);
                const pointsMap: Record<string, PunktWykresu> = {};

                fullDateRange.forEach(dateStr => {
                    pointsMap[dateStr] = { date: dateStr };
                    allUsers.forEach(user => {
                        pointsMap[dateStr][user] = 0;
                    });
                });

                json.historia.forEach((u: APIHistoriaUzytkownika) => {
                    u.punkty.forEach((p: APIPunkt) => {

                        const apiDate = normalizeDate(p.data);
                        if (pointsMap[apiDate]) {
                            pointsMap[apiDate][u.nazwa_uzytkownika] = p.procent;
                        }
                    });
                });

                setWykresData(prev => ({ ...prev, [zadanieId]: Object.values(pointsMap) }));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const toggleProgresPodzadania = async (podzadanieId: number, current: boolean) => {
        const token = localStorage.getItem("token");
        if (!token) return;
        setProgresPodzadania(prev => ({ ...prev, [podzadanieId]: !current }));

        try {
            const res = await fetch(
                `http://127.0.0.1:8000/wyzwania/progres/podzadania/${podzadanieId}?wykonane=${!current}`,
                { method: "POST", headers: { Authorization: `Bearer ${token}` } }
            );
            const json = await res.json();

            if (json.status === "admin_readonly") {
                // Wyświetlamy alert z wiadomością z backendu ("Jesteś administratorem...")
                alert(json.message);
                setProgresPodzadania(prev => ({ ...prev, [podzadanieId]: json.wykonane }));
                return;
            }
            if (!res.ok) {
                // Jeśli backend zwrócił obiekt błędu z detail
                const errorMsg = typeof json.detail === 'object' ? json.detail.message : json.detail;
                alert(errorMsg || "Nie udało się zapisać postępu.");

                // Cofamy zmianę w UI
                setProgresPodzadania(prev => ({ ...prev, [podzadanieId]: current }));
                return;
            }

            const zadanie = wyzwanie.zadania_dzienne?.find(z => z.podzadania?.some(p => p.id === podzadanieId));
            if (zadanie) await refreshChart(zadanie.id);
        } catch (e) {
            console.error(e);
            alert("Błąd połączenia z serwerem.");
            setProgresPodzadania(prev => ({ ...prev, [podzadanieId]: current }));
        }
    };

    const toggleProgresZadania = async (zadanieId: number, current: boolean) => {
        const token = localStorage.getItem("token");
        if (!token) return;
        setProgresZadania(prev => ({ ...prev, [zadanieId]: !current }));

        try {
            const res = await fetch(
                `http://127.0.0.1:8000/wyzwania/progres/dzienne/${zadanieId}?wykonane=${!current}`,
                { method: "POST", headers: { Authorization: `Bearer ${token}` } }
            );
            const json = await res.json();

            // 2. Obsługa Admina
            if (json.status === "admin_readonly") {
                alert(json.message);
                setProgresZadania(prev => ({ ...prev, [zadanieId]: json.wykonane }));
                return;
            }

            // 3. Obsługa błędów
            if (!res.ok) {
                const errorMsg = typeof json.detail === 'object' ? json.detail.message : json.detail;
                alert(errorMsg || "Nie udało się zapisać postępu.");
                setProgresZadania(prev => ({ ...prev, [zadanieId]: current }));
                return;
            }
            await refreshChart(zadanieId);
        } catch (e) {
            console.error(e);
            alert("Błąd połączenia z serwerem.");
            setProgresZadania(prev => ({ ...prev, [zadanieId]: current }));
        }
    };

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleDateString("pl-PL", {
            year: "numeric",
            month: "long",
            day: "2-digit"
        });
    };

    return (
        <div className="popup-overlay" onClick={onClose}>
            <div className="popup-form" onClick={e => e.stopPropagation()}>
                <h2>{wyzwanie.nazwa}</h2>
                {wyzwanie.opis && <p className="wyzwanie-opis">{wyzwanie.opis}</p>}
                {wyzwanie.czasowe && (
                    <div className="wyzwanie-czasowe-container">
                        <span className="time-badge">⏳ Czasowe</span>
                        <div className="dates-wrapper">
                            <span className="date-chip start" title="Data rozpoczęcia">
                                {formatDate(wyzwanie.data_start)}
                            </span>
                            <span className="date-arrow">➜</span>
                            <span className="date-chip end" title="Data zakończenia">
                                {formatDate(wyzwanie.data_koniec)}
                            </span>
                        </div>
                    </div>
                )}

                <div className="uczestnicy-section">
                    <h3>Uczestnicy:</h3>
                    {wyzwanie.uczestnicy?.length ? (
                        <div className="uczestnicy-list">
                            {wyzwanie.uczestnicy.map(u => (
                                <div key={u.id} className="uczestnik-card">
                                    {u.nazwa_uzytkownika} {u.zaakceptowane ? "✔️" : "⏳"}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>Brak uczestników</p>
                    )}
                </div>

                <div className="zadania-section">
                    <h3>Zadania dzienne:</h3>
                    {wyzwanie.zadania_dzienne?.length ? (
                        <div className="zadania-list">
                            {wyzwanie.zadania_dzienne.map(zd => (
                                <div key={zd.id} className="zadanie-block">
                                    {(zd.podzadania ?? []).length === 0 ? (
                                        <label style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                                            <input
                                                type="checkbox"
                                                checked={progresZadania[zd.id] || false}
                                                disabled={!canEdit}
                                                style={{ cursor: canEdit ? 'pointer' : 'not-allowed' }}
                                                title={!canEdit ? "Tryb podglądu - nie jesteś uczestnikiem" : ""}
                                                onChange={() =>
                                                    toggleProgresZadania(zd.id, progresZadania[zd.id] || false)
                                                }
                                            />
                                            <strong>{zd.nazwa}</strong> {zd.opis && `- ${zd.opis}`}
                                        </label>
                                    ) : (
                                        <div>
                                            <strong style={{ opacity: canEdit ? 1 : 0.6 }}>
                                                {zd.nazwa}
                                            </strong>
                                            <span style={{ opacity: canEdit ? 1 : 0.6 }}>
                                                {zd.opis && `- ${zd.opis}`}
                                            </span>
                                        </div>
                                    )}

                                    <div className="progress-container">
                                        <div className="progress-bar-small">
                                            <div
                                                className="progress-bar-fill"
                                                style={{ width: `${getProgressForZadanie(zd)}%` }}
                                            />
                                        </div>
                                        <span className="progress-text">{getProgressForZadanie(zd)}%</span>
                                    </div>

                                    {(zd.podzadania ?? []).length > 0 && (
                                        <div className="podzadania-list">
                                            {zd.podzadania?.map(pz => (
                                                <div key={pz.id} className="podzadanie-row">
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={progresPodzadania[pz.id] || false}
                                                            disabled={!canEdit}
                                                            style={{ cursor: canEdit ? 'pointer' : 'not-allowed' }}
                                                            title={!canEdit ? "Tryb podglądu - nie jesteś uczestnikiem" : ""}
                                                            onChange={() =>
                                                                toggleProgresPodzadania(pz.id, progresPodzadania[pz.id] || false)
                                                            }
                                                        />
                                                        <span style={{ opacity: canEdit ? 1 : 0.7 }}>
                                                            {pz.nazwa} – {pz.wymagane ? "wymagane" : "opcjonalne"}, waga: {pz.waga}
                                                        </span>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <h4>Wykres postępu: {zd.nazwa}</h4>
                                    {wykresData[zd.id]?.length ? (
                                        <ResponsiveContainer width="100%" height={250}>
                                            <LineChart data={wykresData[zd.id]}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" />
                                                <YAxis domain={[0, 100]} />
                                                <Tooltip />
                                                <Legend />
                                                {uczestnicyAktywni.map(u => (
                                                    <Line
                                                        key={u.id}
                                                        type="monotone"
                                                        dataKey={u.nazwa_uzytkownika}
                                                        stroke={u.id === currentUserId ? "#ff0000" : uczestnikColors[u.id]}
                                                        strokeWidth={u.id === currentUserId ? 3 : 2}
                                                        dot={{ r: 3 }}
                                                    />
                                                ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <p>Brak danych do wykresu</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>Brak zadań dziennych</p>
                    )}
                </div>

                <div className="wyzwanie-actions">

                    <button className="close-btn" onClick={onClose}>
                        Zamknij
                    </button>

                    {isAdmin && (
                        <button className="delete-btn" onClick={() => setShowDeleteConfirm(true)}>
                            🗑️ Usuń wyzwanie
                        </button>
                    )}


                </div>
            </div>
            {showDeleteConfirm && (
                <div className="confirm-overlay">
                    <div className="confirm-box">
                        <h4>Potwierdź usunięcie</h4>
                        <p>Czy na pewno chcesz usunąć wyzwanie <strong>{wyzwanie.nazwa}</strong>?</p>
                        <p className="confirm-warning">Wszyscy uczestnicy stracą swoje postępy!</p>
                        <div className="confirm-actions">
                            <button className="cancel-btn" onClick={() => setShowDeleteConfirm(false)}>Anuluj</button>
                            <button className="confirm-delete-btn" onClick={confirmDeleteWyzwanie}>Tak, usuń</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Wyzwanie;
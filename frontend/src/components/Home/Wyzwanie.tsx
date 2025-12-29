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
}


const parseJwt = (token: string) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
};

// Zamienia "2025-12-20T00:00:00" ORAZ "2025-12-20" na czyste "2025-12-20".
const normalizeDate = (dateStr: string | undefined): string => {
    if (!dateStr) return "";
    return dateStr.split('T')[0];
};

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

// Funkcja generująca daty BEZ przesuwania strefy czasowej
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

const getLocalToday = () => {
    const d = new Date();
    return d.getFullYear() + '-'
        + String(d.getMonth() + 1).padStart(2, '0') + '-'
        + String(d.getDate()).padStart(2, '0');
};

const Wyzwanie: React.FC<Props> = ({ wyzwanie, onClose }) => {
    const currentUserId = useMemo(() => {
        const token = localStorage.getItem("token");

        console.group("🕵️‍♂️ DEBUGOWANIE AUTH");
        console.log("1. Raw Token:", token);

        if (!token) {
            console.warn("❌ Brak tokena w localStorage!");
            console.groupEnd();
            return 0;
        }

        const decoded = parseJwt(token);
        console.log("2. Zdekodowany obiekt (Payload):", decoded);

        // --- TUTAJ JEST NAPRAWA ---
        // Dodaliśmy decoded?.uzytkownik_id na samym początku
        const extractedId = decoded?.uzytkownik_id || decoded?.user_id || decoded?.sub || decoded?.id || 0;

        console.log("3. Wyciągnięte ID:", extractedId); // Teraz tutaj powinno pokazać 1
        console.groupEnd();

        return extractedId;
    }, []);

    const uczestnicyAktywni = useMemo(
        () => (wyzwanie.uczestnicy ?? []).filter(u => u.zaakceptowane),
        [wyzwanie.uczestnicy]
    );

    const canEdit = useMemo(() => {
        const myId = Number(currentUserId);

        // Sprawdzamy czy jestem autorem
        const isAuthor = wyzwanie.autor_id === myId;

        // Sprawdzamy czy jestem na liście uczestników
        const isParticipant = uczestnicyAktywni.some(u => u.id === myId);

        console.log("🔥 UPRAWNIENIA:", { myId, isAuthor, isParticipant });

        return isAuthor || isParticipant;
    }, [currentUserId, wyzwanie.autor_id, uczestnicyAktywni]);


    const [progresPodzadania, setProgresPodzadania] = useState<Record<number, boolean>>({});
    const [progresZadania, setProgresZadania] = useState<Record<number, boolean>>({});
    const [wykresData, setWykresData] = useState<Record<number, any[]>>({});
    const [uczestnikColors, setUczestnikColors] = useState<Record<number, string>>({});

    // Generowanie kolorów
    useEffect(() => {
        const colors: Record<number, string> = {};
        const otherUsers = uczestnicyAktywni.filter(u => u.id !== currentUserId);
        const generatedColors = generateDistinctColors(otherUsers.length);

        otherUsers.forEach((u, index) => {
            colors[u.id] = generatedColors[index];
        });

        setUczestnikColors(colors);
    }, [uczestnicyAktywni, currentUserId]);

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

    const handleDelete = async () => {
        if (!window.confirm("Czy na pewno chcesz usunąć to wyzwanie? Ta operacja jest nieodwracalna.")) {
            return;
        }

        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            // Zwróć uwagę na endpoint - dopasuj URL do swojego API
            const res = await fetch(`http://127.0.0.1:8000/wyzwania/${wyzwanie.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const json = await res.json();

            if (json.status === "success") {
                alert("Wyzwanie zostało usunięte.");
                onClose();
                window.location.reload(); // Odświeżamy stronę, żeby wyzwanie zniknęło z listy
            } else {
                // Tutaj wchodzimy, jeśli user NIE jest adminem (zgodnie z Twoim nowym backendem)
                alert(json.message);
            }
        } catch (e) {
            console.error(e);
            alert("Wystąpił błąd podczas usuwania.");
        }
    };

    // Fetch danych
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;

        const fetchProgressAndCharts = async () => {
            const podzadaniaProgress: Record<number, boolean> = {};
            const zadaniaProgress: Record<number, boolean> = {};
            const wykresy: Record<number, any[]> = {};

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

                // 3. Wykresy (POPRAWIONA LOGIKA)
                try {
                    const res = await fetch(
                        `http://127.0.0.1:8000/wyzwania/progres/dzienne/historia/wszystkie/${zd.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const json = await res.json();

                    if (json.status === "success") {
                        const today = getLocalToday();

                        // Zbieramy daty z API i normalizujemy je
                        let apiDates: string[] = [];
                        json.historia.forEach((u: any) => {
                            u.punkty.forEach((p: any) => {
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

                        // Generowanie mapy (teraz daty będą pasować)
                        const fullDateRange = generateDateRange(startDate, endDate);
                        const pointsMap: Record<string, any> = {};

                        fullDateRange.forEach(dateStr => {
                            pointsMap[dateStr] = { date: dateStr };
                            allUsers.forEach(user => {
                                pointsMap[dateStr][user] = 0;
                            });
                        });

                        // Wypełnianie danymi z API
                        json.historia.forEach((u: any) => {
                            u.punkty.forEach((p: any) => {
                                // TU JEST FIX: normalizujemy datę z API przed szukaniem w mapie
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

                let apiDates: string[] = [];
                json.historia.forEach((u: any) => {
                    u.punkty.forEach((p: any) => apiDates.push(normalizeDate(p.data)));
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
                const pointsMap: Record<string, any> = {};

                fullDateRange.forEach(dateStr => {
                    pointsMap[dateStr] = { date: dateStr };
                    allUsers.forEach(user => {
                        pointsMap[dateStr][user] = 0;
                    });
                });

                json.historia.forEach((u: any) => {
                    u.punkty.forEach((p: any) => {
                        // FIX: Normalizacja daty z API
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

                    <button className="delete-btn" onClick={handleDelete}>
                        🗑️ Usuń wyzwanie
                    </button>


                </div>
            </div>
        </div>
    );
};

export default Wyzwanie;
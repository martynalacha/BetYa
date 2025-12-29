import { useState, type ChangeEvent } from "react";
import "./AddWyzwanie.css";

interface Znajomy {
    id: number;
    nazwa_uzytkownika: string;
    email?: string;
    profilowe_url?: string;
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

interface AddWyzwanieProps {
    znajomi: Znajomy[];
    onClose: () => void;
    onAdd: (data: {
        nazwa: string;
        opis: string;
        czasowe: boolean;
        data_start?: string;
        data_koniec?: string;
        uczestnicy_ids: number[];
        zadania_dzienne: ZadanieDzienne[];
    }) => void;
}

export default function AddWyzwanie({ znajomi, onClose, onAdd }: AddWyzwanieProps) {
    const [nazwa, setNazwa] = useState("");
    const [opis, setOpis] = useState("");
    const [czasowe, setCzasowe] = useState(false);
    const [dataStart, setDataStart] = useState("");
    const [dataKoniec, setDataKoniec] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [wybraniZnajomi, setWybraniZnajomi] = useState<Znajomy[]>([]);
    const [suggestions, setSuggestions] = useState<Znajomy[]>([]);
    const [zadaniaDzienne, setZadaniaDzienne] = useState<ZadanieDzienne[]>([]);

    // --- Znajomi ---
    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (!query.trim()) {
            setSuggestions([]);
            return;
        }
        const filtered = znajomi
            .filter((z) => z.nazwa_uzytkownika.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3); // tylko max 3 wyniki
        setSuggestions(filtered);
    };

    const toggleWybranyZnajomy = (znajomy: Znajomy) => {
        setWybraniZnajomi((prev) =>
            prev.some((z) => z.id === znajomy.id)
                ? prev.filter((z) => z.id !== znajomy.id)
                : [...prev, znajomy]
        );
    };

    // --- Zadania dzienne ---
    const addZadanie = () => {
        setZadaniaDzienne((prev) => [
            ...prev,
            { id: Date.now(), nazwa: "", opis: "", podzadania: [] },
        ]);
    };

    const updateZadanie = (index: number, field: string, value: string) => {
        setZadaniaDzienne((prev) =>
            prev.map((z, i) => (i === index ? { ...z, [field]: value } : z))
        );
    };

    const addPodzadanie = (zadanieIndex: number) => {
        setZadaniaDzienne((prev) =>
            prev.map((z, i) =>
                i === zadanieIndex
                    ? {
                        ...z,
                        podzadania: [
                            ...z.podzadania,
                            { id: Date.now(), nazwa: "", wymagane: true, waga: 1 },
                        ],
                    }
                    : z
            )
        );
    };

    const updatePodzadanie = (
        zadanieIndex: number,
        podIndex: number,
        field: string,
        value: any
    ) => {
        setZadaniaDzienne((prev) =>
            prev.map((z, i) =>
                i === zadanieIndex
                    ? {
                        ...z,
                        podzadania: z.podzadania.map((p, pi) =>
                            pi === podIndex ? { ...p, [field]: value } : p
                        ),
                    }
                    : z
            )
        );
    };

    // --- Submit ---
    const handleSubmit = () => {
        // Konwersja wybranych znajomych na strukturę Uczestnik
        const uczestnicy_ids = wybraniZnajomi.map(z => z.id);

        console.log("DEBUG: nazwa wyzwania:", nazwa);
        console.log("DEBUG: uczestnicy:", uczestnicy_ids);

        onAdd({
            nazwa,
            opis,
            czasowe,
            data_start: (czasowe && dataStart) ? dataStart : undefined,
            data_koniec: (czasowe && dataKoniec) ? dataKoniec : undefined,
            uczestnicy_ids,
            zadania_dzienne: zadaniaDzienne,
        });

        // reset
        setNazwa("");
        setOpis("");
        setCzasowe(false);
        setDataStart("");
        setDataKoniec("");
        setWybraniZnajomi([]);
        setSearchQuery("");
        setSuggestions([]);
        setZadaniaDzienne([]);
        onClose();
    };


    return (
        <div className="popup-overlay">
            <div className="popup-form">
                <h3>Dodaj wyzwanie</h3>

                <div className="row-title">
                    <input
                        type="text"
                        placeholder="Nazwa"
                        value={nazwa}
                        onChange={(e) => setNazwa(e.target.value)}
                    />
                    <textarea
                        placeholder="Opis"
                        value={opis}
                        onChange={(e) => setOpis(e.target.value)}
                    />
                </div>

                <label>
                    <input
                        type="checkbox"
                        checked={czasowe}
                        onChange={() => setCzasowe((p) => !p)}
                    />
                    Czasowe
                </label>

                <div className="row-fields">
                    {czasowe && (
                        <>
                            <input
                                type="date"
                                value={dataStart}
                                onChange={(e) => setDataStart(e.target.value)}
                            />
                            <input
                                type="date"
                                value={dataKoniec}
                                onChange={(e) => setDataKoniec(e.target.value)}
                            />
                        </>
                    )}
                </div>

                <h4>Wybierz znajomych</h4>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleInputChange}
                    placeholder="Szukaj znajomych..."
                />
                <ul className="suggestions-list">
                    {suggestions.map((s) => (
                        <li key={s.id}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={wybraniZnajomi.some((z) => z.id === s.id)}
                                    onChange={() => toggleWybranyZnajomy(s)}
                                />
                                {s.nazwa_uzytkownika}
                            </label>
                        </li>
                    ))}
                </ul>

                <h4>Wybrani</h4>
                <div className="selected-friends">
                    {wybraniZnajomi.map((z) => (
                        <div key={z.id} className="selected-friend">
                            {z.nazwa_uzytkownika}
                        </div>
                    ))}
                </div>

                {/* Zadania dzienne */}
                <h4>Zadania dzienne</h4>
                <button type="button" onClick={addZadanie}>+ Dodaj zadanie</button>
                {zadaniaDzienne.map((zadanie, zi) => (
                    <div key={zadanie.id} className="zadanie-block">
                        <input
                            type="text"
                            placeholder="Nazwa zadania"
                            value={zadanie.nazwa}
                            onChange={(e) => updateZadanie(zi, "nazwa", e.target.value)}
                        />
                        <textarea
                            placeholder="Opis zadania"
                            value={zadanie.opis}
                            onChange={(e) => updateZadanie(zi, "opis", e.target.value)}
                        />

                        <h5>Podzadania</h5>
                        <button type="button" onClick={() => addPodzadanie(zi)}>+ Dodaj podzadanie</button>
                        {zadanie.podzadania.map((p, pi) => (
                            <div key={p.id} className="podzadanie-row">
                                <input
                                    type="text"
                                    placeholder="Nazwa podzadania"
                                    value={p.nazwa}
                                    onChange={(e) => updatePodzadanie(zi, pi, "nazwa", e.target.value)}
                                />
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={p.wymagane}
                                        onChange={(e) => updatePodzadanie(zi, pi, "wymagane", e.target.checked)}
                                    />
                                    Wymagane
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={p.waga}
                                    onChange={(e) => updatePodzadanie(zi, pi, "waga", parseFloat(e.target.value))}
                                    className="styled-number"
                                />
                            </div>
                        ))}
                    </div>
                ))}

                <div className="row-buttons">
                    <button onClick={handleSubmit}>Dodaj wyzwanie</button>
                    <button onClick={onClose}>Anuluj</button>
                </div>
            </div>
        </div>
    );
}

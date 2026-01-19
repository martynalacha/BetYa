import React, { useEffect, useState, useMemo } from 'react';
import './Uzytkownicy.css';

interface Uzytkownik {
    id: number;
    nazwa_uzytkownika: string;
    email: string;
}

interface Props {
    onClose: () => void;
    onUserDeleted?: () => void;
}

const Uzytkownicy: React.FC<Props> = ({ onClose, onUserDeleted }) => {
    const [users, setUsers] = useState<Uzytkownik[]>([]);
    const [userToDelete, setUserToDelete] = useState<Uzytkownik | null>(null);

    const currentUserId = useMemo(() => {
        const token = localStorage.getItem("token");
        if (!token) return null;
        try {
            const payload = JSON.parse(window.atob(token.split('.')[1]));
            return payload.uzytkownik_id;
        } catch {
            return null;
        }
    }, []);

    const fetchUsers = async () => {
        const token = localStorage.getItem("token");
        try {
            const res = await fetch("http://127.0.0.1:8000/znajomi/uzytkownicy", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === "success" && data.uzytkownicy) {
                setUsers(data.uzytkownicy);
            }
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchUsers().catch(console.error);
    }, []);

    /**
     * Realizuje proces usuwania użytkownika: wysyła żądanie DELETE do FastAPI,
     * aktualizuje lokalną listę (UI) oraz powiadamia komponent nadrzędny o zmianach.
     */
    const confirmDelete = async () => {
        if (!userToDelete) return;

        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`http://127.0.0.1:8000/znajomi/uzytkownicy/${userToDelete.id}`, {
                method: 'DELETE',
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();

            if (res.ok && data.status === "success") {
                // 1. Usuwamy go z listy w tym pop-upie
                setUsers(prev => prev.filter(u => u.id !== userToDelete.id));

                // 2. Odświeżamy kafelki wyzwań na stronie Home
                if (onUserDeleted) {
                    onUserDeleted();
                }

                setUserToDelete(null);
            } else {
                alert("Błąd: " + (data.detail || "Nie udało się usunąć"));
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="popup-overlay" onClick={onClose}>
            <div className="popup-form users-admin-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-corner-btn" onClick={onClose}>&times;</button>

                <div className="popup-header-minimal">
                    <h3>Zarządzanie Użytkownikami</h3>
                    <p>Zarządzaj dostępem do platformy</p>
                </div>

                <div className="users-list-scrollable">
                    {users.map((u) => (
                        <div key={u.id} className="admin-user-card">
                            <div className="user-details-box">
                                <div className="user-primary-info">
                                    <span className="user-label">Username</span>
                                    <span className="user-value-name">{u.nazwa_uzytkownika}</span>
                                </div>
                                <div className="user-secondary-info">
                                    <span className="user-label">Email Address</span>
                                    <span className="user-value-email">{u.email}</span>
                                </div>
                            </div>
                            <div className="user-action-zone">
                                {u.id === currentUserId ? (
                                    <span className="self-label-btn">JA</span>
                                ) : (
                                    <button
                                        className="minimal-delete-btn"
                                        onClick={() => setUserToDelete(u)}
                                    >
                                        Usuń
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {userToDelete && (
                    <div className="confirm-overlay">
                        <div className="confirm-box">
                            <h4>Potwierdź usunięcie</h4>
                            <p>Czy na pewno chcesz usunąć użytkownika <strong>{userToDelete.nazwa_uzytkownika}</strong>?</p>
                            <p className="confirm-warning">Wszystkie jego wyzwania znikną z ekranu głównego!</p>
                            <div className="confirm-actions">
                                <button className="cancel-btn" onClick={() => setUserToDelete(null)}>Anuluj</button>
                                <button className="confirm-delete-btn" onClick={confirmDelete}>Tak, usuń</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Uzytkownicy;
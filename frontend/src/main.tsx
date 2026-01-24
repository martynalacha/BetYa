// ===============================
// GŁÓWNY PUNKT STARTOWY APLIKACJI BETYA
// ===============================

// Import biblioteki React — potrzebna do korzystania z JSX (czyli składni <App />)
import React from "react";

// Import ReactDOM — modułu odpowiedzialnego za renderowanie aplikacji do HTML-a
import ReactDOM from "react-dom/client";

// Import komponentu BrowserRouter z React Router — pozwala na obsługę wielu stron (tras)
import { BrowserRouter } from "react-router-dom";

// Import głównego komponentu aplikacji (naszego "rdzenia")
import App from "./App";

// Import globalnych stylów (index.css) — wpływa na całą aplikację
import "./index.css";

// =====================================
// Uruchomienie aplikacji
// =====================================

// Szukamy w pliku index.html elementu o ID "root"
// W tym miejscu React "zamontuje" całą naszą aplikację
ReactDOM.createRoot(document.getElementById("root")!).render(
    // React.StrictMode:
    // - pomaga wykrywać potencjalne błędy w czasie developmentu
    // - nie wpływa na produkcję (jest ignorowany po zbudowaniu projektu)
    <React.StrictMode>
        {/* BrowserRouter:
            - umożliwia nawigację po stronach bez przeładowania (SPA)
            - pozwala używać <Routes> i <Route> w App.tsx */}
        <BrowserRouter>
            {/* Główny komponent aplikacji — wszystko zaczyna się tutaj */}
            <App />
        </BrowserRouter>
    </React.StrictMode>
);

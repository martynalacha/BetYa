import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

import Logowanie from "./components/Logowanie/Logowanie";
import Rejestracja from "./components/Rejestracja/Rejestracja";
import Home from "./components/Home/Home";
import Logo from "./components/Logo/Logo";

import "./App.css";

export default function App() {
    const [isLight, setIsLight] = useState(false);
    const location = useLocation(); // 🔑 pobieramy aktualną ścieżkę

    useEffect(() => {
        document.body.className = isLight ? "light" : "dark";
    }, [isLight]);

    // 🔑 sprawdzamy ścieżkę z React Router
    const showLogo =
        location.pathname === "/" ||
        location.pathname === "/logowanie" ||
        location.pathname === "/rejestracja";

    return (
        <div id="root">
            <label className="theme-toggle">
                <input
                    type="checkbox"
                    checked={isLight}
                    onChange={() => setIsLight(!isLight)}
                />
                {isLight ? "☀️" : "🌙"}
            </label>

            {/* Logo aplikacji */}
            {showLogo && <Logo />}

            <Routes>
                <Route path="/" element={<Logowanie />} />
                <Route path="/logowanie" element={<Logowanie />} /> {/* 🔑 dodaj ścieżkę /logowanie */}
                <Route path="/rejestracja" element={<Rejestracja />} />
                <Route path="/home" element={<Home />} />
            </Routes>

            <footer style={{ marginTop: "40px" }}>
                <Link to="/logowanie">Logowanie</Link> |{" "}
                <Link to="/rejestracja">Rejestracja</Link>
            </footer>
        </div>
    );
}

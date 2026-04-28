import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import MainMenu from './pages/MainMenu';
import GameSetup from './pages/GameSetup';
import GameBoard from './pages/GameBoard';
import Rules from './pages/Rules';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/"        element={<MainMenu />} />
            <Route path="/setup"   element={<GameSetup />} />
            <Route path="/game"    element={<GameBoard />} />
            <Route path="/rules"   element={<Rules />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*"        element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}
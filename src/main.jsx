import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './Landing.jsx';
import Dashboard from './Dashboard.jsx';
import Deck from './Deck.jsx';
import Present from './Present.jsx';
import Audience from './Audience.jsx';
import Login from './Login.jsx';
import { Privacy, Terms } from './Legal.jsx';
import Account, { NotFound } from './Account.jsx';
import { Rehearsals, Timer, Plans } from './Pages.jsx';
import Universities from './Universities.jsx';
import Analyzer from './Analyzer.jsx';
import Library from './Library.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Dashboard />} />
      <Route path="/app/cuenta" element={<Account />} />
      <Route path="/app/ensayos" element={<Rehearsals />} />
      <Route path="/app/analizador" element={<Analyzer />} />
      <Route path="/app/presentaciones" element={<Library />} />
      <Route path="/app/temporizador" element={<Timer />} />
      <Route path="/app/planes" element={<Plans />} />
      <Route path="/login" element={<Login />} />
      <Route path="/universidades" element={<Universities />} />
      <Route path="/privacidad" element={<Privacy />} />
      <Route path="/terminos" element={<Terms />} />
      <Route path="/app/deck/:id" element={<Deck />} />
      <Route path="/present/:id" element={<Present />} />
      <Route path="/audience/:id" element={<Audience />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

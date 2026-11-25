import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './Landing.jsx';
import Dashboard from './Dashboard.jsx';
import Deck from './Deck.jsx';
import Present from './Present.jsx';
import Audience from './Audience.jsx';
import Login from './Login.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Dashboard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/app/deck/:id" element={<Deck />} />
      <Route path="/present/:id" element={<Present />} />
      <Route path="/audience/:id" element={<Audience />} />
    </Routes>
  </BrowserRouter>
);

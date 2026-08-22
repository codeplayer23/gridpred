import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LiveSeasonProvider } from './context/LiveSeason';
import App from './App.jsx';
import { reportAssetValidation } from './utils/validateAssets';
import './index.css';

reportAssetValidation();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LiveSeasonProvider>
        <App />
      </LiveSeasonProvider>
    </BrowserRouter>
  </StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { loadI18n } from './lib/i18n';

// W115: словарь грузится до первого рендера. Иначе, пока идёт fetch i18n/*.json,
// t() отдаёт сам ключ — на экране мелькают сырые строки (`events.loading` и т. п.).
// loadI18n() всегда резолвится (ошибки fetch глушатся), поэтому рендер не блокируется.
void loadI18n().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});

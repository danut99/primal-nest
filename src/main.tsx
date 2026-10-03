import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { Gallery } from './components/Gallery';
import './styles/app.css';
import { applyLowFx, lowFxEnabled } from './utils/settings';

applyLowFx(lowFxEnabled());

// /#galerie arată toate creaturile (doar pentru dezvoltare și artă).
const showGallery = import.meta.env.DEV && window.location.hash === '#galerie';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{showGallery ? <Gallery /> : <App />}</React.StrictMode>,
);

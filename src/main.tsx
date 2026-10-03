import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { Gallery } from './components/Gallery';
// Laboratorul și vizualizatorul de dragoni se încarcă doar când le deschizi.
const DragonsScreen = lazy(() => import('./dragons/DragonsScreen').then((m) => ({ default: m.DragonsScreen })));
const LabScreen = lazy(() => import('./dragon-lab/LabScreen').then((m) => ({ default: m.LabScreen })));
import './styles/fonts.css';
import './styles/app.css';


// /#galerie arată toate creaturile (doar pentru dezvoltare și artă).
const showGallery = import.meta.env.DEV && window.location.hash === '#galerie';
// /#dragoni deschide direct vizualizatorul de dragoni, fără joc.
const showDragons = window.location.hash === '#dragoni';
// /#laborator: editorul de dragoni noi (src/dragon-lab).
const showLab = window.location.hash === '#laborator';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      {showGallery ? (
        <Gallery />
      ) : showLab ? (
        <LabScreen />
      ) : showDragons ? (
        <main className="main dragons-page">
          <DragonsScreen />
        </main>
      ) : (
        <App />
      )}
    </Suspense>
  </React.StrictMode>,
);

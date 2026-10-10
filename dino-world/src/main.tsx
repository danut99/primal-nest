import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { watchErrors } from './app/errors';
import './styles/fonts.css';
import './styles/app.css';
import './styles/world.css';
import './styles/panels.css';
import './styles/tour.css';
import './styles/guide.css';
import './styles/adventure.css';
import './styles/forge.css';

watchErrors();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

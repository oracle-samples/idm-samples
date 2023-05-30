import React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './components/App';
import { RequestState } from './types/idcsTypes';

declare global {
  interface Window { 
    __APP_INITIAL_STATE__: RequestState; 
    __REDWOOD_THEME__: boolean;
  }
}

ReactDOM.hydrateRoot(document.getElementById('root'), <App initialState={window.__APP_INITIAL_STATE__} redwoodTheme={window.__REDWOOD_THEME__} />)
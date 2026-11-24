import { StrictMode, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Scene } from './render/Scene';
import { setOverlayRoot } from './render/overlay';
import { Hud } from './ui/Hud';
import './styles.css';

function App() {
  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => { setOverlayRoot(overlay.current); return () => setOverlayRoot(null); }, []);
  return (
    <>
      <Scene />
      <div className="overlay" ref={overlay} />
      <Hud />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

/**
 * The page the app bundles into its game screen (scripts/build-embed.mjs).
 * `./host` installs the host's receiver on import, before the game mounts and
 * announces itself with `game:ready` — once, so no StrictMode double effects.
 */
import { createRoot } from 'react-dom/client';
import './host';
import './styles.css';
import Game from './Game';

createRoot(document.getElementById('root')!).render(<Game />);

# Browser Arena

A first-person browser shooter prototype built with Three.js and a Node.js / Socket.IO server.

## Features
- First-person mouse-look, WASD movement, sprint and pointer lock
- Three selectable fictional weapons: pulse pistol (1), arena rifle (2), burst scatter (3)
- Weapon-specific fire rates, damage, range, spread, magazines and reload times
- Smarter local training bots that pursue, strafe, retreat toward their patrol area and attack on cooldown
- Online player movement, server-checked line-of-sight-style hit rays, shared health, kills/deaths, respawns and TAB scoreboard
- Responsive HUD and menu

## Run locally
Requires Node.js 18 or newer.
```bash
npm install
npm start
```
Open http://localhost:3000 and choose **Train vs Bots**. Click the game to lock the mouse; press Escape to unlock.

## Online multiplayer
Deploy the Node server to a host that supports persistent WebSocket connections. Enter the deployed server's base URL in the menu and choose **Join Online**. If the frontend is on a separate static host, it loads the Socket.IO browser client from the server URL. Set `CLIENT_ORIGIN` to allowed frontend origin(s) for a tighter CORS policy.

## Controls
- WASD move; mouse aim; left click fire
- R reload; Shift sprint; 1/2/3 select weapon
- TAB toggle online scoreboard; Escape release mouse

## Prototype notes
Server-side hit checks validate shot origin against the server-known player position, apply weapon cooldowns, and own damage, eliminations, deaths and respawns. This remains an early prototype: player movement and aim are still client-reported and should receive stronger server-side simulation, collision checks, anti-cheat controls and load testing before public competitive use. Three.js loads from a CDN, so the game needs internet access for the 3D engine.

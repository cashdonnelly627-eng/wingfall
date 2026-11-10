// WINGFALL multiplayer server: serves the website + real-time online play over WebSockets.
// Run: npm install && npm start   ->  http://localhost:3000
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000, ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.normalize(path.join(ROOT, p));
  if (!f.startsWith(ROOT) || f.endsWith('server.js')) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});

const wss = new WebSocketServer({ server });
const W = 2400, H = 1600, MODES = ['QUICK PLAY', 'GROUND OPS', 'SKY ASSAULT'];
const WALLS = [[500,400,300,60],[1600,400,300,60],[1100,700,200,200],[500,1140,300,60],[1600,1140,300,60],[300,700,60,200],[2040,700,60,200]];
let nextId = 1; const players = new Map(); let bullets = [];
const rooms = { 'QUICK PLAY': new Set(), 'GROUND OPS': new Set(), 'SKY ASSAULT': new Set() };
const clean = s => String(s || '').replace(/[^\w \-]/g, '').trim().slice(0, 16) || 'Recruit';
const send = (ws, m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
const hitWall = (x, y, r) => x < r || y < r || x > W - r || y > H - r || WALLS.some(([wx, wy, ww, wh]) => x + r > wx && x - r < wx + ww && y + r > wy && y - r < wy + wh);
function spawn(p) { do { p.x = 100 + Math.random() * (W - 200); p.y = 100 + Math.random() * (H - 200); } while (hitWall(p.x, p.y, 24)); p.hp = 100; p.dead = 0; }
function lobbyList() { return [...players.values()].map(p => ({ id: p.id, name: p.name, form: p.form, room: p.room, level: p.level })); }
function broadcastLobby() { const list = lobbyList(); for (const p of players.values()) send(p.ws, { t: 'lobby', players: list, online: list.length }); }

wss.on('connection', ws => {
  const p = { id: nextId++, ws, name: 'Recruit', form: 0, room: null, in: {}, x: 0, y: 0, a: 0, hp: 100, kills: 0, deaths: 0, cd: 0, dead: 0, level: 1, loadout: { fp: 60, spd: 50, acc: 55, am: 30 }, last: Date.now(), msgs: 0 };
  players.set(p.id, p); send(ws, { t: 'hello', id: p.id, W, H, walls: WALLS });
  ws.on('message', raw => {
    if (++p.msgs > 120) return; // basic flood guard (per second)
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'join') { p.name = clean(m.name); p.form = [0,1,2].includes(m.form) ? m.form : 0; broadcastLobby(); }
    else if (m.t === 'loadout' && m.l) { const c = (v, a, b) => Math.max(a, Math.min(b, +v || a)); p.loadout = { fp: c(m.l.fp,30,100), spd: c(m.l.spd,20,100), acc: c(m.l.acc,20,100), am: c(m.l.am,10,60) }; }
    else if (m.t === 'play' && MODES.includes(m.mode)) { if (p.room) rooms[p.room].delete(p.id); if (rooms[m.mode].size >= 16) return send(ws, { t: 'full' });
      p.room = m.mode; rooms[p.room].add(p.id); p.kills = p.deaths = 0; p.ammo = p.loadout.am; spawn(p); send(ws, { t: 'start', mode: p.room }); broadcastLobby(); }
    else if (m.t === 'leave') { if (p.room) rooms[p.room].delete(p.id); p.room = null; broadcastLobby(); }
    else if (m.t === 'in') p.in = { u: !!m.u, d: !!m.d, l: !!m.l, r: !!m.r, f: !!m.f, a: +m.a || 0 };
    else if (m.t === 'chat') { const txt = String(m.msg || '').slice(0, 120); for (const q of players.values()) send(q.ws, { t: 'chat', from: p.name, msg: txt }); }
  });
  ws.on('close', () => { if (p.room) rooms[p.room].delete(p.id); players.delete(p.id); broadcastLobby(); });
});
setInterval(() => { for (const p of players.values()) p.msgs = 0; }, 1000);

// Authoritative simulation 30 Hz
setInterval(() => {
  const now = Date.now();
  for (const [mode, ids] of Object.entries(rooms)) {
    for (const id of ids) { const p = players.get(id); if (!p) continue;
      if (p.dead) { if (now > p.dead) { spawn(p); p.ammo = p.loadout.am; } continue; }
      const sp = 3 + p.loadout.spd / 25 + (mode === 'SKY ASSAULT' ? 2 : 0), i = p.in;
      let dx = (i.r - i.l) * sp, dy = (i.d - i.u) * sp; if (dx && dy) { dx *= .707; dy *= .707; }
      if (!hitWall(p.x + dx, p.y, 22)) p.x += dx; if (!hitWall(p.x, p.y + dy, 22)) p.y += dy; p.a = i.a;
      if (p.cd > 0) p.cd--;
      if (p.reload && now > p.reload) { p.ammo = p.loadout.am; p.reload = 0; }
      if (i.f && p.cd <= 0 && !p.reload) { const spread = (100 - p.loadout.acc) / 600, a = p.a + (Math.random() - .5) * spread;
        bullets.push({ x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30, vx: Math.cos(a) * 22, vy: Math.sin(a) * 22, o: id, room: mode, dmg: p.loadout.fp / 4, life: 50 });
        p.cd = 4; if (--p.ammo <= 0) p.reload = now + 1500; }
    }
  }
  bullets = bullets.filter(b => { b.x += b.vx; b.y += b.vy; if (--b.life <= 0 || hitWall(b.x, b.y, 2)) return false;
    for (const id of rooms[b.room]) { const q = players.get(id); if (!q || q.dead || id === b.o) continue;
      if ((q.x - b.x) ** 2 + (q.y - b.y) ** 2 < 24 * 24) { q.hp -= b.dmg;
        if (q.hp <= 0) { q.dead = now + 3000; q.deaths++; const k = players.get(b.o); if (k) { k.kills++; k.level = Math.min(99, k.level + (k.kills % 3 === 0)); }
          for (const rid of rooms[b.room]) send(players.get(rid)?.ws, { t: 'feed', k: k ? k.name : '?', v: q.name }); }
        return false; } }
    return true; });
  for (const [mode, ids] of Object.entries(rooms)) {
    const ps = [...ids].map(id => players.get(id)).filter(Boolean).map(p => ({ id: p.id, n: p.name, f: p.form, x: p.x | 0, y: p.y | 0, a: +p.a.toFixed(2), hp: Math.max(0, p.hp | 0), d: !!p.dead, k: p.kills, de: p.deaths, am: p.ammo, rl: !!p.reload }));
    const bs = bullets.filter(b => b.room === mode).map(b => [b.x | 0, b.y | 0]);
    for (const id of ids) send(players.get(id)?.ws, { t: 's', p: ps, b: bs });
  }
}, 1000 / 30);

server.listen(PORT, () => console.log(`WINGFALL live on http://localhost:${PORT}`));

// WINGFALL online client: callsign login, live player list, chat, matchmaking and the arena.
(() => {
const css = `
#login{position:absolute;inset:0;z-index:30;display:grid;place-items:center;background:rgba(2,6,14,.82);backdrop-filter:blur(6px)}
#login .box{width:460px;padding:34px;text-align:center}
#login h2{font-family:Teko;font-size:56px;letter-spacing:4px}
#login input{width:100%;padding:14px;margin:18px 0;background:#0b1424;border:1px solid var(--gold);color:#fff;font:600 20px Rajdhani;text-align:center}
#login button,.gbtn{padding:12px 40px;border:2px solid var(--gold);background:rgba(245,197,66,.15);color:var(--gold2);font:700 22px Teko;letter-spacing:2px;cursor:pointer}
#roster{position:absolute;left:37px;top:540px;width:306px;max-height:190px;overflow:auto;font-size:14px;padding-bottom:6px}
#roster div.r{padding:4px 16px;display:flex;justify-content:space-between}#roster em{color:var(--blue);font-style:normal;font-size:12px}
#chat{position:absolute;left:620px;bottom:60px;width:430px;font-size:14px;z-index:6}
#chatLog{max-height:110px;overflow:auto;text-shadow:0 1px 3px #000}#chatLog b{color:var(--gold2)}
#chatIn{width:100%;padding:6px 10px;background:rgba(0,0,0,.6);border:1px solid var(--line);color:#fff;font:15px Rajdhani}
#game{background:#05080f}#game canvas{position:absolute;inset:0}
#hud{position:absolute;inset:0;pointer-events:none;font-weight:700}
#hud .hp{position:absolute;left:40px;bottom:40px;width:320px}#hud .hp i{display:block;height:10px;background:linear-gradient(90deg,#3fd07a,#9be86a);transition:width .2s}
#hud .ammo{position:absolute;right:50px;bottom:34px;font:600 54px Teko}
#hud .sb{position:absolute;right:30px;top:30px;width:280px;font-size:14px;padding:10px}
#hud .feed{position:absolute;left:30px;top:30px;font-size:15px}
#hud .dead{position:absolute;inset:0;display:none;place-items:center;font:600 70px Teko;color:#e44;background:rgba(80,0,0,.3)}
#exitG{position:absolute;left:50%;top:24px;transform:translateX(-50%);pointer-events:auto;font-size:16px;padding:6px 18px}`;
document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
const stage = document.getElementById('stage');
stage.insertAdjacentHTML('beforeend', `
<div id="login"><div class="box panel"><h2>WINGFALL</h2><div style="color:#aab">ENTER YOUR CALLSIGN</div>
<input id="cs" maxlength="16" placeholder="SkyRider"><button onclick="WF.join()">ENTER</button><div id="lstat" style="margin-top:14px;color:#aab;font-size:14px">Connecting…</div></div></div>
<section id="game" class="screen"><canvas id="arena"></canvas><div id="hud">
 <div class="feed" id="feed"></div><div class="sb panel" id="sb"></div>
 <div class="hp"><div id="hpT">100 HP</div><div style="background:#222"><i id="hpB" style="width:100%"></i></div></div>
 <div class="ammo" id="ammo">30</div><div class="dead" id="deadS">DOWNED — REDEPLOYING</div>
 <button class="gbtn" id="exitG" onclick="WF.leave()">LEAVE MATCH (Esc)</button></div></section>`);
const lobby = document.getElementById('lobby');
lobby.insertAdjacentHTML('beforeend', `<div id="roster" class="panel"><div class="hd" style="display:flex;justify-content:space-between;padding:8px 16px;font-weight:600"><span>ONLINE PLAYERS</span><span id="onl">0</span></div><div id="rl"></div></div>
<div id="chat"><div id="chatLog"></div><input id="chatIn" placeholder="Press Enter to chat" maxlength="120"></div>`);
document.querySelector('.squad').style.top = '315px';

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
let ws, me = null, myName = localStorage.wfName || '', W = 2400, H = 1600, walls = [], state = { p: [], b: [] }, prev = null, inMatch = false;
const $ = id => document.getElementById(id);
$('cs').value = myName;
function connect() {
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => { $('lstat').textContent = 'Connected to server'; if (myName && $('login').style.display === 'none') send({ t: 'join', name: myName, form: WF.form }); };
  ws.onclose = () => { $('lstat').textContent = 'Disconnected — retrying…'; setTimeout(connect, 2000); };
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.t === 'hello') { me = m.id; W = m.W; H = m.H; walls = m.walls; }
    else if (m.t === 'lobby') { $('onl').textContent = m.online;
      $('rl').innerHTML = m.players.map(p => `<div class="r"><span>${p.id === me ? '★ ' : ''}${esc(p.name)} <span style="color:#889">Lv ${p.level}</span></span><em>${p.room || 'IN LOBBY'}</em></div>`).join(''); }
    else if (m.t === 'start') { inMatch = true; go('game'); }
    else if (m.t === 'full') alert('That mode is full (16/16). Try another.');
    else if (m.t === 's') { prev = state; state = m; state.at = performance.now(); }
    else if (m.t === 'feed') { const d = document.createElement('div'); d.innerHTML = `<b style="color:var(--gold2)">${esc(m.k)}</b> ✦ ${esc(m.v)}`; $('feed').prepend(d); setTimeout(() => d.remove(), 5000); }
    else if (m.t === 'chat') { $('chatLog').insertAdjacentHTML('beforeend', `<div><b>${esc(m.from)}:</b> ${esc(m.msg)}</div>`); $('chatLog').scrollTop = 1e9; } };
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const send = m => ws && ws.readyState === 1 && ws.send(JSON.stringify(m));
window.WF = {
  form: 0,
  join() { myName = $('cs').value.trim() || 'Recruit'; localStorage.wfName = myName; send({ t: 'join', name: myName, form: WF.form }); $('login').style.display = 'none';
    document.querySelectorAll('.prof b, .slot.me b').forEach(b => b.textContent = myName); },
  play(mode) { send({ t: 'loadout', l: window.WF_LOADOUT || {} }); send({ t: 'play', mode }); },
  leave() { send({ t: 'leave' }); inMatch = false; go('lobby'); }
};
$('cs').onkeydown = e => e.key === 'Enter' && WF.join();
$('chatIn').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.value.trim()) { send({ t: 'chat', msg: e.target.value }); e.target.value = ''; } };
document.querySelectorAll('.mode').forEach(m => m.onclick = () => WF.play(m.querySelector('b').textContent.trim()));
window.deploy = () => WF.play('QUICK PLAY');
document.querySelectorAll('.form').forEach((f, i) => f.addEventListener('click', () => { WF.form = i; send({ t: 'join', name: myName, form: i }); }));

// ---- input ----
const keys = {}; let mouse = { x: 836, y: 470, down: false };
addEventListener('keydown', e => { if (inMatch && e.key === 'Escape') { e.stopImmediatePropagation(); WF.leave(); } keys[e.key.toLowerCase()] = 1; }, true);
addEventListener('keyup', e => keys[e.key.toLowerCase()] = 0);
const cv = $('arena'); cv.width = 1672; cv.height = 941; const g = cv.getContext('2d');
cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * 1672 / r.width; mouse.y = (e.clientY - r.top) * 941 / r.height; });
cv.addEventListener('mousedown', () => mouse.down = true); addEventListener('mouseup', () => mouse.down = false);
setInterval(() => { if (!inMatch) return; send({ t: 'in', u: keys.w || keys.arrowup, d: keys.s || keys.arrowdown, l: keys.a || keys.arrowleft, r: keys.d || keys.arrowright, f: mouse.down, a: Math.atan2(mouse.y - 470, mouse.x - 836) }); }, 1000 / 30);

// ---- render ----
const tints = ['#e9eef5', '#5a6cff', '#ffffff'], heads = ['#f5c542', '#222a44', '#dfe7f1'];
const rain = [...Array(220)].map(() => [Math.random() * 1672, Math.random() * 941, 8 + Math.random() * 10]);
function frame() { requestAnimationFrame(frame); if (!inMatch) return;
  const t = Math.min(1, (performance.now() - (state.at || 0)) / 33);
  const lerp = p => { const o = prev && prev.p.find(q => q.id === p.id); return o ? { ...p, x: o.x + (p.x - o.x) * t, y: o.y + (p.y - o.y) * t } : p; };
  const ps = state.p.map(lerp), mine = ps.find(p => p.id === me); if (!mine) return;
  const cx = mine.x - 836, cy = mine.y - 470;
  g.fillStyle = '#070b14'; g.fillRect(0, 0, 1672, 941);
  g.save(); g.translate(-cx, -cy);
  g.strokeStyle = 'rgba(79,179,255,.07)'; for (let x = 0; x <= W; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y <= H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.strokeStyle = '#f5c542'; g.lineWidth = 3; g.strokeRect(0, 0, W, H);
  for (const [x, y, w, h] of walls) { g.fillStyle = '#1a2436'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(79,179,255,.5)'; g.lineWidth = 2; g.strokeRect(x, y, w, h); }
  g.fillStyle = '#ffe680'; for (const [x, y] of state.b) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  for (const p of ps) { if (p.d) continue; g.save(); g.translate(p.x, p.y); g.rotate(p.a);
    g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.ellipse(4, 6, 26, 20, 0, 0, 7); g.fill();
    g.fillStyle = tints[p.f] || '#ddd'; g.beginPath(); g.moveTo(-18, -26); g.lineTo(6, 0); g.lineTo(-18, 26); g.lineTo(-8, 0); g.fill(); // wings
    g.fillStyle = '#2a2f38'; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill();
    g.fillStyle = heads[p.f]; g.beginPath(); g.arc(6, 0, 9, 0, 7); g.fill();
    g.fillStyle = '#111'; g.fillRect(10, 6, 30, 5);
    g.restore();
    g.fillStyle = p.id === me ? '#f5c542' : '#fff'; g.font = '700 14px Rajdhani'; g.textAlign = 'center'; g.fillText(p.n, p.x, p.y - 34);
    g.fillStyle = '#300'; g.fillRect(p.x - 22, p.y - 30, 44, 4); g.fillStyle = '#4fd07a'; g.fillRect(p.x - 22, p.y - 30, 44 * p.hp / 100, 4); }
  g.restore();
  g.strokeStyle = 'rgba(190,215,255,.25)'; for (const r of rain) { g.beginPath(); g.moveTo(r[0], r[1]); g.lineTo(r[0] - 2, r[1] + r[2]); g.stroke(); r[1] += r[2] * 1.6; if (r[1] > 941) { r[1] = -20; r[0] = Math.random() * 1672; } }
  g.strokeStyle = '#f5c542'; g.lineWidth = 2; g.beginPath(); g.arc(mouse.x, mouse.y, 10, 0, 7); g.stroke();
  $('hpB').style.width = mine.hp + '%'; $('hpT').textContent = mine.hp + ' HP'; $('ammo').textContent = mine.rl ? 'RELOADING' : mine.am;
  $('deadS').style.display = mine.d ? 'grid' : 'none';
  $('sb').innerHTML = '<div style="color:var(--gold2);margin-bottom:6px">SCOREBOARD</div>' + [...state.p].sort((a, b) => b.k - a.k).map(p => `<div style="display:flex;justify-content:space-between"><span>${esc(p.n)}</span><span>${p.k} / ${p.de}</span></div>`).join('');
}
frame(); connect();
})();

// Desktop/Steam shell: loads your live WINGFALL website so desktop and web players share the same servers.
const { app, BrowserWindow } = require('electron');
const GAME_URL = process.env.WINGFALL_URL || 'https://YOUR-WINGFALL-SITE.onrender.com'; // put your live site address here
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1672, height: 941, fullscreen: true, backgroundColor: '#000', autoHideMenuBar: true });
  win.loadURL(GAME_URL);
});
app.on('window-all-closed', () => app.quit());

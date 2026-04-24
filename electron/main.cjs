const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const isViteDev = process.env.ELECTRON_DEV === '1'

function distIndexPath() {
  return path.join(__dirname, '..', 'dist', 'index.html')
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 560,
    title: 'todox',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isViteDev) {
    void win.loadURL('http://127.0.0.1:5173')
    win.webContents.openDevTools({ mode: 'detach' })
    return
  }

  const indexHtml = distIndexPath()
  if (!fs.existsSync(indexHtml)) {
    void win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html>
<html><head><meta charset="utf-8"><title>todox</title></head><body style="font-family:system-ui;padding:24px;">
<h1>빌드가 필요합니다</h1>
<p>먼저 프로젝트 루트에서 <code>npm run build</code>를 실행한 뒤 다시 실행해 주세요.</p>
</body></html>`))
    return
  }

  void win.loadFile(indexHtml)
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

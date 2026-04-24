const { contextBridge } = require('electron')

// 필요 시 여기서 안전한 API만 노출
contextBridge.exposeInMainWorld('todoxElectron', {
  platform: process.platform,
})

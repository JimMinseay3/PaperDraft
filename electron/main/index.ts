import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { release } from 'os'
import { join } from 'path'
import { PaperFileHandler } from './fileHandler'
import { TypstRenderer } from './typstRenderer'
import fs from 'fs'

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

let win: BrowserWindow | null = null
// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'PaperDraft',
    icon: join(process.env.PUBLIC || '', 'favicon.ico'),
    width: 1200,
    height: 800,
    frame: false, // Custom window bar
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // Consider using contextBridge.exposeInMainWorld
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) { // electron-vite-vue#298
    win.loadURL(url as string)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Register global shortcuts for DevTools
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      win?.webContents.toggleDevTools()
      event.preventDefault()
    }
  })

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Window state events
  win.on('maximize', () => win?.webContents.send('window-maximized', true))
  win.on('unmaximize', () => win?.webContents.send('window-maximized', false))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

// PaperDraft IPC Handlers
ipcMain.handle('load-paper', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Paper Files', extensions: ['paper'] }]
  })
  if (canceled || filePaths.length === 0) return null
  
  try {
    const { data, assets, filePath } = await PaperFileHandler.loadPaper(filePaths[0])
    
    // Convert assets to base64 for frontend
    const assetsBase64: Record<string, string> = {}
    for (const [name, buffer] of Object.entries(assets)) {
        // Simple MIME type detection based on extension
        const ext = name.split('.').pop()?.toLowerCase()
        const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream'
        assetsBase64[name] = `data:${mime};base64,${buffer.toString('base64')}`
    }
    
    return { data, assets: assetsBase64, filePath }
  } catch (e: any) {
    console.error('Load failed:', e)
    throw e
  }
})

ipcMain.handle('save-paper', async (_, { filePath, data, assets }) => {
  let targetPath = filePath
  if (!targetPath) {
    const { canceled, filePath: savePath } = await dialog.showSaveDialog({
      filters: [{ name: 'Paper Files', extensions: ['paper'] }]
    })
    if (canceled || !savePath) return null
    targetPath = savePath
  }
  
  // Convert base64 assets back to buffers
  const assetBuffers: Record<string, Buffer> = {}
  if (assets) {
      for (const [name, content] of Object.entries(assets)) {
          if (typeof content === 'string' && content.startsWith('data:')) {
              const base64Data = content.split(',')[1]
              assetBuffers[name] = Buffer.from(base64Data, 'base64')
          }
      }
  }

  return await PaperFileHandler.savePaper(targetPath, data, assetBuffers)
})

ipcMain.handle('render-preview', async (_, { data, assets }) => {
  try {
    const renderer = new TypstRenderer()
    const typstContent = TypstRenderer.convertToTypst(data)
    
    const tempDir = app.getPath('temp')
    const outputPath = join(tempDir, `preview-${Date.now()}.pdf`)
    
    // Convert base64 assets back to buffers
    const assetBuffers: Record<string, Buffer> = {}
    if (assets) {
        for (const [name, content] of Object.entries(assets)) {
            if (typeof content === 'string' && content.startsWith('data:')) {
                const base64Data = content.split(',')[1]
                assetBuffers[name] = Buffer.from(base64Data, 'base64')
            }
        }
    }

    const pdfPath = await renderer.renderPDF(typstContent, outputPath, assetBuffers)
    const pdfBuffer = await fs.promises.readFile(pdfPath)
    return `data:application/pdf;base64,${pdfBuffer.toString('base64')}`
  } catch (e: any) {
    console.error("Render failed:", e)
    throw new Error(e.message || "Render failed")
  }
})

// Window Control Handlers
ipcMain.handle('window-minimize', () => {
  win?.minimize()
})

ipcMain.handle('window-maximize', () => {
  if (win?.isMaximized()) {
    win.unmaximize()
    return false
  } else {
    win?.maximize()
    return true
  }
})

ipcMain.handle('window-close', () => {
  win?.close()
})

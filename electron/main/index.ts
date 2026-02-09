import { app, BrowserWindow, shell, ipcMain, dialog, protocol, net } from 'electron'
import { release } from 'os'
import { join } from 'path'
import { pathToFileURL, fileURLToPath } from 'url'
import { PaperFileHandler } from './fileHandler'
import { TypstRenderer } from './typstRenderer'
import fs from 'fs'
import mammoth from 'mammoth'
import AdmZip from 'adm-zip'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import { generateDocx } from './docxGenerator'
import type { PaperData } from '../../src/types/paper'

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

// Register custom protocol as privileged
protocol.registerSchemesAsPrivileged([
  { 
    scheme: 'paper-preview', 
    privileges: { 
      standard: true, 
      secure: true, 
      supportFetchAPI: true, 
      corsEnabled: true,
      bypassCSP: true
    } 
  }
])

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
      plugins: true // Enable PDF viewer
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

app.whenReady().then(() => {
  // Register custom protocol for secure preview
  protocol.handle('paper-preview', async (request) => {
    try {
        const urlObj = new URL(request.url);
        const filePath = urlObj.searchParams.get('path');
        
        console.log('Preview request:', request.url, '->', filePath);

        if (!filePath) {
            return new Response('Path not provided', { status: 400 });
        }

        // Security check: only allow reading from temp directory or specific allowed paths
        // For now, we just check extension and existence
        if (filePath.toLowerCase().endsWith('.pdf')) {
            const data = await fs.promises.readFile(filePath);
            return new Response(data, {
                headers: { 'Content-Type': 'application/pdf' }
            });
        }
        
        return new Response('Invalid file type', { status: 403 });
    } catch (e: any) {
        console.error('Failed to load preview resource:', request.url, e)
        return new Response('Not Found: ' + e.message, { status: 404 })
    }
  })

  createWindow()
})

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

// Helper function to extract comments from docx
const extractComments = async (fileData: Buffer) => {
  console.log('Extracting comments from buffer')
  try {
    const zip = new AdmZip(fileData)
    const commentsEntry = zip.getEntry('word/comments.xml')
    if (!commentsEntry) {
      console.log('No comments.xml found in docx')
      return []
    }

    const xmlData = commentsEntry.getData().toString('utf8')
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    })
    const result = parser.parse(xmlData)
    
    // Check if comments exist and navigate structure
    // Structure is usually <w:comments><w:comment ...>...</w:comment></w:comments>
    let comments = result['w:comments']?.['w:comment']
    
    if (!comments) return []
    if (!Array.isArray(comments)) comments = [comments]

    console.log(`Found ${comments.length} comments`)
    return comments.map((c: any) => {
      // Extract text from paragraphs within comment
      // Comment structure often has w:p -> w:r -> w:t
      let text = ''
      const paragraphs = c['w:p'] ? (Array.isArray(c['w:p']) ? c['w:p'] : [c['w:p']]) : []
      
      paragraphs.forEach((p: any) => {
        const runs = p['w:r'] ? (Array.isArray(p['w:r']) ? p['w:r'] : [p['w:r']]) : []
        runs.forEach((r: any) => {
          if (r['w:t']) {
            text += (typeof r['w:t'] === 'object' ? r['w:t']['#text'] : r['w:t']) + ' '
          }
        })
        text += '\n'
      })

      return {
        id: c['@_w:id'],
        author: c['@_w:author'],
        date: c['@_w:date'],
        content: text.trim()
      }
    })
  } catch (e) {
    console.error('Failed to extract comments:', e)
    return []
  }
}

// Helper to preprocess Word XML for custom markers (Comments, Alignment, Color)
const preprocessDocx = (buffer: Buffer): Buffer => {
  try {
    const zip = new AdmZip(buffer)
    const docEntry = zip.getEntry('word/document.xml')
    if (!docEntry) return buffer

    const xml = docEntry.getData().toString('utf8')
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      preserveOrder: true
    })
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      preserveOrder: true,
      format: false,
      suppressEmptyNode: true
    })

    const docObj = parser.parse(xml)

    const processNodeList = (nodes: any[]) => {
      if (!Array.isArray(nodes)) return
      nodes.forEach(node => {
        const key = Object.keys(node)[0]
        if (key === ':@') return // Skip attributes group

        const value = node[key]
        
        if (key === 'w:p') {
          handleParagraph(value)
        } else if (Array.isArray(value)) {
          processNodeList(value)
        }
      })
    }

    const handleParagraph = (children: any[]) => {
      let align = ''

      // 1. Find Alignment
      const pPrNode = children.find(c => c['w:pPr'])
      if (pPrNode) {
        const pPrChildren = pPrNode['w:pPr']
        const jcNode = pPrChildren.find((c: any) => c['w:jc'])
        if (jcNode && jcNode[':@']) {
          align = jcNode[':@']['@_w:val']
        }
      }

      // 2. Process Runs and Comments
      let firstRunFound = false
      children.forEach((child, index) => {
        if (child['w:r']) {
          handleRun(child['w:r'], align && !firstRunFound ? align : null)
          if (align) firstRunFound = true
        }
        
        // Handle Comments: Replace <w:commentReference> with <w:r><w:t>__CR_ID__</w:t></w:r>
        if (child['w:commentReference']) {
          const attrs = child['w:commentReference'].find((x: any) => x[':@']) || child
          const id = attrs[':@']?.['@_w:id']
          
          if (id) {
            // Transform this node into a run node
            delete child['w:commentReference']
            delete child[':@']
            child['w:r'] = [
              { 'w:t': [{ '#text': `__CR_${id}__` }] }
            ]
          }
        }
      })
    }

    const handleRun = (children: any[], alignToInject: string | null) => {
      let color = ''
      
      // Find Color
      const rPrNode = children.find(c => c['w:rPr'])
      if (rPrNode) {
        const rPrChildren = rPrNode['w:rPr']
        const colorNode = rPrChildren.find((c: any) => c['w:color'])
        if (colorNode && colorNode[':@']) {
          color = colorNode[':@']['@_w:val']
        }
      }

      // Find Text Node and Inject
      const tNode = children.find(c => c['w:t'])
      if (tNode) {
        // w:t content is in #text usually
        let textObj = tNode['w:t'].find((x: any) => x['#text'] !== undefined)
        if (!textObj && tNode['w:t'].length > 0) {
           // Maybe it's just text?
           // In preserveOrder, content is array of objects.
           // text content is { "#text": "..." }
           textObj = tNode['w:t'][0]
        }
        
        if (textObj) {
            let text = textObj['#text'] || ''
            
            // Inject Color
            if (color && color !== 'auto') {
              text = `__COLOR_START_${color}__${text}__COLOR_END__`
            }

            // Inject Align
            if (alignToInject) {
              text = `__ALIGN_${alignToInject.toUpperCase()}__${text}`
            }

            textObj['#text'] = text
        }
      }
    }

    processNodeList(docObj)

    const newXml = builder.build(docObj)
    zip.updateFile('word/document.xml', Buffer.from(newXml, 'utf8'))
    return zip.toBuffer()
  } catch (e) {
    console.error('Preprocess XML failed:', e)
    return buffer
  }
}

ipcMain.handle('import-word', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Word Documents', extensions: ['docx'] }]
  })
  if (canceled || filePaths.length === 0) return null
  
  try {
    const buffer = await fs.promises.readFile(filePaths[0])
    
    // Preprocess Docx (Alignment, Color, Comments)
    const modifiedBuffer = preprocessDocx(buffer)
    
    // Convert modified buffer
    const result = await mammoth.convertToHtml({ buffer: modifiedBuffer })
    const comments = await extractComments(buffer)
    
    return { 
      html: result.value,
      comments
    }
  } catch (e: any) {
    console.error('Import failed:', e)
    throw e
  }
})

ipcMain.handle('create-new-paper', async () => {
  try {
    // 1. Determine directory (Project Root/papers)
    const papersDir = join(process.cwd(), 'papers')
    
    // 2. Ensure directory exists
    if (!fs.existsSync(papersDir)) {
      fs.mkdirSync(papersDir, { recursive: true })
    }
    
    // 3. Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `Paper_${timestamp}.paper`
    const filePath = join(papersDir, fileName)
    
    // 4. Initial Data
    const initialData: PaperData = {
      version: "1.0.0",
      paper_info: { title: "Untitled", author: "Author", school: "School" },
      body: [
        { id: '1', type: 'heading', attrs: { level: 1 }, content: 'Introduction' },
        { id: '2', type: 'paragraph', content: 'Start typing here...' }
      ],
      references: []
    }
    
    // 5. Save initial file (this triggers VersionManager initialization in savePaper)
    await PaperFileHandler.savePaper(filePath, initialData, {})
    
    return { 
      success: true, 
      filePath, 
      data: initialData,
      assets: {} 
    }
  } catch (e: any) {
    console.error('Create new paper failed:', e)
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

ipcMain.handle('export-docx', async (_, { data, assets, styles }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    filters: [{ name: 'Word Document', extensions: ['docx'] }]
  })
  
  if (canceled || !filePath) return false

  try {
    const buffer = await generateDocx(data, assets, styles)
    await fs.promises.writeFile(filePath, buffer)
    return true
  } catch (e: any) {
    console.error('Export failed:', e)
    throw e
  }
})

// Version Control Handlers
ipcMain.handle('get-snapshots', async (_, { filePath }) => {
  if (!filePath) return []
  return await PaperFileHandler.getSnapshots(filePath)
})

ipcMain.handle('get-version-graph', async (_, { filePath }) => {
  if (!filePath) return null
  return await PaperFileHandler.getVersionGraph(filePath)
})

ipcMain.handle('create-branch', async (_, { filePath, name, fromNodeId }) => {
  if (!filePath) throw new Error('File not saved yet')
  return await PaperFileHandler.createBranch(filePath, name, fromNodeId)
})

ipcMain.handle('switch-branch', async (_, { filePath, branchId }) => {
  if (!filePath) throw new Error('File not saved yet')
  return await PaperFileHandler.switchBranch(filePath, branchId)
})

ipcMain.handle('create-snapshot', async (_, { filePath, data, note, type }) => {
  if (!filePath) throw new Error('File not saved yet')
  return await PaperFileHandler.createSnapshot(filePath, data, note, type)
})

ipcMain.handle('save-autosave', async (_, { filePath, data }) => {
  if (!filePath) return null
  return await PaperFileHandler.saveAutosave(filePath, data)
})

ipcMain.handle('delete-snapshot', async (_, { filePath, snapshotId }) => {
  if (!filePath) throw new Error('File not saved yet')
  return await PaperFileHandler.deleteSnapshot(filePath, snapshotId)
})

ipcMain.handle('load-snapshot', async (_, { filePath, snapshotId }) => {
  if (!filePath) throw new Error('File path required')
  return await PaperFileHandler.loadSnapshot(filePath, snapshotId)
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

let previewWin: BrowserWindow | null = null

ipcMain.handle('open-preview-window', async (_, { data, assets }) => {
  try {
    // 0. Pre-process data to ensure images have filenames and assets are populated
    // This handles the case where new images are pasted but not yet fully "asset-ized" or 
    // where src is Base64 but fileName is missing.
    data.body.forEach((block: any) => {
        if (block.type === 'image' && block.attrs?.src?.startsWith('data:')) {
            // If it has a fileName, ensure it's in assets map
            let fileName = block.attrs.fileName
            if (!fileName) {
                // Generate a temp filename if missing
                const ext = block.attrs.src.split(';')[0].split('/')[1] || 'png'
                fileName = `temp_img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`
                block.attrs.fileName = fileName
            }
            
            // Add to assets map if not present
            if (!assets) assets = {}
            if (!assets[fileName]) {
                assets[fileName] = block.attrs.src
            }
        }
    })

    // 0.5 Generate references.bib if references exist
    if (data.references && data.references.length > 0) {
        if (!assets) assets = {}
        
        let bibContent = ''
        data.references.forEach((ref: any) => {
            if (ref.bibtex) {
                bibContent += ref.bibtex + '\n\n'
            } else {
                // Fallback generation if bibtex field missing
                // Ensure ID matches what is used in citations
                bibContent += `@misc{${ref.id}, title={${ref.title}}, author={${ref.author}}, year={${ref.year}}}\n\n`
            }
        })
        
        // Encode as Base64 for asset handling
        assets['references.bib'] = `data:text/plain;base64,${Buffer.from(bibContent, 'utf8').toString('base64')}`
    }

    // 1. Generate PDF (Reuse render logic)
    const renderer = new TypstRenderer()
    const typstContent = TypstRenderer.convertToTypst(data)
    
    const tempDir = app.getPath('temp')
    const outputPath = join(tempDir, `preview-${Date.now()}.pdf`)
    
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
    
    // 2. Open or Focus Preview Window
    if (previewWin && !previewWin.isDestroyed()) {
      previewWin.focus()
    } else {
      previewWin = new BrowserWindow({
        title: 'PaperDraft - Preview',
        icon: join(process.env.PUBLIC || '', 'favicon.ico'),
        width: 800,
        height: 1000,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      })
      
      previewWin.on('closed', () => {
        previewWin = null
      })
    }
    
    // 3. Load PDF
    // Using file:// protocol to load the PDF directly
    await previewWin.loadURL(`file://${pdfPath}`)
    
    return true
  } catch (e: any) {
    console.error("Open preview failed:", e)
    throw new Error(e.message || "Open preview failed")
  }
})

// Generate PDF for embedded preview
ipcMain.handle('generate-preview-pdf', async (_, { data, assets }) => {
  try {
    // 0. Pre-process data
    data.body.forEach((block: any) => {
        if (block.type === 'image' && block.attrs?.src?.startsWith('data:')) {
            let fileName = block.attrs.fileName
            if (!fileName) {
                const ext = block.attrs.src.split(';')[0].split('/')[1] || 'png'
                fileName = `temp_img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`
                block.attrs.fileName = fileName
            }
            if (!assets) assets = {}
            if (!assets[fileName]) {
                assets[fileName] = block.attrs.src
            }
        }
    })

    // 0.5 Generate references.bib
    if (data.references && data.references.length > 0) {
        if (!assets) assets = {}
        let bibContent = ''
        data.references.forEach((ref: any) => {
            if (ref.bibtex) {
                bibContent += ref.bibtex + '\n\n'
            } else {
                bibContent += `@misc{${ref.id}, title={${ref.title}}, author={${ref.author}}, year={${ref.year}}}\n\n`
            }
        })
        assets['references.bib'] = `data:text/plain;base64,${Buffer.from(bibContent, 'utf8').toString('base64')}`
    }

    // 1. Generate PDF
    const renderer = new TypstRenderer()
    const typstContent = TypstRenderer.convertToTypst(data)
    
    const tempDir = app.getPath('temp')
    const outputPath = join(tempDir, `preview-${Date.now()}.pdf`)
    
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
    
    // Return the file path (as custom URL for iframe)
    // Use query parameter to pass path safely
    return `paper-preview://view?path=${encodeURIComponent(pdfPath)}`
  } catch (e: any) {
    console.error("Generate preview failed:", e)
    throw new Error(e.message || "Generate preview failed")
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

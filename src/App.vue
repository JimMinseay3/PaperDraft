<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { ipcRenderer } from 'electron'
import TitleBar from './components/TitleBar.vue'
import ActivityBar from './components/ActivityBar.vue'
import Sidebar from './components/Sidebar.vue'
import SearchSidebar from './components/SearchSidebar.vue'
import VersionSidebar from './components/VersionSidebar.vue'
import ResourceSidebar from './components/ResourceSidebar.vue'
import CitationSidebar from './components/CitationSidebar.vue'
import SettingsSidebar from './components/SettingsSidebar.vue'
import TypographySidebar from './components/TypographySidebar.vue'
import Editor from './components/Editor.vue'
import CommentList from './components/CommentList.vue'
import Preview from './components/Preview.vue'
import type { PaperData, Reference } from './types/paper'

// Initial State
const paperData = ref<PaperData>({
  version: "1.0.0",
  paper_info: { title: "Untitled", author: "Author", school: "School" },
  body: [
    { id: '1', type: 'heading', attrs: { level: 1 }, content: 'Introduction' },
    { id: '2', type: 'paragraph', content: 'Start typing here...' }
  ],
  references: []
})

const assets = ref<Record<string, string>>({}) // Base64 assets
const currentFilePath = ref<string>('')
const pdfUrl = ref<string | null>(null)
const previewPdfUrl = ref<string | null>(null)
const isRendering = ref(false)
const editorRef = ref<any>(null)
const activeView = ref('file')
const showAssistant = ref(false)
const isMathReferenceActive = ref(false)
const documentComments = ref<any[]>([])
const showWelcome = ref(true)

// Global Styles State
const globalStyles = ref({
  h1: { size: '2.25em', color: '#111827', weight: '700', marginTop: '1em', marginBottom: '0.5em' },
  h2: { size: '1.5em', color: '#374151', weight: '600', marginTop: '1em', marginBottom: '0.5em' },
  h3: { size: '1.25em', color: '#4B5563', weight: '600', marginTop: '1em', marginBottom: '0.5em' },
  h4: { size: '1.1em', color: '#4B5563', weight: '600', marginTop: '1em', marginBottom: '0.5em' },
  body: { size: '1em', lineHeight: '1.6', color: '#374151', indent: '2em', marginTop: '0em', marginBottom: '1em' },
  fonts: { en: 'Times New Roman', zh: 'SimSun' }
})

const dynamicStyles = computed(() => `
  .ProseMirror h1 {
    font-size: ${globalStyles.value.h1.size} !important;
    color: ${globalStyles.value.h1.color} !important;
    font-weight: ${globalStyles.value.h1.weight} !important;
    margin-top: ${globalStyles.value.h1.marginTop} !important;
    margin-bottom: ${globalStyles.value.h1.marginBottom} !important;
  }
  .ProseMirror h2 {
    font-size: ${globalStyles.value.h2.size} !important;
    color: ${globalStyles.value.h2.color} !important;
    font-weight: ${globalStyles.value.h2.weight} !important;
    margin-top: ${globalStyles.value.h2.marginTop} !important;
    margin-bottom: ${globalStyles.value.h2.marginBottom} !important;
  }
  .ProseMirror h3 {
    font-size: ${globalStyles.value.h3.size} !important;
    color: ${globalStyles.value.h3.color} !important;
    font-weight: ${globalStyles.value.h3.weight} !important;
    margin-top: ${globalStyles.value.h3.marginTop} !important;
    margin-bottom: ${globalStyles.value.h3.marginBottom} !important;
  }
  .ProseMirror h4 {
    font-size: ${globalStyles.value.h4.size} !important;
    color: ${globalStyles.value.h4.color} !important;
    font-weight: ${globalStyles.value.h4.weight} !important;
    margin-top: ${globalStyles.value.h4.marginTop} !important;
    margin-bottom: ${globalStyles.value.h4.marginBottom} !important;
  }
  .ProseMirror p {
    font-size: ${globalStyles.value.body.size} !important;
    line-height: ${globalStyles.value.body.lineHeight} !important;
    color: ${globalStyles.value.body.color} !important;
    text-indent: ${globalStyles.value.body.indent} !important;
    margin-top: ${globalStyles.value.body.marginTop} !important;
    margin-bottom: ${globalStyles.value.body.marginBottom} !important;
  }
  .ProseMirror li {
    font-size: ${globalStyles.value.body.size} !important;
    line-height: ${globalStyles.value.body.lineHeight} !important;
    color: ${globalStyles.value.body.color} !important;
    margin-bottom: ${globalStyles.value.body.marginBottom} !important;
  }
  .ProseMirror {
    font-family: "${globalStyles.value.fonts.en}", "${globalStyles.value.fonts.zh}", sans-serif !important;
    position: relative !important;
    padding-right: 50px !important;
  }
`)

// Handle Math Reference Events
onMounted(() => {
  window.addEventListener('math-reference-opened', () => {
    showAssistant.value = true
    isMathReferenceActive.value = true
  })
  window.addEventListener('math-reference-closed', () => {
    isMathReferenceActive.value = false
  })
  
  // Notify Electron that the app is ready to show
  nextTick(() => {
    console.log('[App] UI Mounted, removing splash screen...')
    window.postMessage({ payload: 'removeLoading' }, '*')
  })
})

const toggleAssistant = () => {
  showAssistant.value = !showAssistant.value
}

// Actions
const openPreviewWindow = async () => {
  if (isRendering.value) return
  isRendering.value = true
  
  // Switch to preview view immediately to show loading state
  activeView.value = 'preview'
  showAssistant.value = true
  
  try {
    const dataClone = JSON.parse(JSON.stringify(paperData.value))
    const assetsClone = JSON.parse(JSON.stringify(assets.value))
    
    // Use new generate-preview-pdf handler
    const result = await ipcRenderer.invoke('generate-preview-pdf', {
      data: dataClone,
      assets: assetsClone
    })
    
    previewPdfUrl.value = result
  } catch (e: any) {
    console.error('Preview generation failed:', e)
    alert('Failed to generate preview: ' + e.message)
  }
  
  isRendering.value = false
}

const changeView = (view: string) => {
  activeView.value = view
  // If switching to a tool view (not file), open the assistant sidebar
  if (['search', 'version', 'resources', 'citations', 'settings', 'typography', 'preview'].includes(view)) {
    showAssistant.value = true
  }
}

const createNewPaper = async () => {
  try {
    const result = await ipcRenderer.invoke('create-new-paper')
    if (result && result.success) {
      paperData.value = result.data
      assets.value = result.assets
      currentFilePath.value = result.filePath
      showWelcome.value = false
    }
  } catch (e: any) {
    alert('Failed to create new paper: ' + e.message)
  }
}

const loadProject = async () => {
  try {
    const result = await ipcRenderer.invoke('load-paper')
    if (result) {
      paperData.value = result.data
      assets.value = result.assets
      currentFilePath.value = result.filePath
      showWelcome.value = false
    }
  } catch (e: any) {
    alert('Failed to load: ' + e.message)
  }
}

const importWord = async () => {
  try {
    const result = await ipcRenderer.invoke('import-word')
    if (result && result.html && editorRef.value?.editor) {
      // Process HTML to replace text markers with extension tags
      let html = result.html
      
      // 1. Alignment: Move __ALIGN_X__ from content to paragraph style
      // Handles <p>__ALIGN_CENTER__...</p>
      html = html.replace(/<p(.*?)>\s*__ALIGN_([A-Z]+)__/g, (match, attrs, align) => {
        return `<p${attrs} style="text-align: ${align.toLowerCase()}">`
      })

      // 2. Color: Replace __COLOR_START_X__...__COLOR_END__ with span
      html = html.replace(/__COLOR_START_([0-9A-Fa-f]+)__(.*?)__COLOR_END__/g, '<span style="color: #$1">$2</span>')

      // 3. Comments
      html = html.replace(/__CR_(\d+)__/g, '<comment-mark id="$1"></comment-mark>')

      // Use TipTap to parse HTML and insert it
      editorRef.value.editor.commands.setContent(html, { emitUpdate: true })
      
      // Update comments
      if (result.comments && result.comments.length > 0) {
        documentComments.value = result.comments
        showAssistant.value = true // Auto-open assistant to show comments
      } else {
        documentComments.value = []
      }
      showWelcome.value = false
    }
  } catch (e: any) {
    alert('Failed to import Word file: ' + e.message)
  }
}

const saveProject = async () => {
  try {
    // Deep clone to remove Vue reactivity proxies
    const dataClone = JSON.parse(JSON.stringify(paperData.value))
    const assetsClone = JSON.parse(JSON.stringify(assets.value))

    const result = await ipcRenderer.invoke('save-paper', {
      filePath: currentFilePath.value,
      data: dataClone,
      assets: assetsClone
    })
    
    if (result && result.success) {
      currentFilePath.value = result.filePath
      alert('Saved successfully!')
    }
  } catch (e: any) {
    alert('Failed to save: ' + e.message)
  }
}

const exportDocx = async () => {
  try {
    // Deep clone to remove Vue reactivity proxies which cause IPC clone errors
    const dataClone = JSON.parse(JSON.stringify(paperData.value))
    const assetsClone = JSON.parse(JSON.stringify(assets.value))
    const stylesClone = JSON.parse(JSON.stringify(globalStyles.value))

    const result = await ipcRenderer.invoke('export-docx', {
      data: dataClone,
      assets: assetsClone,
      styles: stylesClone
    })
    
    if (result) {
      alert('Exported successfully!')
    }
  } catch (e: any) {
    alert('Failed to export: ' + e.message)
  }
}

let renderTimeout: any = null
const triggerRender = () => {
  // Only render if preview is active
  if (activeView.value !== 'preview') return

  if (renderTimeout) clearTimeout(renderTimeout)
  
  // Debounce render for 1 second to avoid performance issues
  renderTimeout = setTimeout(() => {
    openPreviewWindow()
  }, 1000)
}

const renderPDF = async () => {
  // Deprecated: Preview is now handled by openPreviewWindow
}

const scrollToBlock = (blockId: string, highlightText?: string) => {
  if (editorRef.value) {
    editorRef.value.scrollToBlock(blockId, highlightText)
  }
}

const addAsset = (filename: string, base64: string) => {
  assets.value[filename] = base64
  console.log('[App] Asset added:', filename)
}

const handleCommentSelected = (e: any) => {
  const commentId = e.detail.id
  console.log('Comment selected:', commentId)
  
  // Ensure assistant is open and in file view
  showAssistant.value = true
  if (activeView.value !== 'file') {
    activeView.value = 'file'
  }
  
  // Find comment in list and scroll to it
  // We need a slight delay to allow Vue to render the list if we just switched views
  setTimeout(() => {
    const commentEl = document.getElementById(`comment-card-${commentId}`)
    if (commentEl) {
      commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      commentEl.classList.add('ring-2', 'ring-blue-500')
      setTimeout(() => commentEl.classList.remove('ring-2', 'ring-blue-500'), 2000)
    }
  }, 100)
}

const handleAddReference = (ref: Reference) => {
  if (!paperData.value.references) {
    paperData.value.references = []
  }
  paperData.value.references.push(ref)
}

const handleRemoveReference = (id: string) => {
  if (!paperData.value.references) return
  paperData.value.references = paperData.value.references.filter(r => r.id !== id)
}

const handleMoveSection = (event: { fromId: string, toId: string, position: 'top' | 'bottom' }) => {
  if (editorRef.value) {
    editorRef.value.moveSection(event)
  }
}

const handleRestoreBlock = (block: any) => {
  console.log('[App] Restoring block:', block)
  
  // 1. Check if block exists
  const index = paperData.value.body.findIndex(b => b.id === block.id)
  
  if (index !== -1) {
    // Replace existing
    paperData.value.body[index] = { ...block }
    console.log('[App] Block replaced')
  } else {
    // Append new
    paperData.value.body.push({ ...block })
    console.log('[App] Block appended')
  }
  
  // 2. Trigger render/scroll
  triggerRender()
  setTimeout(() => {
    scrollToBlock(block.id)
  }, 100)
}

// Initial render
onMounted(() => {
  window.addEventListener('comment-selected', handleCommentSelected)

  // Auto-save Snapshot every 30 minutes
  setInterval(async () => {
    if (currentFilePath.value && paperData.value) {
      try {
        console.log('[AutoSave] Creating auto snapshot...')
        // Deep clone to remove Vue reactivity proxies
        const dataClone = JSON.parse(JSON.stringify(paperData.value))
        
        await ipcRenderer.invoke('create-snapshot', {
          filePath: currentFilePath.value,
          data: dataClone,
          note: 'Auto-save',
          type: 'auto'
        })
        console.log('[AutoSave] Snapshot created')
      } catch (e) {
        console.error('[AutoSave] Failed:', e)
      }
    }
  }, 30 * 60 * 1000) // 30 minutes
})
</script>

<template>
  <div class="h-screen flex flex-col bg-white overflow-hidden text-gray-900 dark:text-gray-100">
    <component :is="'style'">{{ dynamicStyles }}</component>
    <TitleBar 
      @open="loadProject"
      @save="saveProject"
      @import-word="importWord"
      @export-docx="exportDocx"
      @toggle-assistant="showAssistant = !showAssistant"
    />
    
    <!-- Main Content (4-Column Layout) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 1. Activity Bar (40px fixed) -->
      <div class="w-[40px] flex-none border-r border-gray-800 bg-gray-900">
        <ActivityBar 
          :active-view="activeView"
          :show-preview="activeView === 'preview'"
          @toggle-preview="openPreviewWindow" 
          @change-view="changeView"
        />
      </div>

      <!-- 2. Outline/Sidebar (240px fixed) -->
      <div class="w-[240px] flex-none border-r border-gray-300 bg-white flex flex-col">
        <Sidebar 
          :is-empty="showWelcome"
          :blocks="paperData.body" 
          :info="paperData.paper_info"
          @jump="scrollToBlock"
          @change="triggerRender"
          @move-section="handleMoveSection"
        />
      </div>

      <!-- 3. Editor (Flex 1) -->
      <div class="flex-1 border-r border-gray-300 min-w-0 bg-white flex flex-col relative">
        <Editor 
          v-if="!showWelcome"
          ref="editorRef"
          v-model="paperData.body" 
          :assets="assets"
          :references="paperData.references || []"
          @change="triggerRender" 
          @add-asset="addAsset"
        />
        
        <!-- Welcome Screen Buttons (Inside Editor Area when no file open) -->
        <div v-else class="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div class="flex flex-col gap-4 w-64">
            <button 
              @click="createNewPaper"
              class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded shadow transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              新建文件
            </button>
            <button 
              @click="loadProject"
              class="w-full py-3 px-4 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              导入文件
            </button>
          </div>
        </div>
      </div>

      <!-- Right Sidebar (Assistant) -->
      <div 
        v-show="showAssistant" 
        class="flex-1 min-w-0 bg-gray-50 dark:bg-gray-900 flex flex-col transition-all duration-300 border-l border-gray-200 dark:border-gray-800"
      >
        <!-- Math Reference Panel Target -->
        <div id="math-reference-root" v-show="isMathReferenceActive" class="flex-1 relative w-full h-full overflow-hidden"></div>

        <div v-show="!isMathReferenceActive" class="flex-1 flex flex-col h-full overflow-hidden">
          <!-- Tools moved to Assistant Area -->
          <SearchSidebar 
            v-if="activeView === 'search'" 
            :blocks="paperData.body"
            @jump="(id, query) => scrollToBlock(id, query)"
          />
          <VersionSidebar 
            v-if="activeView === 'version'" 
            :current-file-path="currentFilePath"
            :paper-data="paperData"
            :assets="assets"
            @restore-block="handleRestoreBlock"
          />
          <ResourceSidebar 
            v-if="activeView === 'resources'" 
            :blocks="paperData.body"
            :assets="assets"
            @jump="scrollToBlock"
          />
          <CitationSidebar 
            v-if="activeView === 'citations'"
            :references="paperData.references || []"
            @add-reference="handleAddReference"
            @remove-reference="handleRemoveReference"
          />
          <SettingsSidebar 
            v-if="activeView === 'settings'" 
            />
          <TypographySidebar 
            v-if="activeView === 'typography'" 
            :global-styles="globalStyles"
          />
          <Preview 
            v-if="activeView === 'preview'"
            :pdf-url="previewPdfUrl"
            :loading="isRendering"
          />

          <!-- Default Assistant Content (Comments) -->
          <template v-if="activeView === 'file'">
            <CommentList v-if="documentComments.length > 0" :comments="documentComments" />
            <div v-else class="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Assistant Area
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.ProseMirror {
  counter-reset: equation;
}
</style>

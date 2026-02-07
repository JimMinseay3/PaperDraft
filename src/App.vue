<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ipcRenderer } from 'electron'
import TitleBar from './components/TitleBar.vue'
import ActivityBar from './components/ActivityBar.vue'
import Sidebar from './components/Sidebar.vue'
import SearchSidebar from './components/SearchSidebar.vue'
import VersionSidebar from './components/VersionSidebar.vue'
import ResourceSidebar from './components/ResourceSidebar.vue'
import CitationSidebar from './components/CitationSidebar.vue'
import SettingsSidebar from './components/SettingsSidebar.vue'
import Editor from './components/Editor.vue'
import CommentList from './components/CommentList.vue'
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
const isRendering = ref(false)
const editorRef = ref<any>(null)
const activeView = ref('file')
const showAssistant = ref(true)
const documentComments = ref<any[]>([])

// Actions
const openPreviewWindow = async () => {
  if (isRendering.value) return
  isRendering.value = true
  
  try {
    const dataClone = JSON.parse(JSON.stringify(paperData.value))
    const assetsClone = JSON.parse(JSON.stringify(assets.value))
    
    await ipcRenderer.invoke('open-preview-window', {
      data: dataClone,
      assets: assetsClone
    })
  } catch (e: any) {
    console.error('Open preview failed:', e)
    alert('Failed to open preview: ' + e.message)
  }
  
  isRendering.value = false
}

const changeView = (view: string) => {
  activeView.value = view
}

const loadProject = async () => {
  try {
    const result = await ipcRenderer.invoke('load-paper')
    if (result) {
      paperData.value = result.data
      assets.value = result.assets
      currentFilePath.value = result.filePath
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
    }
  } catch (e: any) {
    alert('Failed to import Word file: ' + e.message)
  }
}

const saveProject = async () => {
  try {
    const result = await ipcRenderer.invoke('save-paper', {
      filePath: currentFilePath.value,
      data: paperData.value,
      assets: assets.value
    })
    
    if (result && result.success) {
      currentFilePath.value = result.filePath
      alert('Saved successfully!')
    }
  } catch (e: any) {
    alert('Failed to save: ' + e.message)
  }
}

let renderTimeout: any = null
const triggerRender = () => {
  // Real-time rendering is disabled
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
  
  // Find comment in list and scroll to it
  const commentEl = document.getElementById(`comment-card-${commentId}`)
  if (commentEl) {
    commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    commentEl.classList.add('ring-2', 'ring-blue-500')
    setTimeout(() => commentEl.classList.remove('ring-2', 'ring-blue-500'), 2000)
  }
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

// Initial render
onMounted(() => {
  window.addEventListener('comment-selected', handleCommentSelected)

  // Auto-save Snapshot every 30 minutes
  setInterval(async () => {
    if (currentFilePath.value && paperData.value) {
      try {
        console.log('[AutoSave] Creating auto snapshot...')
        await ipcRenderer.invoke('create-snapshot', {
          filePath: currentFilePath.value,
          data: paperData.value,
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
  <div class="h-screen flex flex-col overflow-hidden">
    <TitleBar 
      @open="loadProject"
      @save="saveProject"
      @import-word="importWord"
      @toggle-assistant="showAssistant = !showAssistant"
    />
    
    <!-- Main Content (4-Column Layout) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 1. Activity Bar (40px fixed) -->
      <div class="w-[40px] flex-none border-r border-gray-800 bg-gray-900">
        <ActivityBar 
          :active-view="activeView"
          :show-preview="false"
          @toggle-preview="openPreviewWindow" 
          @change-view="changeView"
        />
      </div>

      <!-- 2. Outline/Sidebar (240px fixed) -->
      <div class="w-[240px] flex-none border-r border-gray-300 bg-white flex flex-col">
        <Sidebar 
          v-show="activeView === 'file'"
          :blocks="paperData.body" 
          :info="paperData.paper_info"
          @jump="scrollToBlock"
          @change="triggerRender"
          @move-section="handleMoveSection"
        />
        <SearchSidebar 
          v-if="activeView === 'search'" 
          :blocks="paperData.body"
          @jump="(id, query) => scrollToBlock(id, query)"
        />
        <VersionSidebar 
          v-if="activeView === 'version'" 
          :current-file-path="currentFilePath"
          :paper-data="paperData"
        />
        <ResourceSidebar 
          v-if="activeView === 'resources'" 
          :blocks="paperData.body"
          :assets="assets"
        />
        <CitationSidebar 
          v-if="activeView === 'citations'"
          :references="paperData.references || []"
          @add-reference="handleAddReference"
          @remove-reference="handleRemoveReference"
        />
        <SettingsSidebar v-if="activeView === 'settings'" />
      </div>

      <!-- 3. Editor (Flex 1) -->
      <div class="flex-1 border-r border-gray-300 min-w-0 bg-white">
        <Editor 
          ref="editorRef"
          v-model="paperData.body" 
          :assets="assets"
          :references="paperData.references || []"
          @change="triggerRender" 
          @add-asset="addAsset"
        />
      </div>

      <!-- Right Sidebar (Assistant) -->
      <div 
        v-show="showAssistant" 
        class="flex-1 min-w-0 bg-gray-50 dark:bg-gray-900 flex flex-col transition-all duration-300 border-l border-gray-200 dark:border-gray-800"
      >
        <CommentList v-if="documentComments.length > 0" :comments="documentComments" />
        <div v-else class="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Assistant Area
        </div>
      </div>

    </div>
  </div>
</template>

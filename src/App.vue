<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ipcRenderer } from 'electron'
import TitleBar from './components/TitleBar.vue'
import ActivityBar from './components/ActivityBar.vue'
import Sidebar from './components/Sidebar.vue'
import SearchSidebar from './components/SearchSidebar.vue'
import VersionSidebar from './components/VersionSidebar.vue'
import ResourceSidebar from './components/ResourceSidebar.vue'
import Editor from './components/Editor.vue'
import type { PaperData } from './types/paper'

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

const scrollToBlock = (blockId: string) => {
  console.log('[App] Received jump request for block:', blockId)
  if (editorRef.value) {
    console.log('[App] Calling editorRef.scrollToBlock')
    editorRef.value.scrollToBlock(blockId)
  } else {
    console.error('[App] editorRef is null!')
    alert('Debug: Editor reference is missing!')
  }
}

const addAsset = (filename: string, base64: string) => {
  assets.value[filename] = base64
  console.log('[App] Asset added:', filename)
}

// Initial render
onMounted(() => {
  // No initial render needed
})
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <TitleBar 
      @open="loadProject"
      @save="saveProject"
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
        />
        <SearchSidebar v-if="activeView === 'search'" />
        <VersionSidebar v-if="activeView === 'version'" />
        <ResourceSidebar v-if="activeView === 'resources'" />
      </div>

      <!-- 3. Editor (Flex 1) -->
      <div class="flex-1 border-r border-gray-300 min-w-0 bg-white">
        <Editor 
          ref="editorRef"
          v-model="paperData.body" 
          :assets="assets"
          @change="triggerRender" 
          @add-asset="addAsset"
        />
      </div>

      <!-- 4. Auxiliary/Copilot (Flex 1) -->
      <div v-show="showAssistant" class="flex-1 min-w-0 bg-gray-50 flex flex-col transition-all duration-300">
        <div class="h-8 bg-gray-100 border-b border-gray-300 flex items-center px-2 text-xs font-bold text-gray-600">
          Assistant
        </div>
        <div class="flex-1 p-4 text-gray-400 text-sm text-center">
          Assistant / Copilot Placeholder
        </div>
      </div>

    </div>
  </div>
</template>

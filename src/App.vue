<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ipcRenderer } from 'electron'
import TitleBar from './components/TitleBar.vue'
import ActivityBar from './components/ActivityBar.vue'
import Sidebar from './components/Sidebar.vue'
import Editor from './components/Editor.vue'
import Preview from './components/Preview.vue'
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
const showPreview = ref(true)

// Actions
const togglePreview = () => {
  showPreview.value = !showPreview.value
}

const loadProject = async () => {
  try {
    const result = await ipcRenderer.invoke('load-paper')
    if (result) {
      paperData.value = result.data
      assets.value = result.assets
      currentFilePath.value = result.filePath
      triggerRender()
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
  if (renderTimeout) clearTimeout(renderTimeout)
  renderTimeout = setTimeout(() => {
    renderPDF()
  }, 1000) // Debounce 1s
}

const renderPDF = async () => {
  if (isRendering.value) return
  isRendering.value = true
  
  try {
    // Clone data to avoid proxy issues during IPC
    const dataClone = JSON.parse(JSON.stringify(paperData.value))
    const assetsClone = JSON.parse(JSON.stringify(assets.value))
    
    const pdfBase64 = await ipcRenderer.invoke('render-preview', {
      data: dataClone,
      assets: assetsClone
    })
    
    pdfUrl.value = pdfBase64
  } catch (e: any) {
    console.error('Render failed:', e)
  }
  
  isRendering.value = false
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
  renderPDF()
})
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <TitleBar 
      @open="loadProject"
      @save="saveProject"
    />
    
    <!-- Main Content (4-Column Layout) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 1. Activity Bar (0.5) -->
      <div class="flex-[0.5] min-w-[50px] max-w-[60px]">
        <ActivityBar @toggle-preview="togglePreview" />
      </div>

      <!-- 2. Outline/Sidebar (1.5) -->
      <div class="flex-[1.5] border-r border-gray-300 min-w-[150px]">
        <Sidebar 
          :blocks="paperData.body" 
          :info="paperData.paper_info"
          @jump="scrollToBlock"
          @change="triggerRender"
        />
      </div>

      <!-- 3. Editor (4.0) -->
      <div class="flex-[4] border-r border-gray-300 min-w-[300px]">
        <Editor 
          ref="editorRef"
          v-model="paperData.body" 
          :assets="assets"
          @change="triggerRender" 
          @add-asset="addAsset"
        />
      </div>

      <!-- 4. Copilot/Preview (4.0) -->
      <div v-show="showPreview" class="flex-[4] min-w-[300px] flex flex-col bg-gray-50">
        <!-- Copilot Header (Optional) -->
        <!-- <div class="h-8 bg-gray-100 border-b border-gray-300 flex items-center px-2 text-xs font-bold text-gray-600">
          Copilot / Preview
        </div> -->
        <Preview :pdfUrl="pdfUrl" :loading="isRendering" />
      </div>
    </div>
  </div>
</template>

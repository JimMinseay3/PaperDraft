<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { ipcRenderer } from 'electron'
import { useI18n } from 'vue-i18n'
import { Clock } from 'lucide-vue-next'
import type { PaperData, Snapshot, VersionGraph, VersionNode } from '../types/paper'
import * as Diff from 'diff'
import VersionTimeline from './VersionTimeline.vue'
import SnapshotViewer from './SnapshotViewer.vue'
import type { Block } from '../types/paper'

const { t } = useI18n()

const props = defineProps<{
  currentFilePath: string
  paperData: PaperData
  assets?: Record<string, string>
  isDirty?: boolean
}>()

const graph = ref<VersionGraph | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const showSnapshotModal = ref(false)
const newSnapshotNote = ref('')

// Diff Modal State
const showDiffModal = ref(false)
const diffParts = ref<Diff.Change[]>([])
const diffTargetTitle = ref('')
const viewMode = ref<'diff' | 'preview'>('diff')
const snapshotData = ref<PaperData | null>(null)

// Fetch Graph
const fetchGraph = async () => {
  if (!props.currentFilePath) return
  isLoading.value = true
  try {
    const result = await ipcRenderer.invoke('get-version-graph', { filePath: props.currentFilePath })
    if (result) {
        graph.value = result
    } else {
        // Fallback or empty
        graph.value = null
    }
  } catch (e) {
    console.error('Failed to fetch version graph:', e)
  } finally {
    isLoading.value = false
  }
}

// Watch for file path changes
let autoSaveTimer: number | null = null

const saveAutosave = async () => {
    if (!props.currentFilePath) return
    
    try {
        const dataToSave = JSON.parse(JSON.stringify(props.paperData))
        await ipcRenderer.invoke('save-autosave', {
            filePath: props.currentFilePath,
            data: dataToSave
        })
        // Silent update
        await fetchGraph()
    } catch (e) {
        console.error('Autosave failed:', e)
    }
}

const startAutoSave = () => {
    if (autoSaveTimer) clearInterval(autoSaveTimer)
    autoSaveTimer = window.setInterval(saveAutosave, 60000) // 1 minute
}

const stopAutoSave = () => {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer)
        autoSaveTimer = null
    }
}

watch(() => props.currentFilePath, (newPath) => {
    if (newPath) {
        fetchGraph()
        startAutoSave()
    } else {
        stopAutoSave()
        graph.value = null
    }
})

onMounted(() => {
    if (props.currentFilePath) {
        fetchGraph()
        startAutoSave()
    }
})

onUnmounted(() => {
    stopAutoSave()
})

// Create Snapshot
const openSnapshotModal = () => {
    newSnapshotNote.value = ''
    showSnapshotModal.value = true
}

const createSnapshot = async () => {
    if (!props.currentFilePath) {
        alert(t('version.saveFirst'))
        return
    }
    
    isSaving.value = true
    try {
        // Deep clone to avoid IPC proxy issues
        const dataToSave = JSON.parse(JSON.stringify(props.paperData))
        
        await ipcRenderer.invoke('create-snapshot', {
            filePath: props.currentFilePath,
            data: dataToSave,
            note: newSnapshotNote.value || `Version ${new Date().toLocaleTimeString()}`,
            type: 'manual'
        })
        showSnapshotModal.value = false
        await fetchGraph()
    } catch (e: any) {
        alert('Failed to create snapshot: ' + e.message)
    } finally {
        isSaving.value = false
    }
}

// Switch / Revert
const emit = defineEmits<{
    (e: 'reload'): void
    (e: 'restore-block', block: Block): void
    (e: 'restore-all', blocks: Block[]): void
    (e: 'set-readonly', value: boolean): void
}>()

const handleSwitch = async (nodeId: string) => {
    // If user clicks "Current Version", make sure editor is NOT readonly
    if (nodeId === 'current') {
        emit('set-readonly', false)
        return
    }

    const node = graph.value?.nodes[nodeId]
    if (node) {
        emit('set-readonly', true) // Lock editor when viewing old version
        compareSnapshot(node)
    }
}

// Compare & Restore
const flattenPaper = (data: PaperData): string => {
  return data.body.map(b => {
    if (typeof b.content === 'string') return b.content
    return '' 
  }).join('\n\n')
}

const compareSnapshot = async (node: VersionNode) => {
  try {
    const data: PaperData = await ipcRenderer.invoke('load-snapshot', {
      filePath: props.currentFilePath,
      snapshotId: node.id
    })
    
    snapshotData.value = data
    
    const currentText = flattenPaper(props.paperData)
    const oldText = flattenPaper(data)
    
    diffParts.value = Diff.diffWords(oldText, currentText)
    diffTargetTitle.value = `${t('version.compare')}: ${node.note} (${new Date(node.timestamp).toLocaleString()})`
    showDiffModal.value = true
    viewMode.value = 'diff'
  } catch (e: any) {
    alert('Failed to load snapshot for comparison: ' + e.message)
  }
}

const handleRestoreBlock = (block: Block) => {
    emit('restore-block', block)
    // Optional: show a small toast notification instead of alert
    // alert(t('version.restored') || 'Block restored')
}

const handleRestoreAll = async () => {
    if (!snapshotData.value) return
    if (!confirm(t('version.confirmRestoreAll') || 'Are you sure you want to restore this entire version? Current unsaved changes will be overwritten.')) return

    // Emit event to parent to replace entire content
    // We can iterate and emit 'restore-block' for each, or add a new event 'restore-all'
    // Let's add 'restore-all' to the emits definition
    emit('restore-all', snapshotData.value.body)
    showDiffModal.value = false
}

const handleDeleteVersion = async (nodeId: string) => {
    if (!props.currentFilePath) return
    if (!confirm(t('version.confirmDelete') || 'Are you sure you want to delete this version? This action cannot be undone.')) return

    try {
        const result = await ipcRenderer.invoke('delete-snapshot', {
            filePath: props.currentFilePath,
            snapshotId: nodeId
        })
        if (result) {
            await fetchGraph()
        }
    } catch (e: any) {
        alert('Failed to delete version: ' + e.message)
    }
}

const activeNodeId = computed(() => {
    // The user is always working on the "Current Version" track
    return 'current'
})

</script>

<template>
  <div class="h-full bg-white flex flex-col relative">
    <!-- Header -->
    <div class="h-10 px-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
      <h2 class="text-xs font-bold text-gray-700 uppercase flex items-center">
        <Clock class="w-4 h-4 mr-2 text-blue-500" />
        {{ t('version.title') }}
      </h2>
      <div class="flex space-x-1">
          <button 
            @click="openSnapshotModal"
            class="p-1 hover:bg-gray-200 rounded text-gray-600"
            :title="t('version.createSnapshot')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
      </div>
    </div>

    <!-- Timeline -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden relative">
      <VersionTimeline 
            v-if="graph" 
            :graph="graph" 
            :active-node-id="activeNodeId"
            :is-dirty="isDirty"
            @switch="handleSwitch"
            @delete="handleDeleteVersion"
          />
      <div v-else class="text-center text-gray-400 text-sm mt-10">
        {{ t('version.noSnapshots') }}
      </div>
    </div>

    <!-- Create Snapshot Modal -->
    <div v-if="showSnapshotModal" class="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
      <div class="bg-white p-4 rounded-lg shadow-xl w-64">
        <h3 class="text-sm font-bold mb-2">{{ t('version.modalTitle') || 'New Snapshot' }}</h3>
        <input 
          v-model="newSnapshotNote"
          type="text" 
          :placeholder="t('version.placeholder')" 
          class="w-full border border-gray-300 rounded p-2 text-sm mb-3 focus:outline-none focus:border-purple-500"
          @keyup.enter="createSnapshot"
          :disabled="isSaving"
        />
        <div class="flex justify-end space-x-2">
          <button @click="showSnapshotModal = false" class="text-xs text-gray-500 hover:text-gray-700" :disabled="isSaving">{{ t('version.cancel') }}</button>
          <button @click="createSnapshot" class="text-xs bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isSaving">{{ isSaving ? t('version.saving') : t('version.save') }}</button>
        </div>
      </div>
    </div>

    <!-- Diff Modal (Full Screen Overlay) -->
    <div v-if="showDiffModal" class="fixed inset-0 bg-white z-50 flex flex-col">
      <div class="h-12 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50">
        <div class="flex items-center gap-4">
            <h2 class="font-bold text-gray-700">{{ diffTargetTitle }}</h2>
            <div class="flex items-center space-x-2">
                <span class="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">Visual Diff Mode</span>
            </div>
        </div>
        <div class="flex items-center gap-4">
            <button 
                @click="handleRestoreAll"
                class="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded text-sm hover:bg-red-100 transition-colors flex items-center"
            >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {{ t('common.restore') }}
            </button>
            <button @click="{ showDiffModal = false; emit('set-readonly', false) }" class="text-gray-500 hover:text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
      </div>
      <div class="flex-1 overflow-hidden flex divide-x divide-gray-200">
        <!-- Left Column: Current State -->
        <div class="flex-1 flex flex-col min-w-0 bg-gray-50/50">
            <div class="h-8 flex items-center px-4 bg-gray-100 border-b border-gray-200">
                <span class="text-xs font-bold text-gray-600 uppercase tracking-wide">Current Workspace</span>
            </div>
            <div class="flex-1 overflow-y-auto p-8">
                <div class="prose prose-sm max-w-none bg-white p-8 shadow-sm rounded-lg min-h-[500px]">
                    <SnapshotViewer 
                        v-if="props.paperData"
                        :blocks="props.paperData.body" 
                        :assets="props.assets || {}"
                        :readonly="true"
                    />
                </div>
            </div>
        </div>

        <!-- Right Column: Snapshot State -->
        <div class="flex-1 flex flex-col min-w-0 bg-blue-50/30">
            <div class="h-8 flex items-center px-4 bg-blue-100 border-b border-blue-200">
                <span class="text-xs font-bold text-blue-800 uppercase tracking-wide">Snapshot Version</span>
            </div>
            <div class="flex-1 overflow-y-auto p-8">
                <div class="prose prose-sm max-w-none bg-white p-8 shadow-sm rounded-lg min-h-[500px] border border-blue-100">
                    <SnapshotViewer 
                        v-if="snapshotData"
                        :blocks="snapshotData.body" 
                        :assets="assets || {}"
                        @restore="handleRestoreBlock"
                        :allow-restore="true"
                    />
                </div>
            </div>
        </div>
      </div>
    </div>
  </div>
</template>

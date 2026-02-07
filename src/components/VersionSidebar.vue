<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ipcRenderer } from 'electron'
import { useI18n } from 'vue-i18n'
import type { PaperData, Snapshot } from '../types/paper'
import * as Diff from 'diff'

const { t } = useI18n()

const props = defineProps<{
  currentFilePath: string
  paperData: PaperData
}>()

const snapshots = ref<Snapshot[]>([])
const isLoading = ref(false)
const showCreateModal = ref(false)
const snapshotNote = ref('')

// Diff Modal State
const showDiffModal = ref(false)
const diffParts = ref<Diff.Change[]>([])
const diffTargetTitle = ref('')

// Fetch snapshots
const fetchSnapshots = async () => {
  if (!props.currentFilePath) return
  isLoading.value = true
  try {
    snapshots.value = await ipcRenderer.invoke('get-snapshots', { filePath: props.currentFilePath })
  } catch (e) {
    console.error('Failed to fetch snapshots:', e)
  } finally {
    isLoading.value = false
  }
}

// Watch for file path changes
watch(() => props.currentFilePath, fetchSnapshots)

onMounted(fetchSnapshots)

// Create Snapshot
const openCreateModal = () => {
  snapshotNote.value = ''
  showCreateModal.value = true
}

const createSnapshot = async () => {
  if (!props.currentFilePath) {
    alert(t('common.save') + ' ' + t('activityBar.file') + ' ' + t('common.first') || 'Please save the file first.')
    return
  }
  
  try {
    await ipcRenderer.invoke('create-snapshot', {
      filePath: props.currentFilePath,
      data: props.paperData,
      note: snapshotNote.value || t('version.manual'),
      type: 'manual'
    })
    showCreateModal.value = false
    await fetchSnapshots()
  } catch (e: any) {
    alert('Failed to create snapshot: ' + e.message)
  }
}

// Compare Snapshot
const flattenPaper = (data: PaperData): string => {
  return data.body.map(b => {
    if (typeof b.content === 'string') return b.content
    // Handle nested content (e.g. lists) if necessary
    return '' 
  }).join('\n\n')
}

const compareSnapshot = async (snapshot: Snapshot) => {
  try {
    const snapshotData: PaperData = await ipcRenderer.invoke('load-snapshot', {
      filePath: props.currentFilePath,
      snapshotId: snapshot.id
    })
    
    const currentText = flattenPaper(props.paperData)
    const oldText = flattenPaper(snapshotData)
    
    diffParts.value = Diff.diffWords(oldText, currentText)
    diffTargetTitle.value = `${t('version.compare')}: ${snapshot.note} (${formatDate(snapshot.timestamp)})`
    showDiffModal.value = true
  } catch (e: any) {
    alert('Failed to load snapshot for comparison: ' + e.message)
  }
}

const formatDate = (ts: number) => {
  return new Date(ts).toLocaleString()
}
</script>

<template>
  <div class="h-full bg-gray-50 flex flex-col relative">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
      <h2 class="text-xs font-bold text-gray-700 uppercase">{{ t('version.title') }}</h2>
      <button 
        @click="openCreateModal"
        class="text-gray-600 hover:text-blue-600 p-1 rounded hover:bg-gray-100"
        :title="t('version.createSnapshot')"
      >
        <!-- Camera Icon -->
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <div v-if="snapshots.length === 0" class="text-center text-gray-400 text-sm mt-10">
        {{ t('version.noSnapshots') }}
      </div>

      <div 
        v-for="snap in snapshots" 
        :key="snap.id" 
        class="relative pl-4 border-l-2 hover:bg-gray-100 p-2 rounded cursor-pointer transition-colors group"
        :class="snap.type === 'auto' ? 'border-gray-300' : 'border-blue-500'"
      >
        <!-- Dot -->
        <div 
          class="absolute -left-[5px] top-4 w-2 h-2 rounded-full"
          :class="snap.type === 'auto' ? 'bg-gray-400' : 'bg-blue-500'"
        ></div>

        <div class="flex justify-between items-start">
          <div>
            <div class="text-sm font-medium text-gray-800">{{ snap.note }}</div>
            <div class="text-xs text-gray-500">{{ formatDate(snap.timestamp) }}</div>
            <div class="text-xs text-gray-400 mt-1" v-if="snap.wordCount">{{ snap.wordCount }} {{ t('version.words') }}</div>
          </div>
        </div>

        <!-- Actions (visible on hover) -->
        <div class="mt-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            @click.stop="compareSnapshot(snap)"
            class="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 text-gray-700"
          >
            {{ t('version.compare') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
      <div class="bg-white p-4 rounded-lg shadow-xl w-64">
        <h3 class="text-sm font-bold mb-2">{{ t('version.modalTitle') }}</h3>
        <input 
          v-model="snapshotNote"
          type="text" 
          :placeholder="t('version.placeholder')" 
          class="w-full border border-gray-300 rounded p-2 text-sm mb-3 focus:outline-none focus:border-blue-500"
          @keyup.enter="createSnapshot"
        />
        <div class="flex justify-end space-x-2">
          <button @click="showCreateModal = false" class="text-xs text-gray-500 hover:text-gray-700">{{ t('version.cancel') }}</button>
          <button @click="createSnapshot" class="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">{{ t('version.save') }}</button>
        </div>
      </div>
    </div>

    <!-- Diff Modal (Full Screen Overlay) -->
    <div v-if="showDiffModal" class="fixed inset-0 bg-white z-50 flex flex-col">
      <div class="h-12 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50">
        <h2 class="font-bold text-gray-700">{{ diffTargetTitle }}</h2>
        <button @click="showDiffModal = false" class="text-gray-500 hover:text-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="flex-1 overflow-auto p-8 max-w-4xl mx-auto w-full prose prose-sm">
        <div class="bg-white p-8 shadow-sm border border-gray-100 rounded-lg min-h-full">
            <span v-for="(part, index) in diffParts" :key="index"
              :class="{
                'bg-green-100 text-green-800 px-0.5 rounded': part.added,
                'bg-red-100 text-red-800 line-through px-0.5 rounded decoration-red-500': part.removed,
                'text-gray-800': !part.added && !part.removed
              }"
            >{{ part.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

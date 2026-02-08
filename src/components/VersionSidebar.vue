<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { ipcRenderer } from 'electron'
import { useI18n } from 'vue-i18n'
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
}>()

const graph = ref<VersionGraph | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const showBranchModal = ref(false)
const newBranchName = ref('')

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
watch(() => props.currentFilePath, fetchGraph)

onMounted(fetchGraph)

// Create Branch
const openBranchModal = () => {
    newBranchName.value = ''
    showBranchModal.value = true
}

const createBranch = async () => {
    if (!props.currentFilePath) {
        alert(t('version.saveFirst'))
        return
    }
    
    isSaving.value = true
    try {
        await ipcRenderer.invoke('create-branch', {
            filePath: props.currentFilePath,
            name: newBranchName.value || `Branch ${Date.now()}`
        })
        showBranchModal.value = false
        await fetchGraph()
    } catch (e: any) {
        alert('Failed to create branch: ' + e.message)
    } finally {
        isSaving.value = false
    }
}

// Switch / Revert
const emit = defineEmits<{
    (e: 'reload'): void
    (e: 'restore-block', block: Block): void
}>()

const handleSwitch = async (nodeId: string) => {
    // Check if node belongs to a branch head, if so switch branch
    // Or just load the content?
    // "Clicking dot to revert or switch"
    // If we click a past node, we usually just load its content as a preview or "detached head" state?
    // For simplicity: Load content and ask if they want to revert (overwrite current) or checkout (switch branch).
    // Actually, VersionManager has `switchBranch`. 
    // But clicking a specific NODE might not be a branch head.
    
    // For now: Just load snapshot content and show Diff, then offer "Restore"
    const node = graph.value?.nodes[nodeId]
    if (node) {
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
    alert(t('version.restored') || 'Block restored')
}

const activeNodeId = computed(() => {
    // We don't easily know which node corresponds to current unsaved content.
    // But we know the HEAD of active branch.
    if (graph.value) {
        const branch = graph.value.branches[graph.value.activeBranchId]
        return branch?.headNodeId
    }
    return undefined
})

</script>

<template>
  <div class="h-full bg-gray-50 flex flex-col relative">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-white shadow-sm z-10">
      <div>
          <h2 class="text-xs font-bold text-gray-700 uppercase">{{ t('version.title') }}</h2>
          <div v-if="graph" class="text-[10px] text-gray-500 flex items-center gap-1">
             <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: graph.branches[graph.activeBranchId]?.color }"></span>
             {{ graph.branches[graph.activeBranchId]?.name }}
          </div>
      </div>
      <div class="flex space-x-1">
          <button 
            @click="openBranchModal"
            class="text-gray-600 hover:text-purple-600 p-1 rounded hover:bg-gray-100"
            :title="t('version.createBranch')"
          >
            <!-- Plus Icon for Branch -->
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
        @switch="handleSwitch"
      />
      <div v-else class="text-center text-gray-400 text-sm mt-10">
        {{ t('version.noSnapshots') }}
      </div>
    </div>

    <!-- Create Branch Modal -->
    <div v-if="showBranchModal" class="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
      <div class="bg-white p-4 rounded-lg shadow-xl w-64">
        <h3 class="text-sm font-bold mb-2">{{ t('version.branchTitle') || 'New Branch' }}</h3>
        <input 
          v-model="newBranchName"
          type="text" 
          placeholder="Branch Name (e.g. Experiment A)" 
          class="w-full border border-gray-300 rounded p-2 text-sm mb-3 focus:outline-none focus:border-purple-500"
          @keyup.enter="createBranch"
          :disabled="isSaving"
        />
        <div class="flex justify-end space-x-2">
          <button @click="showBranchModal = false" class="text-xs text-gray-500 hover:text-gray-700" :disabled="isSaving">{{ t('version.cancel') }}</button>
          <button @click="createBranch" class="text-xs bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isSaving">{{ isSaving ? t('version.saving') : t('version.save') }}</button>
        </div>
      </div>
    </div>

    <!-- Diff Modal (Full Screen Overlay) -->
    <div v-if="showDiffModal" class="fixed inset-0 bg-white z-50 flex flex-col">
      <div class="h-12 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50">
        <div class="flex items-center gap-4">
            <h2 class="font-bold text-gray-700">{{ diffTargetTitle }}</h2>
            <div class="flex bg-gray-200 rounded p-1 text-xs">
                <button 
                    @click="viewMode = 'diff'"
                    class="px-3 py-1 rounded transition-colors"
                    :class="viewMode === 'diff' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'"
                >Text Diff</button>
                <button 
                    @click="viewMode = 'preview'"
                    class="px-3 py-1 rounded transition-colors"
                    :class="viewMode === 'preview' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'"
                >Preview & Restore</button>
            </div>
        </div>
        <button @click="showDiffModal = false" class="text-gray-500 hover:text-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="flex-1 overflow-auto p-8 max-w-4xl mx-auto w-full prose prose-sm">
        <!-- Text Diff Mode -->
        <div v-if="viewMode === 'diff'" class="bg-white p-8 shadow-sm border border-gray-100 rounded-lg min-h-full">
            <span v-for="(part, index) in diffParts" :key="index"
              :class="{
                'bg-green-100 text-green-800 px-0.5 rounded': part.added,
                'bg-red-100 text-red-800 line-through px-0.5 rounded decoration-red-500': part.removed,
                'text-gray-800': !part.added && !part.removed
              }"
            >{{ part.value }}</span>
        </div>

        <!-- Preview & Restore Mode -->
        <div v-else-if="viewMode === 'preview' && snapshotData" class="bg-white shadow-sm border border-gray-100 rounded-lg min-h-full">
            <SnapshotViewer 
                :blocks="snapshotData.body" 
                :assets="assets || {}"
                @restore="handleRestoreBlock"
            />
        </div>
      </div>
    </div>
  </div>
</template>

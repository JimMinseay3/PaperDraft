<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight, ChevronDown, Clock, Trash2, ArrowLeftRight } from 'lucide-vue-next'
import type { VersionGraph, VersionNode } from '../types/paper'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

type TimelineNode = VersionNode & {
  color: string
  branchName?: string
  isCurrent?: boolean
}

const props = defineProps<{
  graph: VersionGraph
  activeNodeId?: string
  isDirty?: boolean
}>()

const emit = defineEmits<{
  (e: 'switch', nodeId: string): void
  (e: 'delete', nodeId: string): void
}>()

const expandedNodes = ref(new Set<string>())

// Helpers
const formatDate = (ts: number) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const branches = computed(() => props.graph.branches)
const nodes = computed(() => props.graph.nodes)

const autosaveNode = computed<TimelineNode | undefined>(() => {
  const node = nodes.value['autosave']
  if (!node) return undefined
  return {
    ...node,
    color: '#10b981', // Green for autosave
    branchName: 'Autosave'
  }
})

// Sort nodes by timestamp desc (Linear Single Track)
const sortedNodes = computed<TimelineNode[]>(() => {
  const list: TimelineNode[] = Object.values(nodes.value)
    .filter(n => n.id !== 'autosave') // Exclude autosave
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(node => {
    const branch = branches.value[node.branchId]
    return {
      ...node,
      color: branch?.color || '#9ca3af',
      branchName: branch?.name
    }
  })

  return list
})

const toggleExpand = (nodeId: string) => {
  if (expandedNodes.value.has(nodeId)) {
    expandedNodes.value.delete(nodeId)
  } else {
    expandedNodes.value.add(nodeId)
  }
}
</script>

<template>
  <div class="w-full flex flex-col p-2 space-y-2">
    <!-- Autosave Section -->
    <div v-if="autosaveNode" class="mb-4">
      <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
          {{ t('version.autoSave') }}
      </div>
      <div 
        class="border rounded-lg bg-white shadow-sm transition-all duration-200 overflow-hidden"
        :class="{
          'border-green-500 ring-1 ring-green-500': autosaveNode.id === activeNodeId,
          'border-green-200 hover:border-green-300': autosaveNode.id !== activeNodeId
        }"
      >
        <!-- Header / Summary -->
        <div 
          class="flex items-center p-3 cursor-pointer select-none bg-green-50/30 hover:bg-green-50/50"
          @click="toggleExpand(autosaveNode.id)"
        >
          <!-- Icon/Indicator -->
          <div class="mr-3 flex-shrink-0">
            <div 
              class="w-3 h-3 rounded-full border-2"
              :style="{ borderColor: autosaveNode.color, backgroundColor: autosaveNode.id === activeNodeId ? autosaveNode.color : 'white' }"
            ></div>
          </div>
          
          <!-- Main Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-800 truncate">
                  {{ autosaveNode.note }} 
              </span>
              <span class="text-xs text-gray-400 flex-shrink-0 ml-2">
                  {{ formatDate(autosaveNode.timestamp) }}
              </span>
            </div>
            <div class="flex items-center mt-1 space-x-3 text-xs text-gray-500">
               <span class="flex items-center">
                  {{ autosaveNode.wordCount }} {{ t('version.words') }}
               </span>
            </div>
          </div>
          
           <!-- Expand/Collapse Icon -->
           <div class="ml-2 text-gray-400">
              <ChevronDown v-if="expandedNodes.has(autosaveNode.id)" class="w-4 h-4" />
              <ChevronRight v-else class="w-4 h-4" />
            </div>
        </div>

        <!-- Expanded Details -->
        <div v-if="expandedNodes.has(autosaveNode.id)" class="border-t border-gray-100 bg-gray-50 p-3">
           <div class="flex items-center justify-between mt-3">
             <div class="text-xs text-gray-400">ID: {{ autosaveNode.id }}</div>
             <div class="flex space-x-2">
                <!-- Delete Button (Maybe disable for autosave?) -->
                 <!-- Autosave usually shouldn't be deleted manually or it will just come back. Let's hide delete for autosave. -->
                 
                 <!-- Compare/Restore Button -->
                 <button 
                   @click.stop="emit('switch', autosaveNode.id)"
                   class="flex items-center px-2 py-1 bg-white border border-gray-200 rounded shadow-sm text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                 >
                   <ArrowLeftRight class="w-3 h-3 mr-1" />
                   {{ t('version.compare') }} / {{ t('common.restore') }}
                 </button>
             </div>
           </div>
        </div>
      </div>
    </div>

    <!-- Manual Section -->
    <div v-if="sortedNodes.length > 0">
      <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
          {{ t('version.manual') }}
      </div>
      <div 
        v-for="node in sortedNodes" 
        :key="node.id"
        class="border rounded-lg bg-white shadow-sm transition-all duration-200 overflow-hidden"
      :class="{
        'border-blue-500 ring-1 ring-blue-500': node.id === activeNodeId,
        'border-gray-200 hover:border-gray-300': node.id !== activeNodeId
      }"
    >
      <!-- Header / Summary -->
      <div 
        class="flex items-center p-3 cursor-pointer select-none bg-gray-50/50 hover:bg-gray-50"
        @click="toggleExpand(node.id)"
      >
        <!-- Icon/Indicator -->
        <div class="mr-3 flex-shrink-0">
          <div 
            class="w-3 h-3 rounded-full border-2"
            :style="{ borderColor: node.color, backgroundColor: node.id === activeNodeId ? node.color : 'white' }"
          ></div>
        </div>
        
        <!-- Main Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-800 truncate">
                {{ node.note }} 
            </span>
            <span class="text-[10px] text-gray-400 ml-2 whitespace-nowrap">{{ formatDate(node.timestamp) }}</span>
          </div>
          <div class="flex items-center mt-1 space-x-2">
            <span class="text-[10px] text-gray-400">{{ node.wordCount }} {{ t('version.words') }}</span>
          </div>
        </div>

        <!-- Chevron -->
        <div class="ml-2 text-gray-400">
          <component :is="expandedNodes.has(node.id) ? ChevronDown : ChevronRight" class="w-4 h-4" />
        </div>
      </div>

      <!-- Expanded Details / Actions -->
      <div 
        v-if="expandedNodes.has(node.id)" 
        class="border-t border-gray-100 p-3 bg-gray-50 space-y-3"
      >
        <div class="text-xs text-gray-600">
          <p class="mb-2"><span class="font-bold">ID:</span> <span class="font-mono text-[10px]">{{ node.id.substring(0, 8) }}</span></p>
        </div>

        <!-- Actions -->
        <div class="flex space-x-2 justify-end">
                <button 
                  @click.stop="emit('delete', node.id)"
                  class="px-2 py-1.5 bg-white border border-red-200 rounded text-xs text-red-600 hover:bg-red-50 shadow-sm transition-colors flex items-center"
                  :title="t('common.delete')"
                >
                  <Trash2 class="w-3.5 h-3.5 mr-1" />
                  {{ t('common.delete') }}
                </button>
                <button 
                  @click.stop="emit('switch', node.id)"
                  class="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-100 shadow-sm transition-colors flex items-center"
                >
                  <ArrowLeftRight class="w-3.5 h-3.5 mr-1" />
                  {{ t('version.compare') }} / {{ t('common.restore') }}
                </button>
            </div>
      </div>
    </div>
    </div>
  </div>
</template>

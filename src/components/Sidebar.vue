<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Block } from '../types/paper'
import { ChevronDown, ChevronRight, PlusSquare, MinusSquare } from 'lucide-vue-next'

const props = defineProps<{
  blocks: Block[]
  info: { title: string; author: string; school: string }
}>()

const emit = defineEmits<{
  (e: 'jump', blockId: string): void
  (e: 'change'): void
}>()

const isOutlineOpen = ref(true)
const isMetadataOpen = ref(true)
const collapsedIds = ref(new Set<string>())

// Filter only headings for the outline
const headings = (blocks: Block[]) => {
  return blocks.filter(b => b.type === 'heading')
}

// Build outline tree structure helper
const outlineData = computed(() => {
  const rawHeadings = headings(props.blocks)
  const hasChildrenMap = new Set<string>()
  const parentMap = new Map<string, string>()
  const stack: { level: number; id: string }[] = []

  // Pass 1: Identify relationships
  for (const block of rawHeadings) {
    const level = block.attrs?.level || 1
    
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }
    
    if (stack.length > 0) {
      const parent = stack[stack.length - 1]
      parentMap.set(block.id, parent.id)
      hasChildrenMap.add(parent.id)
    }
    
    stack.push({ level, id: block.id })
  }

  // Pass 2: Determine visibility
  const items: (Block & { hasChildren: boolean; isCollapsed: boolean; isVisible: boolean })[] = []
  
  for (const block of rawHeadings) {
    let visible = true
    let currentId = block.id
    
    // Check if any ancestor is collapsed
    // We start checking from the immediate parent
    let parentId = parentMap.get(currentId)
    while (parentId) {
      if (collapsedIds.value.has(parentId)) {
        visible = false
        break
      }
      parentId = parentMap.get(parentId)
    }

    items.push({
      ...block,
      hasChildren: hasChildrenMap.has(block.id),
      isCollapsed: collapsedIds.value.has(block.id),
      isVisible: visible
    })
  }

  return { items, hasChildrenMap }
})

const visibleItems = computed(() => outlineData.value.items.filter(i => i.isVisible))

const toggleCollapse = (id: string, event: MouseEvent) => {
  event.stopPropagation() // Prevent jumping when toggling
  const newSet = new Set(collapsedIds.value)
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  collapsedIds.value = newSet
}

const expandAll = (event: MouseEvent) => {
  event.stopPropagation()
  collapsedIds.value = new Set()
}

const collapseAll = (event: MouseEvent) => {
  event.stopPropagation()
  // Collapse all nodes that have children
  const newSet = new Set<string>()
  outlineData.value.hasChildrenMap.forEach(id => newSet.add(id))
  collapsedIds.value = newSet
}

const jumpToBlock = (blockId: string) => {
  console.log('[Sidebar] Jumping to block:', blockId)
  emit('jump', blockId)
}

const updateInfo = () => {
  emit('change')
}
</script>

<template>
  <div class="sidebar h-full bg-gray-50 flex flex-col">
    
    <!-- Metadata Section -->
    <div class="border-b border-gray-200 bg-white">
      <div 
        class="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100 select-none"
        @click="isMetadataOpen = !isMetadataOpen"
      >
        <component :is="isMetadataOpen ? ChevronDown : ChevronRight" class="w-4 h-4 text-gray-500 mr-2" />
        <span class="text-xs font-bold text-gray-700 uppercase">Metadata</span>
      </div>

      <div v-show="isMetadataOpen" class="p-3 space-y-2">
        <div>
          <label class="block text-xs text-gray-400">Title</label>
          <input 
            v-model="info.title" 
            @input="updateInfo"
            class="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
            placeholder="Paper Title"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-400">Author</label>
          <input 
            v-model="info.author" 
            @input="updateInfo"
            class="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
            placeholder="Author Name"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-400">School</label>
          <input 
            v-model="info.school" 
            @input="updateInfo"
            class="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
            placeholder="School / Affiliation"
          />
        </div>
      </div>
    </div>

    <!-- Outline Section -->
    <div class="border-b border-gray-200">
      <div 
        class="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 select-none"
        @click="isOutlineOpen = !isOutlineOpen"
      >
        <div class="flex items-center">
          <component :is="isOutlineOpen ? ChevronDown : ChevronRight" class="w-4 h-4 text-gray-500 mr-2" />
          <span class="text-xs font-bold text-gray-700 uppercase">Outline</span>
        </div>
        <!-- Expand/Collapse All Buttons -->
        <div v-if="isOutlineOpen" class="flex items-center space-x-1">
          <button @click.stop="expandAll" class="p-0.5 hover:bg-gray-200 rounded text-gray-500" title="Expand All">
            <PlusSquare class="w-3.5 h-3.5" />
          </button>
          <button @click.stop="collapseAll" class="p-0.5 hover:bg-gray-200 rounded text-gray-500" title="Collapse All">
            <MinusSquare class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      <div v-show="isOutlineOpen" class="flex-1 overflow-y-auto p-2 max-h-[50vh]">
        <div v-if="visibleItems.length === 0" class="text-gray-400 text-sm italic p-2">
          No headings found
        </div>
        <ul class="space-y-1">
          <li 
            v-for="block in visibleItems" 
            :key="block.id"
            class="group cursor-pointer hover:bg-gray-200 rounded py-1 text-sm truncate flex items-center"
            :class="{
              'pl-2': !block.attrs?.level || block.attrs.level === 1,
              'pl-4': block.attrs?.level === 2,
              'pl-6': block.attrs?.level && block.attrs.level >= 3,
              'font-bold': !block.attrs?.level || block.attrs.level === 1,
              'text-gray-600': block.attrs?.level && block.attrs.level >= 3
            }"
            @click="jumpToBlock(block.id)"
          >
            <!-- Toggle Icon -->
            <div 
              class="w-4 h-4 mr-1 flex-shrink-0 flex items-center justify-center rounded hover:bg-gray-300 transition-colors"
              :class="{ 'invisible': !block.hasChildren }"
              @click="toggleCollapse(block.id, $event)"
            >
              <component 
                :is="block.isCollapsed ? ChevronRight : ChevronDown" 
                class="w-3 h-3 text-gray-500" 
              />
            </div>
            
            <span class="truncate">{{ block.content || 'Untitled' }}</span>
          </li>
        </ul>
      </div>
    </div>

  </div>
</template>

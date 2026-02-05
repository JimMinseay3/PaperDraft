<script setup lang="ts">
import { ref } from 'vue'
import type { Block } from '../types/paper'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'

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

// Filter only headings for the outline
const headings = (blocks: Block[]) => {
  return blocks.filter(b => b.type === 'heading')
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
  <div class="sidebar h-full bg-gray-50 border-r border-gray-300 flex flex-col">
    
    <!-- Outline Section (Top) -->
    <div class="border-b border-gray-200">
      <div 
        class="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100 select-none"
        @click="isOutlineOpen = !isOutlineOpen"
      >
        <component :is="isOutlineOpen ? ChevronDown : ChevronRight" class="w-4 h-4 text-gray-500 mr-2" />
        <span class="text-xs font-bold text-gray-700 uppercase">Outline</span>
      </div>
      
      <div v-show="isOutlineOpen" class="flex-1 overflow-y-auto p-2 max-h-[50vh]">
        <div v-if="headings(blocks).length === 0" class="text-gray-400 text-sm italic p-2">
          No headings found
        </div>
        <ul class="space-y-1">
          <li 
            v-for="block in headings(blocks)" 
            :key="block.id"
            class="cursor-pointer hover:bg-gray-200 rounded px-2 py-1 text-sm truncate"
            :class="{
              'pl-2 font-bold': !block.attrs?.level || block.attrs.level === 1,
              'pl-4': block.attrs?.level === 2,
              'pl-6 text-gray-600': block.attrs?.level && block.attrs.level >= 3
            }"
            @click="jumpToBlock(block.id)"
          >
            {{ block.content }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Metadata Section (Bottom) -->
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

  </div>
</template>

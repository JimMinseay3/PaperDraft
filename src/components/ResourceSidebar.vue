<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Block } from '../types/paper'
import { ChevronDown, ChevronRight, Image as ImageIcon, Table as TableIcon } from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps<{
  blocks: Block[]
  assets: Record<string, string>
}>()

const isImagesOpen = ref(true)
const isTablesOpen = ref(true)

const resolveImageSrc = (block: Block) => {
  const src = block.attrs?.src || ''
  const fileName = block.attrs?.fileName
  
  // If we have a filename and it exists in assets map, use the base64 from assets
  if (fileName && props.assets[fileName]) {
    return props.assets[fileName]
  }
  
  // If src points to assets/ directory, try to resolve from assets map
  if (src.startsWith('assets/')) {
    const fname = src.split('/')[1]
    if (props.assets[fname]) {
      return props.assets[fname]
    }
  }
  
  return src
}

const extractedAssets = computed(() => {
  const images: Block[] = []
  const tables: Block[] = []
  
  const traverse = (nodes: Block[]) => {
    for (const node of nodes) {
      const type = node.type as string
      if (type === 'image') {
        images.push(node)
      } else if (type === 'table') {
        tables.push(node)
      }
      
      if (Array.isArray(node.content)) {
        traverse(node.content as Block[])
      }
    }
  }
  
  traverse(props.blocks)
  
  return { images, tables }
})
</script>

<template>
  <div class="h-full bg-gray-50 flex flex-col">
    <!-- Header -->
    <div class="p-3 border-b border-gray-200 bg-white">
      <h2 class="text-xs font-bold text-gray-700 uppercase">{{ t('resources.title') }}</h2>
    </div>

    <div class="flex-1 overflow-y-auto">
      <!-- Images Section -->
      <div class="border-b border-gray-200">
        <div 
          class="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100 select-none"
          @click="isImagesOpen = !isImagesOpen"
        >
          <component :is="isImagesOpen ? ChevronDown : ChevronRight" class="w-4 h-4 text-gray-500 mr-2" />
          <span class="text-xs font-bold text-gray-700 uppercase flex items-center">
            {{ t('resources.images') }}
            <span class="ml-2 px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full text-[10px]">{{ extractedAssets.images.length }}</span>
          </span>
        </div>
        
        <div v-show="isImagesOpen" class="p-2 bg-white">
          <div v-if="extractedAssets.images.length === 0" class="text-xs text-gray-400 italic px-2 py-1">
            {{ t('resources.noImages') }}
          </div>
          <div v-else class="grid grid-cols-2 gap-2">
            <div 
              v-for="img in extractedAssets.images" 
              :key="img.id"
              class="group relative aspect-square bg-gray-100 rounded border border-gray-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
            >
              <img 
                :src="resolveImageSrc(img)" 
                class="w-full h-full object-cover" 
                :alt="img.attrs?.caption || 'Image'"
              />
              <div class="absolute inset-x-0 bottom-0 bg-black/60 p-1 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                <p class="text-[10px] text-white truncate text-center">{{ img.attrs?.caption || img.attrs?.fileName || t('resources.untitledImage') }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tables Section -->
      <div class="border-b border-gray-200">
        <div 
          class="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100 select-none"
          @click="isTablesOpen = !isTablesOpen"
        >
          <component :is="isTablesOpen ? ChevronDown : ChevronRight" class="w-4 h-4 text-gray-500 mr-2" />
          <span class="text-xs font-bold text-gray-700 uppercase flex items-center">
            {{ t('resources.tables') }}
            <span class="ml-2 px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full text-[10px]">{{ extractedAssets.tables.length }}</span>
          </span>
        </div>
        
        <div v-show="isTablesOpen" class="p-2 bg-white">
          <div v-if="extractedAssets.tables.length === 0" class="text-xs text-gray-400 italic px-2 py-1">
            {{ t('resources.noTables') }}
          </div>
          <ul v-else class="space-y-1">
            <li 
              v-for="(tbl, index) in extractedAssets.tables" 
              :key="tbl.id"
              class="flex items-center px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer text-xs text-gray-700"
            >
              <TableIcon class="w-3.5 h-3.5 text-blue-500 mr-2" />
              <span class="truncate">{{ t('resources.table') }} {{ index + 1 }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

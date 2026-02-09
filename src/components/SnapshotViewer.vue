<script setup lang="ts">
import { computed } from 'vue'
import type { Block } from '../types/paper'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  blocks: Block[]
  assets: Record<string, string>
  allowRestore?: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'restore', block: Block): void
}>()

// Helper to get text from nested content
const getPlainText = (content: any): string => {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(item => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        if (item.text) return item.text
        if (item.content) return getPlainText(item.content)
      }
      return ''
    }).join('')
  }
  return ''
}

// Helper to resolve image src
const resolveSrc = (block: Block) => {
  if (block.type !== 'image') return ''
  const src = block.attrs?.src
  const fileName = block.attrs?.fileName
  
  // If we have a filename and it exists in assets, use it
  if (fileName && props.assets[fileName]) {
    return props.assets[fileName]
  }
  
  // Fallback to src if it's base64
  if (src && src.startsWith('data:')) return src
  
  // Fallback: try to find by value match (slow)
  return src || ''
}

</script>

<template>
  <div class="space-y-4 p-4">
    <div 
      v-for="block in blocks" 
      :key="block.id"
      class="group relative border border-transparent hover:border-blue-200 hover:bg-blue-50 rounded p-2 transition-all"
    >
      <!-- Restore Button (Visible on Hover) -->
      <button 
        v-if="allowRestore && !readonly"
        @click="emit('restore', block)"
        class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow hover:bg-blue-600 transition-opacity z-10"
      >
        {{ t('version.restoreBlock') || 'Restore' }}
      </button>

      <!-- Content Rendering -->
      <div class="pr-12"> <!-- Padding for button -->
        
        <!-- Heading -->
        <component 
          v-if="block.type === 'heading'" 
          :is="'h' + (block.attrs?.level || 1)"
          class="font-bold text-gray-800"
          :class="{
            'text-2xl': !block.attrs?.level || block.attrs.level === 1,
            'text-xl': block.attrs?.level === 2,
            'text-lg': block.attrs?.level === 3,
            'text-base': block.attrs?.level >= 4
          }"
        >
          {{ getPlainText(block.content) }}
        </component>

        <!-- Paragraph -->
        <p v-else-if="block.type === 'paragraph'" class="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {{ getPlainText(block.content) || (block.content === '' ? '&nbsp;' : '') }}
        </p>

        <!-- Image -->
        <div v-else-if="block.type === 'image'" class="flex flex-col items-center">
          <img 
            :src="resolveSrc(block)" 
            class="max-w-full h-auto rounded shadow-sm max-h-[300px]" 
            :title="block.attrs?.title"
          />
          <div v-if="block.attrs?.caption" class="text-center text-xs text-gray-500 mt-2">
            {{ getPlainText(block.attrs.caption) }}
          </div>
        </div>

        <!-- List -->
        <div v-else-if="block.type === 'list'" class="pl-4">
           <li class="list-disc text-gray-700">{{ getPlainText(block.content) }}</li>
        </div>
        
        <!-- Fallback -->
        <div v-else class="text-gray-400 text-xs italic">
          [{{ block.type }}] {{ getPlainText(block.content) || 'Complex content' }}
        </div>

      </div>
    </div>
  </div>
</template>

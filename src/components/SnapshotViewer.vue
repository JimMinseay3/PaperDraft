<script setup lang="ts">
import { computed } from 'vue'
import type { Block } from '../types/paper'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  blocks: Block[]
  assets: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'restore', block: Block): void
}>()

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
          {{ block.content }}
        </component>

        <!-- Paragraph -->
        <p v-else-if="block.type === 'paragraph'" class="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {{ block.content || (block.content === '' ? '&nbsp;' : '') }}
        </p>

        <!-- Image -->
        <div v-else-if="block.type === 'image'" class="flex justify-center">
          <img 
            :src="resolveSrc(block)" 
            class="max-w-full h-auto rounded shadow-sm max-h-[300px]" 
            :title="block.attrs?.title"
          />
          <div v-if="block.attrs?.caption" class="text-center text-xs text-gray-500 mt-1">
            {{ block.attrs.caption }}
          </div>
        </div>

        <!-- List (Simplified) -->
        <div v-else-if="block.type === 'list'" class="pl-4">
           <!-- Note: TipTap lists are complex recursive structures. 
                Our 'Block' type might need adjustment if we store lists as flat blocks or nested.
                Assuming flat block for now or simple text content.
                If complex, we might just show "List Item".
           -->
           <li class="list-disc">{{ block.content }}</li>
        </div>
        
        <!-- Fallback -->
        <div v-else class="text-gray-400 text-xs italic">
          [{{ block.type }}] {{ typeof block.content === 'string' ? block.content : 'Complex content' }}
        </div>

      </div>
    </div>
  </div>
</template>

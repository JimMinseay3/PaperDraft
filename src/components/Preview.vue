<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Eye } from 'lucide-vue-next'

const { t } = useI18n()

defineProps<{
  pdfUrl: string | null
  loading: boolean
}>()
</script>

<template>
  <div class="preview-container h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="h-10 px-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
      <h2 class="text-xs font-bold text-gray-700 uppercase flex items-center">
        <Eye class="w-4 h-4 mr-2 text-blue-500" />
        {{ t('activityBar.preview') }}
      </h2>
      <span v-if="loading" class="text-xs text-blue-600 animate-pulse">Rendering...</span>
    </div>
    
    <div class="flex-1 overflow-hidden relative">
      <div v-if="!pdfUrl" class="absolute inset-0 flex items-center justify-center text-gray-400">
        No preview available
      </div>
      <iframe 
        v-else 
        :src="pdfUrl" 
        type="application/pdf"
        class="w-full h-full border-none"
      ></iframe>
    </div>
  </div>
</template>

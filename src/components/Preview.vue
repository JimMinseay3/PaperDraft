<script setup lang="ts">
defineProps<{
  pdfUrl: string | null
  loading: boolean
}>()
</script>

<template>
  <div class="preview-container h-full flex flex-col bg-gray-100">
    <div class="p-2 bg-gray-200 border-b border-gray-300 flex justify-between items-center">
      <span class="font-bold text-sm text-gray-700">Copilot / Preview</span>
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

<script setup lang="ts">
import { 
  Files, 
  Search, 
  Eye, 
  GitBranch, 
  Package, 
  Settings 
} from 'lucide-vue-next'

const props = defineProps<{
  activeView: string
  showPreview: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-preview'): void
  (e: 'change-view', view: string): void
}>()

const menuItems = [
  { id: 'file', icon: Files, title: 'File' },
  { id: 'search', icon: Search, title: 'Search' },
  { id: 'resources', icon: Package, title: 'Resource Explorer' },
  { id: 'version', icon: GitBranch, title: 'Version Management' },
  { id: 'preview', icon: Eye, title: 'Preview' },
]

const handleClick = (id: string) => {
  if (id === 'preview') {
    emit('toggle-preview')
  } else {
    emit('change-view', id)
  }
}

const isActive = (id: string) => {
  if (id === 'preview') return props.showPreview
  return props.activeView === id
}
</script>

<template>
  <div class="h-full bg-gray-900 flex flex-col items-center py-4 space-y-4">
    
    <div 
      v-for="item in menuItems" 
      :key="item.id"
      class="w-7 h-7 rounded cursor-pointer transition-colors flex items-center justify-center"
      :class="isActive(item.id) ? 'bg-gray-800 text-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'"
      :title="item.title"
      @click="handleClick(item.id)"
    >
      <component :is="item.icon" :size="18" class="w-[18px] h-[18px]" stroke-width="2" />
    </div>

    <!-- Settings (Bottom) -->
    <div class="flex-1"></div>
    <div class="w-7 h-7 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 cursor-pointer transition-colors flex items-center justify-center" title="Settings">
      <Settings :size="18" class="w-[18px] h-[18px]" stroke-width="2" />
    </div>
  </div>
</template>

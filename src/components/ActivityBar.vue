<script setup lang="ts">
import { 
  Files, 
  Search, 
  Eye, 
  Clock, 
  Package, 
  Settings,
  BookOpen,
  Type
} from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  activeView: string
  showPreview: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-preview'): void
  (e: 'change-view', view: string): void
}>()

const topMenuItems = computed(() => [
  { id: 'file', icon: Files, title: t('activityBar.file') },
  { id: 'search', icon: Search, title: t('activityBar.search') },
  { id: 'citations', icon: BookOpen, title: t('activityBar.citations') },
  { id: 'resources', icon: Package, title: t('activityBar.resources') },
  { id: 'typography', icon: Type, title: t('activityBar.typography') },
  { id: 'version', icon: Clock, title: t('activityBar.version') },
  { id: 'preview', icon: Eye, title: t('activityBar.preview') },
])

const bottomMenuItems = computed(() => [
  { id: 'settings', icon: Settings, title: t('activityBar.settings') },
])

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
  <div class="h-full bg-gray-900 flex flex-col items-center py-4">
    <!-- Top Items -->
    <div class="flex flex-col items-center space-y-4 w-full">
      <div 
        v-for="item in topMenuItems" 
        :key="item.id"
        class="w-7 h-7 rounded cursor-pointer transition-colors flex items-center justify-center"
        :class="isActive(item.id) ? 'bg-gray-800 text-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'"
        :title="item.title"
        @click="handleClick(item.id)"
      >
        <component :is="item.icon" :size="18" class="w-[18px] h-[18px]" stroke-width="2" />
      </div>
    </div>

    <!-- Spacer -->
    <div class="flex-1"></div>

    <!-- Bottom Items -->
    <div class="flex flex-col items-center space-y-4 w-full">
      <div 
        v-for="item in bottomMenuItems" 
        :key="item.id"
        class="w-7 h-7 rounded cursor-pointer transition-colors flex items-center justify-center"
        :class="isActive(item.id) ? 'bg-gray-800 text-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'"
        :title="item.title"
        @click="handleClick(item.id)"
      >
        <component :is="item.icon" :size="18" class="w-[18px] h-[18px]" stroke-width="2" />
      </div>
    </div>
  </div>
</template>

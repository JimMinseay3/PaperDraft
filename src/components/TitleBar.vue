<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ipcRenderer } from 'electron'
import { PanelLeft, Settings, User } from 'lucide-vue-next'

const isMaximized = ref(false)
const activeMenu = ref<string | null>(null)

const emit = defineEmits<{
  (e: 'open'): void
  (e: 'save'): void
  (e: 'toggle-assistant'): void
}>()

const minimize = () => {
  ipcRenderer.invoke('window-minimize')
}

const maximize = async () => {
  const result = await ipcRenderer.invoke('window-maximize')
  isMaximized.value = result
}

const close = () => {
  ipcRenderer.invoke('window-close')
}

const toggleMenu = (menu: string) => {
  if (activeMenu.value === menu) {
    activeMenu.value = null
  } else {
    activeMenu.value = menu
  }
}

const closeMenu = () => {
  activeMenu.value = null
}

const handleAction = (action: 'open' | 'save') => {
  if (action === 'open') emit('open')
  else if (action === 'save') emit('save')
  closeMenu()
}

// Close menu when clicking outside
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.menu-trigger') && !target.closest('.menu-dropdown')) {
    closeMenu()
  }
}

onMounted(async () => {
  ipcRenderer.on('window-maximized', (_, value) => {
    isMaximized.value = value
  })
  
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="h-8 bg-gray-900 text-gray-300 flex items-center justify-between select-none draggable-region w-full relative z-50 border-b border-gray-800">
    <!-- Left: Icon & Title & Menu -->
    <div class="flex items-center px-3 space-x-3 h-full min-w-[300px]">
      <!-- App Icon & Title -->
      <div class="flex items-center space-x-2 mr-2">
        <div class="w-4 h-4 bg-blue-500 rounded-sm"></div>
        <span class="text-xs font-medium text-gray-400">PaperDraft</span>
      </div>

      <!-- Menu Bar -->
      <div class="flex h-full no-drag-region text-xs">
        <!-- File Menu -->
        <div class="relative h-full">
          <button 
            @click.stop="toggleMenu('file')" 
            class="menu-trigger h-full px-2 hover:bg-gray-700 rounded-sm focus:outline-none flex items-center transition-colors"
            :class="{ 'bg-gray-700 text-white': activeMenu === 'file' }"
          >
            File(F)
          </button>
          
          <!-- Dropdown -->
          <div v-if="activeMenu === 'file'" class="menu-dropdown absolute top-full left-0 w-48 bg-gray-800 border border-gray-700 shadow-2xl rounded-b-sm py-1 z-50 text-gray-200">
            <div 
              @click="handleAction('open')" 
              class="px-4 py-1.5 hover:bg-blue-600 cursor-pointer flex justify-between items-center group"
            >
              <span>Open File...</span>
              <span class="text-gray-500 text-[10px] group-hover:text-gray-300">Ctrl+O</span>
            </div>
            <div 
              @click="handleAction('save')" 
              class="px-4 py-1.5 hover:bg-blue-600 cursor-pointer flex justify-between items-center group"
            >
              <span>Save Project</span>
              <span class="text-gray-500 text-[10px] group-hover:text-gray-300">Ctrl+S</span>
            </div>
            <div class="my-1 border-t border-gray-700"></div>
            <div 
              @click="close" 
              class="px-4 py-1.5 hover:bg-red-600 cursor-pointer flex justify-between items-center group"
            >
              <span>Exit</span>
              <span class="text-gray-500 text-[10px] group-hover:text-gray-300">Alt+F4</span>
            </div>
          </div>
        </div>

        <!-- Placeholder Menus -->
        <button class="h-full px-2 hover:bg-gray-700 rounded-sm focus:outline-none flex items-center text-gray-500 cursor-not-allowed">Edit(E)</button>
        <button class="h-full px-2 hover:bg-gray-700 rounded-sm focus:outline-none flex items-center text-gray-500 cursor-not-allowed">View(V)</button>
        <button class="h-full px-2 hover:bg-gray-700 rounded-sm focus:outline-none flex items-center text-gray-500 cursor-not-allowed">Help(H)</button>
      </div>
    </div>

    <!-- Center: Search Bar -->
    <div class="flex-1 flex justify-center no-drag-region px-4 max-w-[500px]">
      <div class="relative w-full group">
        <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
          <svg class="h-3.5 w-3.5 text-gray-500 group-focus-within:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input 
          type="text" 
          placeholder="Search for command or content..."
          class="w-full bg-gray-800 border border-gray-700 rounded-md py-0.5 pl-8 pr-3 text-[11px] text-gray-300 focus:outline-none focus:bg-gray-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder-gray-600"
        />
      </div>
    </div>

    <!-- Right: Trae-like Controls & Window Controls -->
    <div class="flex h-full no-drag-region items-center">
      <!-- Trae Controls (Sidebar, Settings, User) -->
      <div class="flex items-center space-x-1 mr-2 border-r border-gray-700 pr-2 h-4/5">
        <button 
          @click="emit('toggle-assistant')"
          class="w-8 h-full flex items-center justify-center text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-sm transition-colors focus:outline-none" 
          title="Toggle Assistant"
        >
          <PanelLeft class="w-3.5 h-3.5" stroke-width="2" />
        </button>
        <button class="w-8 h-full flex items-center justify-center text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-sm transition-colors focus:outline-none" title="Settings">
          <Settings class="w-3.5 h-3.5" stroke-width="2" />
        </button>
        <button class="w-8 h-full flex items-center justify-center text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-sm transition-colors focus:outline-none" title="User">
          <User class="w-3.5 h-3.5" stroke-width="2" />
        </button>
      </div>

      <!-- Window Controls -->
      <div class="flex h-full min-w-[120px] justify-end">
      <!-- Minimize -->
      <button @click="minimize" class="w-10 h-full flex items-center justify-center hover:bg-gray-700 transition-colors focus:outline-none" title="Minimize">
        <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
          <rect width="10" height="1" />
        </svg>
      </button>

      <!-- Maximize / Restore -->
      <button @click="maximize" class="w-10 h-full flex items-center justify-center hover:bg-gray-700 transition-colors focus:outline-none" :title="isMaximized ? 'Restore' : 'Maximize'">
        <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="1.5" y="1.5" width="7" height="7" />
        </svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="3.5" y="1.5" width="5" height="5" />
          <path d="M1.5 3.5V8.5H6.5" />
        </svg>
      </button>

      <!-- Close -->
      <button @click="close" class="w-10 h-full flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors focus:outline-none" title="Close">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M1 1L9 9" />
          <path d="M9 1L1 9" />
        </svg>
      </button>
    </div>
  </div>
</div>
</template>

<style scoped>
.draggable-region {
  -webkit-app-region: drag;
}
.no-drag-region {
  -webkit-app-region: no-drag;
}
</style>

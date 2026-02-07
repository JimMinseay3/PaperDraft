<script setup lang="ts">
import { ref, watch } from 'vue'
import { BookOpen } from 'lucide-vue-next'
import type { Reference } from '../types/paper'

const props = defineProps<{
  items: Reference[]
  command: (item: { id: string, label: string }) => void
}>()

const selectedIndex = ref(0)

const selectItem = (index: number) => {
  const item = props.items[index]
  if (item) {
    // Use ID as label for now (e.g. [Smith2023])
    // Ideally this would be a dynamic number, but that requires full document analysis
    props.command({ id: item.id, label: item.id })
  }
}

watch(() => props.items, () => {
  selectedIndex.value = 0
})

const onUpHandler = () => {
  selectedIndex.value = ((selectedIndex.value + props.items.length) - 1) % props.items.length
}

const onDownHandler = () => {
  selectedIndex.value = (selectedIndex.value + 1) % props.items.length
}

const onEnterHandler = () => {
  selectItem(selectedIndex.value)
}

defineExpose({
  onKeyDown: (props: { event: KeyboardEvent }) => {
    if (props.event.key === 'ArrowUp') {
      onUpHandler()
      return true
    }
    if (props.event.key === 'ArrowDown') {
      onDownHandler()
      return true
    }
    if (props.event.key === 'Enter') {
      onEnterHandler()
      return true
    }
    return false
  },
})
</script>

<template>
  <div class="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-[9999] w-72 max-h-64 flex flex-col">
    <div class="text-[10px] font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
      Select Citation
    </div>
    <div class="overflow-y-auto">
      <template v-if="items.length">
        <button
          v-for="(item, index) in items"
          :key="item.id"
          :class="{ 'bg-blue-50': index === selectedIndex }"
          @click="selectItem(index)"
          class="flex flex-col w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
        >
          <div class="flex items-start">
            <BookOpen class="w-3.5 h-3.5 mt-0.5 mr-2 text-blue-500 flex-shrink-0" />
            <span class="text-xs font-medium text-gray-800 line-clamp-2">{{ item.title }}</span>
          </div>
          <div class="ml-5 mt-0.5 text-[10px] text-gray-500 truncate">
            {{ item.author }} ({{ item.year }})
          </div>
        </button>
      </template>
      <div v-else class="px-3 py-4 text-center text-xs text-gray-500 italic">
        No matching citations found
      </div>
    </div>
  </div>
</template>

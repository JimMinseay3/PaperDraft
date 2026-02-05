<script setup lang="ts">
import { ref } from 'vue'
import { 
  Type, 
  Heading1, 
  Heading2, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Code 
} from 'lucide-vue-next'

const props = defineProps<{
  items: any[]
  command: (item: any) => void
}>()

const selectedIndex = ref(0)

const selectItem = (index: number) => {
  const item = props.items[index]
  if (item) {
    props.command(item)
  }
}

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
  <div class="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-[9999] w-48 p-1 flex flex-col">
    <div class="text-[10px] font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">Basic Blocks</div>
    <template v-if="items.length">
      <button
        v-for="(item, index) in items"
        :key="index"
        :class="{ 'bg-gray-100': index === selectedIndex }"
        @click="selectItem(index)"
        class="flex items-center w-full px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded text-left transition-colors"
      >
        <component :is="item.icon" class="w-4 h-4 mr-2 text-gray-500" />
        <span>{{ item.title }}</span>
      </button>
    </template>
    <div v-else class="px-2 py-1.5 text-sm text-gray-500 italic">
      No results
    </div>
  </div>
</template>

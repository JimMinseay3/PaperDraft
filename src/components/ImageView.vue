<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed, ref } from 'vue'
import { Trash2 } from 'lucide-vue-next'

const props = defineProps(nodeViewProps)

const src = computed(() => props.node.attrs.src)
const caption = computed({
  get: () => props.node.attrs.caption,
  set: (value) => props.updateAttributes({ caption: value })
})

const deleteNode = () => {
  props.deleteNode()
}

const isSelected = computed(() => props.selected)
</script>

<template>
  <node-view-wrapper class="image-view group relative flex flex-col items-center my-4">
    <div 
      class="relative"
      :class="{ 'ring-2 ring-blue-500': isSelected }"
    >
      <img 
        :src="src" 
        class="max-w-full h-auto rounded shadow-sm"
        :title="props.node.attrs.title"
      />
      
      <!-- Delete button (visible on hover or selected) -->
      <button 
        class="absolute top-2 right-2 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        @click="deleteNode"
        title="Delete Image"
      >
        <Trash2 class="w-4 h-4" />
      </button>
    </div>

    <!-- Caption Input -->
    <input 
      v-model="caption"
      class="mt-2 text-center text-sm text-gray-500 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent w-full max-w-md transition-colors placeholder-gray-300"
      placeholder="Type caption here..." 
    />
  </node-view-wrapper>
</template>

<style scoped>
.image-view {
  /* Ensure it takes full width of container if needed, but centers content */
  width: 100%;
}
</style>
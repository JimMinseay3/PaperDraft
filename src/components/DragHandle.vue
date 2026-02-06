<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Editor } from '@tiptap/vue-3'
import { GripVertical } from 'lucide-vue-next'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { DOMSerializer } from '@tiptap/pm/model'

const props = defineProps<{
  editor: Editor
}>()

const menuRef = ref<HTMLElement | null>(null)
const currentNodePos = ref<number | null>(null)
const top = ref(0)
const left = ref(0)
const visible = ref(false)
const isDragging = ref(false)

const handleMouseMove = (event: MouseEvent) => {
  if (!props.editor || isDragging.value) return

  const view = props.editor.view
  const coords = { left: event.clientX, top: event.clientY }
  
  const posResult = view.posAtCoords(coords)
  if (!posResult) return

  let { pos } = posResult
  if (pos === null || pos === undefined) return
  
  const $pos = view.state.doc.resolve(pos)
  
  let depth = $pos.depth
  
  // Safety check: Cannot interact with root node (depth 0) or if depth is invalid
  if (depth === 0) {
      visible.value = false
      return
  }

  let nodePos = $pos.before(depth)
  let node = $pos.node(depth)

  // Walk up to find the direct child of doc (depth 1)
  while (depth > 1) {
    depth--
    node = $pos.node(depth)
    nodePos = $pos.before(depth)
  }
  
  // Ensure we are at depth 1 (block level)
  if (depth !== 1 || !node) {
     // Fallback or ignore
     // visible.value = false
     // return
  }

  if (node) {
    const domNode = view.nodeDOM(nodePos) as HTMLElement
    if (domNode && domNode.getBoundingClientRect) {
      const rect = domNode.getBoundingClientRect()
      
      // Calculate relative position to the editor container
      // The DragHandle is placed inside .editor-container which is relative
      // We can find the container via the view.dom (which is inside it)
      const container = view.dom.closest('.editor-container')
      if (container) {
          const containerRect = container.getBoundingClientRect()
          top.value = rect.top - containerRect.top
          left.value = rect.left - containerRect.left - 24
      } else {
          // Fallback to fixed if container not found (shouldn't happen)
          top.value = rect.top
          left.value = rect.left - 24
      }

      currentNodePos.value = nodePos
      visible.value = true
    }
  }
}

const onDragStart = (event: DragEvent) => {
  if (!props.editor || currentNodePos.value === null) return
  
  isDragging.value = true
  const view = props.editor.view
  const pos = currentNodePos.value
  const node = view.state.doc.nodeAt(pos)
  
  if (!node) return

  // Select the node
  props.editor.commands.setNodeSelection(pos)
  
  // Set Drag Image
  const domNode = view.nodeDOM(pos) as HTMLElement
  if (domNode) {
     // Clone the node to remove margin/padding issues for the ghost image if needed
     // But default is usually fine
     event.dataTransfer?.setDragImage(domNode, 0, 0)
  }

  // Set Data
  (window as any).__draggedNodePos = pos
  event.dataTransfer?.setData('trae-drag-handle', 'true')
  event.dataTransfer?.setData('text/plain', node.textContent)
  
  // Serialize to HTML for compatibility
  const serializer = DOMSerializer.fromSchema(view.state.schema)
  const fragment =  view.state.doc.slice(pos, pos + node.nodeSize).content
  const div = document.createElement('div')
  serializer.serializeFragment(fragment, { document: document }, div)
  
  event.dataTransfer?.setData('text/html', div.innerHTML)
  event.dataTransfer?.setData('text/uri-list', '') // Sometimes helps

  // HACK: Tell ProseMirror we are dragging this content to enable "move" behavior
  // This allows the default drop handler to treat it as an internal move (delete source, insert target)
  const slice = NodeSelection.create(view.state.doc, pos).content()
  ;(view as any).dragging = { slice, move: true }
}



const onDragEnd = () => {
  isDragging.value = false
  currentNodePos.value = null
  visible.value = false
  ;(window as any).__draggedNodePos = null
}

defineExpose({
  handleMouseMove
})
</script>

<template>
  <div 
    ref="menuRef"
    v-show="visible"
    class="absolute z-50 cursor-grab flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
    :style="{ 
      top: `${top}px`, 
      left: `${left}px`,
      width: '20px',
      height: '24px'
    }"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <GripVertical :size="16" />
  </div>
</template>

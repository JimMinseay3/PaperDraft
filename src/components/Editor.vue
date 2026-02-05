<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import SlashCommand from './SlashCommandExtension'
import ImageExtension from './ImageExtension'
import { watch, onBeforeUnmount, ref } from 'vue'
import { 
  Plus, 
  Type, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Code, 
  Image as ImageIcon,
  Bold,
  Italic,
  Strikethrough,
  Highlighter
} from 'lucide-vue-next'
import type { Block } from '../types/paper'

// const lowlight = createLowlight(common)

const props = defineProps<{
  modelValue: Block[]
  assets?: Record<string, string> // Map of filename -> base64
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Block[]): void
  (e: 'change'): void
  (e: 'add-asset', filename: string, base64: string): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)

// Helper to map TipTap JSON to our Block structure
const mapTipTapToBlocks = (json: any): Block[] => {
  if (!json.content) return []
  
  return json.content.map((node: any) => {
    // CRITICAL: Keep existing ID if present in node attrs
    const id = node.attrs?.id || `b${Date.now()}${Math.random().toString(36).substr(2, 5)}`
    let attrs = { ...node.attrs, id } // Ensure ID is in attrs
    
    let type: Block['type'] = 'paragraph'
    if (node.type === 'heading') type = 'heading'
    else if (node.type === 'image') type = 'image'
    else if (node.type === 'bulletList') { type = 'list'; attrs.listType = 'bullet' }
    else if (node.type === 'orderedList') { type = 'list'; attrs.listType = 'ordered' }
    else if (node.type === 'taskList') { type = 'list'; attrs.listType = 'task' }
    else if (node.type === 'codeBlock') type = 'code'

    // Handle Image Assets
    if (type === 'image') {
      // 1. Try to use fileName directly if available (Most reliable)
      if (attrs.fileName) {
        attrs.src = `assets/${attrs.fileName}`
      } 
      // 2. Fallback: Try to match Base64 in assets (Slow, but necessary for backward compatibility)
      else if (attrs.src && attrs.src.startsWith('data:') && props.assets) {
         for (const [filename, base64] of Object.entries(props.assets)) {
           if (attrs.src === base64) {
             attrs.src = `assets/${filename}`
             // Backfill fileName for future
             attrs.fileName = filename
             break
           }
         }
      }
    }

    return {
      id,
      type,
      content: node.content?.[0]?.text || node.content || '',
      attrs
    }
  })
}

// Helper to map our Blocks to TipTap JSON
const mapBlocksToTipTap = (blocks: Block[]) => {
  return {
    type: 'doc',
    content: blocks.map(block => {
      let nodeType: string = block.type
      if (block.type === 'list') {
        nodeType = block.attrs?.listType === 'ordered' ? 'orderedList' 
          : block.attrs?.listType === 'task' ? 'taskList' 
          : 'bulletList'
      } else if (block.type === 'code') {
        nodeType = 'codeBlock'
      }

      // CRITICAL: Ensure the ID from our block is passed into TipTap's attributes
      const node: any = {
        type: nodeType,
        attrs: { ...block.attrs, id: block.id }
      }
      
      if (typeof block.content === 'string') {
        // Only add content if there is actually text, to avoid "Empty text nodes" error
        if (block.content.length > 0) {
          node.content = [{ type: 'text', text: block.content }]
        }
      } else if (Array.isArray(block.content)) {
        node.content = block.content
      }
      
      if (block.type === 'image') {
          let src = block.attrs?.src || ''
          if (src.startsWith('assets/') && props.assets) {
              const filename = src.split('/')[1]
              if (props.assets[filename]) {
                  src = props.assets[filename]
                  node.attrs.fileName = filename
              }
          }
          node.attrs.src = src
          delete node.content
      }
      
      return node
    })
  }
}

// Custom extension to add ID attribute to all block nodes
const GlobalId = Extension.create({
  name: 'globalId',
  addGlobalAttributes() {
    return [
      {
        types: ['heading', 'paragraph', 'bulletList', 'orderedList', 'taskList', 'image', 'codeBlock'],
        attributes: {
          id: {
            default: null,
            parseHTML: element => element.getAttribute('id'),
            renderHTML: attributes => {
              if (!attributes.id) return {}
              return { id: attributes.id }
            },
          },
        },
      },
    ]
  },
})

const editor = useEditor({
  content: mapBlocksToTipTap(props.modelValue),
  extensions: [
    StarterKit.configure({
      heading: {
        HTMLAttributes: {
          class: 'heading-node',
        },
      },
      paragraph: {
        HTMLAttributes: {
          class: 'paragraph-node',
        },
      },
      bulletList: {
        HTMLAttributes: {
          class: 'bullet-list-node',
        },
      },
      orderedList: {
        HTMLAttributes: {
          class: 'ordered-list-node',
        },
      },
      codeBlock: {
        HTMLAttributes: {
          class: 'code-block-node',
        },
      },
    }),
    GlobalId,
    ImageExtension.configure({
        allowBase64: true,
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') {
          return 'Heading ' + node.attrs.level
        }
        return 'Type \'/\' for commands...'
      },
    }),
    Highlight,
    SlashCommand,
    BubbleMenuExtension,
    Extension.create({
      name: 'imageUpload',
      addCommands() {
        return {
          triggerImageUpload: () => () => {
            fileInput.value?.click()
            return true
          }
        }
      }
    })
  ],
  onUpdate: ({ editor }) => {
    // 1. Enforce unique IDs directly in the editor state
    const { doc } = editor.state
    const seenIds = new Set<string>()
    const transactions: { pos: number, id: string }[] = []

    doc.descendants((node, pos) => {
      if (node.attrs.id) {
        if (seenIds.has(node.attrs.id)) {
          // Found duplicate, generate new ID
          const newId = `b${Date.now()}${Math.random().toString(36).substr(2, 5)}`
          transactions.push({ pos, id: newId })
        } else {
          seenIds.add(node.attrs.id)
        }
      }
    })

    if (transactions.length > 0) {
      console.log('[Editor] Found duplicates, fixing IDs:', transactions)
      const tr = editor.state.tr
      transactions.forEach(({ pos, id }) => {
        tr.setNodeMarkup(pos, undefined, { ...doc.nodeAt(pos)?.attrs, id })
      })
      editor.view.dispatch(tr)
      // Return early, the update will trigger again with unique IDs
      return
    }

    // 2. Map to blocks and emit
    const json = editor.getJSON()
    const blocks = mapTipTapToBlocks(json)
    emit('update:modelValue', blocks)
    emit('change')
  },
})

const isNavigating = ref(false)

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  if (editor.value && !editor.value.isFocused && !isNavigating.value) {
     editor.value.commands.setContent(mapBlocksToTipTap(newValue))
  }
}, { deep: true })

onBeforeUnmount(() => {
  editor.value?.destroy()
})

// Handle image upload
const handleImageUpload = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      if (base64) {
        // Generate a unique ID for the asset
        const ext = file.name.split('.').pop() || 'png'
        const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`
        
        // Emit to parent to store the asset
        emit('add-asset', filename, base64)
        
        // Insert into editor
        // We assume parent updates props.assets quickly enough or we rely on the base64 for now
        editor.value?.chain().focus().setImage({ src: base64 }).run()
        
        // Reset input
        input.value = ''
      }
    }
    reader.readAsDataURL(file)
  }
}

const scrollToBlock = (blockId: string) => {
  console.log('[Editor] scrollToBlock called with ID:', blockId)
  if (!editor.value) {
    console.error('[Editor] TipTap editor instance is null')
    return
  }
  
  // Set navigating flag to prevent watch interference
  isNavigating.value = true

  // 1. Find the position in the editor's state
  const { doc } = editor.value.state
  let pos = -1
  const allIds: string[] = []
  
  doc.descendants((node, p) => {
    if (node.attrs?.id) {
      allIds.push(node.attrs.id)
    }
    if (node.attrs?.id === blockId) {
      pos = p
      return false
    }
    return true
  })
  
  console.log('[Editor] All IDs in doc:', allIds)
  console.log('[Editor] Target ID:', blockId)
  console.log('[Editor] Found position:', pos)
  
  // 2. Perform the jump
  if (pos !== -1) {
    // Resolve position to ensure it's inside the text block for text nodes, or on the node for others
    const node = doc.nodeAt(pos)
    if (node && node.isTextblock) {
        editor.value.commands.setTextSelection(pos + 1)
    } else {
        editor.value.commands.setNodeSelection(pos)
    }
    
    // Scroll using TipTap's native view method if possible, or fallback to DOM
    // We wait a tick to ensure the DOM has updated with the ID attribute
    setTimeout(() => {
      // FORCE SYNC: If pos is found but ID is missing in doc, try to re-map
      if (pos !== -1 && allIds.length === 0) {
        console.log('[Editor] Emergency: Pos found but IDs missing. Re-applying content...')
        editor.value?.commands.setContent(mapBlocksToTipTap(props.modelValue))
      }

      // Search specifically inside the editor container
      const editorElement = editor.value?.view.dom
      const element = editorElement?.querySelector(`[id="${blockId}"]`) || document.getElementById(blockId)
      
      console.log('[Editor] Found DOM element:', element)
      
      if (element) {
        // Use auto behavior for instant jump to avoid scroll interruptions
        element.scrollIntoView({ behavior: 'auto', block: 'center' })
        
        // Focus AFTER scrolling to prevent browser from scrolling to top first
        editor.value?.commands.focus()

        // Add a temporary highlight effect to show where we jumped
        const originalBg = (element as HTMLElement).style.backgroundColor
        ;(element as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
        setTimeout(() => {
          ;(element as HTMLElement).style.backgroundColor = originalBg
        }, 1000)
      } else {
        console.warn('[Editor] DOM element not found for ID, falling back to scrollIntoView()')
        // Fallback: use TipTap's internal scroll
        editor.value?.commands.scrollIntoView()
        editor.value?.commands.focus()
      }
      
      // Reset navigating flag
      setTimeout(() => {
        isNavigating.value = false
      }, 100)
    }, 50)
  } else {
    console.error('[Editor] Could not find node with ID in current document state')
    isNavigating.value = false
  }
}

defineExpose({
  scrollToBlock
})
</script>

<template>
  <div class="editor-wrapper h-full bg-white overflow-y-auto">
    <div class="editor-container max-w-4xl mx-auto py-12 px-16 min-h-full relative">
      <bubble-menu 
        v-if="editor" 
        :editor="editor" 
        :tippy-options="{ duration: 100 }"
        class="flex bg-gray-900 text-white rounded-lg shadow-xl overflow-hidden divide-x divide-gray-700 p-1"
      >
        <button 
          @click="editor.chain().focus().toggleBold().run()" 
          :class="{ 'bg-gray-700': editor.isActive('bold') }"
          class="p-1.5 hover:bg-gray-700 rounded transition-colors"
        >
          <Bold class="w-4 h-4" />
        </button>
        <button 
          @click="editor.chain().focus().toggleItalic().run()" 
          :class="{ 'bg-gray-700': editor.isActive('italic') }"
          class="p-1.5 hover:bg-gray-700 rounded transition-colors"
        >
          <Italic class="w-4 h-4" />
        </button>
        <button 
          @click="editor.chain().focus().toggleStrike().run()" 
          :class="{ 'bg-gray-700': editor.isActive('strike') }"
          class="p-1.5 hover:bg-gray-700 rounded transition-colors"
        >
          <Strikethrough class="w-4 h-4" />
        </button>
        <button 
          @click="editor.chain().focus().toggleHighlight().run()" 
          :class="{ 'bg-gray-700': editor.isActive('highlight') }"
          class="p-1.5 hover:bg-gray-700 rounded transition-colors"
        >
          <Highlighter class="w-4 h-4" />
        </button>
        <button 
          @click="editor.chain().focus().toggleCode().run()" 
          :class="{ 'bg-gray-700': editor.isActive('code') }"
          class="p-1.5 hover:bg-gray-700 rounded transition-colors"
        >
          <Code class="w-4 h-4" />
        </button>
      </bubble-menu>

      <editor-content :editor="editor" class="prose prose-slate max-w-none outline-none" />

      <!-- Hidden file input for image upload -->
      <input 
        type="file" 
        ref="fileInput" 
        class="hidden" 
        accept="image/*" 
        @change="handleImageUpload"
      />
    </div>
  </div>
</template>

<style>
/* TipTap Editor Styles */
.ProseMirror {
  outline: none;
  min-height: 500px;
}

/* Remove default heading borders from prose */
.ProseMirror h1, 
.ProseMirror h2, 
.ProseMirror h3, 
.ProseMirror h4 {
  border-bottom: none !important;
  margin-bottom: 0.5em;
}

/* Block Hover Effect */
.ProseMirror > * {
  margin-top: 0.75em;
  margin-bottom: 0.75em;
  position: relative;
  transition: background-color 0.2s;
  padding: 2px 4px;
  border-radius: 4px;
}

.ProseMirror > *:hover {
  background-color: rgba(55, 53, 47, 0.03);
}

/* Placeholder Style */
.ProseMirror p.is-editor-empty:first-child::before {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.ProseMirror p.is-empty::before {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

/* List Styles */
.ProseMirror ul, .ProseMirror ol {
  padding-left: 1.5rem;
}

.ProseMirror ul {
  list-style-type: disc;
}

.ProseMirror ol {
  list-style-type: decimal;
}

.ProseMirror ul[data-type="taskList"] {
  list-style: none;
  padding: 0;
}

.ProseMirror ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
}

.ProseMirror ul[data-type="taskList"] li > label {
  flex: 0 0 auto;
  margin-right: 0.5rem;
  user-select: none;
}

.ProseMirror ul[data-type="taskList"] li > div {
  flex: 1 1 auto;
}

/* Code Block Styles */
.ProseMirror pre {
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'JetBrains Mono', monospace;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
}

.ProseMirror pre code {
  color: inherit;
  padding: 0;
  background: none;
  font-size: 0.8rem;
}

/* Floating Menu Items */
.menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  text-align: left;
  color: #374151;
  border-radius: 0.375rem;
  transition: background-color 0.1s;
}

.menu-item:hover {
  background-color: #f3f4f6;
}

/* Typography Overrides */
.prose h1 { font-size: 2.25rem; font-weight: 700; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
.prose h2 { font-size: 1.5rem; font-weight: 600; margin-top: 1.5em; }
.prose h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.2em; }
</style>

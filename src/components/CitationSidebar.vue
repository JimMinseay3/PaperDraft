<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Trash2, BookOpen, Upload, Download } from 'lucide-vue-next'
import type { Reference } from '../types/paper'

const props = defineProps<{
  references: Reference[]
}>()

const emit = defineEmits<{
  (e: 'add-reference', ref: Reference): void
  (e: 'remove-reference', id: string): void
}>()

const isAdding = ref(false)
const showBibtexImport = ref(false)
const bibtexInput = ref('')

const newRef = ref<Partial<Reference>>({
  type: 'article',
  title: '',
  author: '',
  year: new Date().getFullYear(),
  journal: ''
})

const parseBibtex = (bib: string) => {
  // Simple regex-based parser for demonstration
  // Real implementation should use a robust bibtex parser library
  const entries = bib.match(/@(\w+)\s*\{([^,]+),([^@]+)\}/g)
  if (!entries) return

  entries.forEach(entry => {
    const typeMatch = entry.match(/@(\w+)\s*\{/)
    const idMatch = entry.match(/\{([^,]+),/)
    
    if (typeMatch && idMatch) {
      const type = typeMatch[1]
      const id = idMatch[1].trim()
      const content = entry.substring(entry.indexOf(',') + 1)
      
      const getField = (field: string) => {
        const match = content.match(new RegExp(`${field}\\s*=\\s*[{"'](.+?)[}"']`, 'i'))
        return match ? match[1] : ''
      }
      
      const ref: Reference = {
        id: id,
        type: type,
        title: getField('title') || 'Untitled',
        author: getField('author') || 'Unknown',
        year: parseInt(getField('year')) || new Date().getFullYear(),
        journal: getField('journal'),
        bibtex: entry
      }
      
      emit('add-reference', ref)
    }
  })
  
  bibtexInput.value = ''
  showBibtexImport.value = false
}

const handleDrop = async (event: DragEvent) => {
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return

  const file = files[0]
  if (file.name.endsWith('.bib') || file.type === 'text/plain' || file.type === 'application/x-bibtex') {
    const text = await file.text()
    parseBibtex(text)
  } else {
    alert('Please drop a .bib file')
  }
}

const addManualReference = () => {
  if (!newRef.value.title || !newRef.value.author) return
  
  const baseId = newRef.value.author?.split(' ')[0].toLowerCase() + newRef.value.year
  const finalId = baseId + Math.floor(Math.random() * 1000)
  
  emit('add-reference', {
    id: finalId,
    ...newRef.value as Reference,
    bibtex: generateBibtex(newRef.value as Reference, finalId)
  })
  
  isAdding.value = false
  newRef.value = { type: 'article', title: '', author: '', year: new Date().getFullYear() }
}

const generateBibtex = (ref: Reference, id: string) => {
  return `@${ref.type}{${id},
  title = {${ref.title}},
  author = {${ref.author}},
  year = {${ref.year}},
  journal = {${ref.journal || ''}}
}`
}

const removeReference = (id: string) => {
  if (confirm('Are you sure you want to remove this reference?')) {
    emit('remove-reference', id)
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-white" @dragover.prevent @drop.prevent="handleDrop">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
      <h2 class="text-xs font-bold text-gray-700 uppercase flex items-center">
        <BookOpen class="w-4 h-4 mr-2 text-blue-500" />
        Citation Library
      </h2>
      <div class="flex space-x-1">
        <button 
          @click="showBibtexImport = !showBibtexImport"
          class="p-1 hover:bg-gray-200 rounded text-gray-600"
          title="Import BibTeX"
        >
          <Upload class="w-4 h-4" />
        </button>
        <button 
          @click="isAdding = !isAdding"
          class="p-1 hover:bg-gray-200 rounded text-gray-600"
          title="Add Manually"
        >
          <Plus class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- BibTeX Import -->
    <div v-if="showBibtexImport" class="p-3 border-b border-gray-200 bg-blue-50">
      <textarea 
        v-model="bibtexInput"
        class="w-full text-xs border border-blue-200 rounded p-2 h-24 focus:outline-none focus:border-blue-400 font-mono"
        placeholder="Paste BibTeX content here..."
      ></textarea>
      <div class="flex justify-end mt-2">
        <button 
          @click="parseBibtex(bibtexInput)"
          class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
        >
          Import
        </button>
      </div>
    </div>

    <!-- Manual Add Form -->
    <div v-if="isAdding" class="p-3 border-b border-gray-200 bg-gray-50">
      <div class="space-y-2">
        <select v-model="newRef.type" class="w-full text-xs border border-gray-300 rounded p-1.5">
          <option value="article">Journal Article</option>
          <option value="book">Book</option>
          <option value="conference">Conference Paper</option>
          <option value="thesis">Thesis</option>
        </select>
        <input 
          v-model="newRef.title" 
          placeholder="Title"
          class="w-full text-xs border border-gray-300 rounded p-1.5"
        />
        <input 
          v-model="newRef.author" 
          placeholder="Author(s)"
          class="w-full text-xs border border-gray-300 rounded p-1.5"
        />
        <div class="flex space-x-2">
          <input 
            v-model="newRef.year" 
            type="number"
            placeholder="Year"
            class="w-1/3 text-xs border border-gray-300 rounded p-1.5"
          />
          <input 
            v-model="newRef.journal" 
            placeholder="Journal / Publisher"
            class="w-2/3 text-xs border border-gray-300 rounded p-1.5"
          />
        </div>
        <div class="flex justify-end space-x-2 mt-2">
          <button 
            @click="isAdding = false"
            class="px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded"
          >
            Cancel
          </button>
          <button 
            @click="addManualReference"
            class="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto p-2 space-y-2">
      <div v-if="references.length === 0" class="text-center py-8 text-gray-400 text-sm">
        <p>No citations yet.</p>
        <p class="text-xs mt-1">Add references to cite them in your paper.</p>
      </div>
      
      <div 
        v-for="ref in references" 
        :key="ref.id"
        class="bg-white border border-gray-200 rounded p-2 hover:border-blue-300 group relative"
      >
        <div class="pr-6">
          <div class="font-medium text-sm text-gray-800 leading-tight mb-1">{{ ref.title }}</div>
          <div class="text-xs text-gray-600">
            {{ ref.author }} ({{ ref.year }})
          </div>
          <div class="text-xs text-gray-500 italic mt-0.5" v-if="ref.journal">
            {{ ref.journal }}
          </div>
          <div class="text-[10px] text-gray-400 font-mono mt-1">
            Key: @{{ ref.id }}
          </div>
        </div>
        
        <button 
          @click="removeReference(ref.id)"
          class="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, FileText, Heading, Image, List, Code, Quote, Table } from 'lucide-vue-next'
import type { Block } from '../types/paper'

const props = defineProps<{
  blocks: Block[]
}>()

const emit = defineEmits<{
  (e: 'jump', id: string, query: string): void
}>()

const searchQuery = ref('')

interface SearchResult {
  id: string
  type: string
  text: string
  matches: { start: number; end: number }[]
}

const getBlockText = (block: any): string => {
  // 1. Simple string content
  if (typeof block.content === 'string') {
    return block.content
  }
  
  // 2. TipTap Text Node (leaf node)
  if (block.type === 'text' && typeof block.text === 'string') {
    return block.text
  }

  // 3. Nested content (Block[] or TipTap content array)
  if (Array.isArray(block.content)) {
    // For rich text (TipTap nodes), we join without spaces because they are parts of the same paragraph
    // For nested blocks (if any), it might need spaces, but usually our structure is flat-ish for text.
    return block.content.map((b: any) => getBlockText(b)).join('')
  }
  
  return ''
}

const flattenBlocks = (blocks: Block[]): { id: string; type: string; text: string }[] => {
  let flat: { id: string; type: string; text: string }[] = []
  
  for (const block of blocks) {
    const text = getBlockText(block)
    if (text) {
      flat.push({ id: block.id, type: block.type, text })
    }
    
    if (Array.isArray(block.content) && block.content.length > 0) {
      // Only recurse if the content contains Blocks, not Text Nodes
      // If the first child is 'text', it's a rich text paragraph, so we stop recursion
      // (because we already extracted the full text via getBlockText)
      const firstChild = block.content[0] as any
      if (firstChild.type !== 'text') {
         flat = flat.concat(flattenBlocks(block.content as Block[]))
      }
    }
  }
  return flat
}

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return []

  const flat = flattenBlocks(props.blocks)
  const results: SearchResult[] = []

  for (const item of flat) {
    const textLower = item.text.toLowerCase()
    const index = textLower.indexOf(query)
    
    if (index !== -1) {
      results.push({
        id: item.id,
        type: item.type,
        text: item.text,
        matches: [{ start: index, end: index + query.length }]
      })
    }
  }

  return results
})

const getIcon = (type: string) => {
  switch (type) {
    case 'heading': return Heading
    case 'image': return Image
    case 'list': return List
    case 'code': return Code
    case 'blockquote': return Quote
    case 'table': return Table
    default: return FileText
  }
}

const escapeHtml = (text: string) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

const highlightMatch = (text: string, matches: { start: number; end: number }[]) => {
  if (!matches.length) return escapeHtml(text)
  
  // Simple highlighting for the first match for now
  // We take a snippet around the match
  const match = matches[0]
  const start = Math.max(0, match.start - 20)
  const end = Math.min(text.length, match.end + 40)
  
  let snippet = text.slice(start, end)
  const matchStartInSnippet = match.start - start
  const matchEndInSnippet = match.end - start
  
  const before = escapeHtml(snippet.slice(0, matchStartInSnippet))
  const matched = escapeHtml(snippet.slice(matchStartInSnippet, matchEndInSnippet))
  const after = escapeHtml(snippet.slice(matchEndInSnippet))
  
  let result = `${before}<span class="bg-yellow-200 text-black font-bold rounded px-0.5">${matched}</span>${after}`
  
  if (start > 0) result = '...' + result
  if (end < text.length) result = result + '...'
  
  return result
}

const handleJump = (id: string) => {
  emit('jump', id, searchQuery.value)
}
</script>

<template>
  <div class="h-full bg-gray-50 flex flex-col">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 bg-white">
      <h2 class="text-xs font-bold text-gray-700 uppercase mb-3">Search</h2>
      <div class="relative">
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Search content..." 
          class="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          autofocus
        />
        <Search class="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
      </div>
    </div>

    <!-- Results -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      <div v-if="!searchQuery" class="text-center text-gray-400 text-sm mt-10">
        Type to search...
      </div>
      
      <div v-else-if="searchResults.length === 0" class="text-center text-gray-400 text-sm mt-10">
        No results found
      </div>

      <div 
        v-else
        v-for="result in searchResults" 
        :key="result.id"
        @click="handleJump(result.id)"
        class="group flex items-start p-2 rounded hover:bg-white hover:shadow-sm cursor-pointer transition-all border border-transparent hover:border-gray-200"
      >
        <div class="flex-none mt-0.5 mr-2 text-gray-400 group-hover:text-blue-500">
          <component :is="getIcon(result.type)" class="w-4 h-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div 
            class="text-sm text-gray-600 leading-snug break-words"
            v-html="highlightMatch(result.text, result.matches)"
          ></div>
          <div class="text-[10px] text-gray-400 mt-1 capitalize">{{ result.type }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

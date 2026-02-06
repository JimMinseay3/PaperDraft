<template>
  <div class="h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
    <div class="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-800">
      <h2 class="font-semibold text-gray-700 dark:text-gray-200">Comments</h2>
      <span class="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full">
        {{ comments.length }}
      </span>
    </div>
    
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <div v-if="comments.length === 0" class="text-center text-gray-500 dark:text-gray-400 mt-10">
        <p>No comments found in this document.</p>
      </div>
      
      <div 
        v-for="comment in comments" 
        :key="comment.id"
        :id="`comment-card-${comment.id}`"
        class="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
        @click="scrollToEditorComment(comment.id)"
      >
        <div class="flex justify-between items-start mb-2">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300">
              {{ getInitials(comment.author) }}
            </div>
            <span class="font-medium text-sm text-gray-900 dark:text-gray-100">{{ comment.author || 'Unknown' }}</span>
          </div>
          <span class="text-xs text-gray-400">{{ formatDate(comment.date) }}</span>
        </div>
        
        <div class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap pl-8">
          {{ comment.content }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Comment {
  id: string
  author: string
  date: string
  content: string
}

defineProps<{
  comments: Comment[]
}>()

const getInitials = (name: string) => {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

const scrollToEditorComment = (id: string) => {
  // Find the marker in the DOM (assuming it's rendered in Editor)
  // Since Editor is in a different component, we can use a global event or querySelector
  // The markers have class 'comment-marker' and data-id attribute
  const marker = document.querySelector(`.comment-marker[data-id="${id}"]`) as HTMLElement | null
  if (marker) {
    marker.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Add a temporary highlight effect
    // We can't easily add class to the marker since it's inside TipTap's control, 
    // but we can manipulate the DOM element directly as it's a NodeView
    marker.style.backgroundColor = '#fef3c7'; // yellow-100
    setTimeout(() => {
        marker.style.backgroundColor = '';
    }, 2000)
  }
}
</script>

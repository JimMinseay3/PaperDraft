<script setup lang="ts">
import { computed } from 'vue'
import type { VersionGraph, VersionNode } from '../types/paper'

const props = defineProps<{
  graph: VersionGraph
  activeNodeId?: string
}>()

const emit = defineEmits<{
  (e: 'switch', nodeId: string): void
}>()

const SPACING_Y = 60
const SPACING_X = 30
const OFFSET_Y = 40
const OFFSET_X = 20

// Helpers
const formatDate = (ts: number) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const branches = computed(() => props.graph.branches)
const nodes = computed(() => props.graph.nodes)

// 1. Assign columns to branches
const branchColumns = computed(() => {
  const cols: Record<string, number> = {}
  const sortedBranches = Object.values(branches.value).sort((a, b) => {
    if (a.isMain) return -1
    if (b.isMain) return 1
    return a.id.localeCompare(b.id)
  })
  
  sortedBranches.forEach((b, i) => {
    cols[b.id] = i
  })
  return cols
})

// 2. Sort nodes by timestamp desc
const sortedNodes = computed(() => {
  return Object.values(nodes.value).sort((a, b) => b.timestamp - a.timestamp)
})

// 3. Calculate Layout
const layoutNodes = computed(() => {
  return sortedNodes.value.map((node, index) => {
    const col = branchColumns.value[node.branchId] || 0
    const branch = branches.value[node.branchId]
    
    return {
      ...node,
      x: OFFSET_X + col * SPACING_X,
      y: OFFSET_Y + index * SPACING_Y,
      color: branch?.color || '#9ca3af',
      branchName: branch?.name
    }
  })
})

const height = computed(() => {
  return (layoutNodes.value.length * SPACING_Y) + OFFSET_Y * 2
})

// 4. Calculate Connections
const connections = computed(() => {
  const conns: any[] = []
  
  layoutNodes.value.forEach(node => {
    if (node.parentId) {
      const parent = layoutNodes.value.find(n => n.id === node.parentId)
      if (parent) {
        // Draw curve
        // If same column: straight line
        // If diff column: bezier curve
        
        const p1 = { x: node.x, y: node.y }
        const p2 = { x: parent.x, y: parent.y }
        
        let d = ''
        if (p1.x === p2.x) {
          d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`
        } else {
          // Cubic Bezier for smooth branching
          const cp1 = { x: p1.x, y: (p1.y + p2.y) / 2 }
          const cp2 = { x: p2.x, y: (p1.y + p2.y) / 2 }
          d = `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`
        }
        
        conns.push({
          id: `${node.id}-${parent.id}`,
          path: d,
          color: node.color // Use child's color for the link
        })
      }
    }
  })
  
  return conns
})

</script>

<template>
  <div class="relative w-full overflow-hidden select-none" :style="{ height: height + 'px' }">
    <!-- SVG Layer -->
    <svg :height="height" width="100%" class="absolute top-0 left-0 pointer-events-none">
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
          <path d="M0,0 L0,10 L10,5 z" fill="#ccc" />
        </marker>
      </defs>
      <path v-for="conn in connections" :key="conn.id" 
        :d="conn.path" 
        :stroke="conn.color" 
        stroke-width="2" 
        fill="none" 
        class="opacity-60"
      />
    </svg>
    
    <!-- Nodes Layer -->
    <div v-for="node in layoutNodes" :key="node.id"
      class="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10"
      :style="{ left: node.x + 'px', top: node.y + 'px' }"
      @click="$emit('switch', node.id)"
    >
      <!-- Dot -->
      <div class="rounded-full border-2 bg-white transition-all duration-200 hover:scale-125"
        :class="[
          node.type === 'milestone' ? 'w-5 h-5' : 'w-3 h-3',
          node.id === activeNodeId ? 'ring-2 ring-offset-2 ring-blue-500' : ''
        ]"
        :style="{ 
          borderColor: node.color,
          backgroundColor: node.id === activeNodeId ? node.color : 'white'
        }"
      ></div>
      
      <!-- Hover Card / Label -->
      <div class="absolute left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 bg-white border border-gray-200 shadow-lg rounded px-2 py-1">
        <div class="text-xs font-bold text-gray-700">{{ node.note }}</div>
        <div class="text-[10px] text-gray-500 flex items-center gap-1">
          <span>{{ node.branchName }}</span>
          <span>•</span>
          <span>{{ formatDate(node.timestamp) }}</span>
        </div>
        <div class="text-[10px] text-gray-400">{{ node.wordCount }} words</div>
      </div>

      <!-- Simple Label (Always Visible) -->
      <div class="absolute left-6 top-1/2 -translate-y-1/2 opacity-100 group-hover:opacity-0 transition-opacity whitespace-nowrap pointer-events-none">
         <span class="text-xs text-gray-600 bg-white/50 px-1 rounded truncate max-w-[120px] inline-block">{{ node.note }}</span>
      </div>
    </div>
  </div>
</template>

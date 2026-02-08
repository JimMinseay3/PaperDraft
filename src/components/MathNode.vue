<template>
  <node-view-wrapper class="math-node is-numbered" ref="nodeRoot">
    <div 
      class="math-preview" 
      v-html="rendered" 
      :class="{ 'has-error': !!error, 'is-empty': !src }" 
      @click="startEditing"
      title="Click to edit formula"
    ></div>
    <div v-show="isEditing || error" class="math-editor-container">
        <!-- Autocomplete Dropdown -->
        <div 
          v-if="showSuggestions" 
          class="suggestion-list"
          :style="suggestionStyle"
        >
          <div 
            v-for="(item, index) in filteredCommands" 
            :key="item"
            class="suggestion-item"
            :class="{ 'is-selected': index === selectedIndex }"
            @click="selectSuggestion(item)"
          >
            <span class="suggestion-text">{{ item }}</span>
            <span class="suggestion-ghost" v-if="index === selectedIndex">
                <!-- Simple preview or description could go here -->
            </span>
          </div>
        </div>

        <div class="textarea-wrapper">
            <!-- Syntax Highlighting Overlay -->
            <div class="syntax-overlay" v-html="highlightedCode"></div>
            <!-- Ghost Text Overlay -->
            <div class="ghost-overlay" v-if="ghostText">
                <span class="invisible-text">{{ textBeforeGhost }}</span><span class="ghost-text">{{ ghostText }}</span>
            </div>
            
            <textarea 
                ref="textarea"
                v-model="src" 
                @input="handleInput"
                @keydown="handleKeydown"
                @blur="handleBlur"
                @click="updateCursor"
                @keyup="updateCursor"
                placeholder="Type LaTeX formula... (e.g. E = mc^2)"
                rows="3"
                class="transparent-textarea"
                spellcheck="false"
            ></textarea>
            
            <!-- Help/Reference Icon moved to bottom -->
        </div>

        <div v-if="error" class="math-error">
            <span class="error-icon">⚠️</span> {{ error }}
        </div>
        <div class="math-help">
            <small>Press <b>Tab</b> or <b>Enter</b> to autocomplete</small>
            <span 
                class="help-icon" 
                @click.stop="toggleReference"
                :class="{ 'is-active': showReference }"
                title="Open Formula Reference"
            >?</span>
        </div>
        
        <!-- Reference Panel Teleported to Assistant Sidebar -->
        <Teleport to="#math-reference-root">
            <div class="reference-panel-sidebar" v-if="showReference" @click.stop>
                <div class="reference-header">
                    <input 
                        ref="searchInput"
                        v-model="searchQuery" 
                        placeholder="Search formulas..." 
                        class="reference-search"
                    />
                    <div class="category-tabs">
                        <span 
                            v-for="cat in categories" 
                            :key="cat" 
                            class="cat-tab" 
                            :class="{ active: selectedCategory === cat }"
                            @click="selectedCategory = cat"
                        >
                            {{ cat }}
                        </span>
                    </div>
                </div>
                <div class="reference-list">
                    <div class="reference-header-row">
                        <span>Name</span>
                        <span>Symbol</span>
                        <span>Code</span>
                    </div>
                    <div 
                        v-for="cmd in filteredReference" 
                        :key="cmd.command"
                        class="reference-item"
                        @mousedown.prevent="insertReference(cmd.command)"
                    >
                        <span class="ref-name">{{ cmd.name }}</span>
                        <span class="ref-symbol" v-html="renderSymbol(cmd.command)"></span>
                        <span class="ref-code">{{ cmd.command }}</span>
                    </div>
                    <div v-if="filteredReference.length === 0" class="reference-empty">
                        No matching formulas found
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed, ref, nextTick, watch } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const props = defineProps(nodeViewProps)

const src = ref(props.node.attrs.src || '')
const isEditing = ref(false)
const nodeRoot = ref<any>(null)
const textarea = ref<HTMLTextAreaElement | null>(null)

// Autocomplete State
const showSuggestions = ref(false)
const selectedIndex = ref(0)
const cursorIndex = ref(0)
const currentPrefix = ref('')

// Reference State
const showReference = ref(false)
const searchQuery = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const selectedCategory = ref('All')

interface ReferenceItem {
    name: string
    command: string
    category: string
    keywords?: string
}

// Rich Reference Data
const referenceData: ReferenceItem[] = [
    // Greek Letters
    { name: 'Alpha', command: '\\alpha', category: 'Greek' },
    { name: 'Beta', command: '\\beta', category: 'Greek' },
    { name: 'Gamma', command: '\\gamma', category: 'Greek' },
    { name: 'Delta', command: '\\delta', category: 'Greek' },
    { name: 'Epsilon', command: '\\epsilon', category: 'Greek' },
    { name: 'Zeta', command: '\\zeta', category: 'Greek' },
    { name: 'Eta', command: '\\eta', category: 'Greek' },
    { name: 'Theta', command: '\\theta', category: 'Greek' },
    { name: 'Iota', command: '\\iota', category: 'Greek' },
    { name: 'Kappa', command: '\\kappa', category: 'Greek' },
    { name: 'Lambda', command: '\\lambda', category: 'Greek' },
    { name: 'Mu', command: '\\mu', category: 'Greek' },
    { name: 'Nu', command: '\\nu', category: 'Greek' },
    { name: 'Xi', command: '\\xi', category: 'Greek' },
    { name: 'Pi', command: '\\pi', category: 'Greek' },
    { name: 'Rho', command: '\\rho', category: 'Greek' },
    { name: 'Sigma', command: '\\sigma', category: 'Greek' },
    { name: 'Tau', command: '\\tau', category: 'Greek' },
    { name: 'Upsilon', command: '\\upsilon', category: 'Greek' },
    { name: 'Phi', command: '\\phi', category: 'Greek' },
    { name: 'Chi', command: '\\chi', category: 'Greek' },
    { name: 'Psi', command: '\\psi', category: 'Greek' },
    { name: 'Omega', command: '\\omega', category: 'Greek' },
    { name: 'Gamma (Upper)', command: '\\Gamma', category: 'Greek' },
    { name: 'Delta (Upper)', command: '\\Delta', category: 'Greek' },
    { name: 'Theta (Upper)', command: '\\Theta', category: 'Greek' },
    { name: 'Lambda (Upper)', command: '\\Lambda', category: 'Greek' },
    { name: 'Xi (Upper)', command: '\\Xi', category: 'Greek' },
    { name: 'Pi (Upper)', command: '\\Pi', category: 'Greek' },
    { name: 'Sigma (Upper)', command: '\\Sigma', category: 'Greek' },
    { name: 'Upsilon (Upper)', command: '\\Upsilon', category: 'Greek' },
    { name: 'Phi (Upper)', command: '\\Phi', category: 'Greek' },
    { name: 'Psi (Upper)', command: '\\Psi', category: 'Greek' },
    { name: 'Omega (Upper)', command: '\\Omega', category: 'Greek' },

    // Operators
    { name: 'Fraction', command: '\\frac{}{}', category: 'Operators' },
    { name: 'Square Root', command: '\\sqrt{}', category: 'Operators' },
    { name: 'Summation', command: '\\sum_{}^{}', category: 'Operators' },
    { name: 'Integral', command: '\\int_{}^{}', category: 'Operators' },
    { name: 'Product', command: '\\prod_{}^{}', category: 'Operators' },
    { name: 'Limit', command: '\\lim_{}', category: 'Operators' },
    { name: 'Dot Product', command: '\\cdot', category: 'Operators' },
    { name: 'Cross Product', command: '\\times', category: 'Operators' },
    { name: 'Division', command: '\\div', category: 'Operators' },
    { name: 'Plus Minus', command: '\\pm', category: 'Operators' },
    { name: 'Minus Plus', command: '\\mp', category: 'Operators' },

    // Relations
    { name: 'Less Equal', command: '\\leq', category: 'Relations' },
    { name: 'Greater Equal', command: '\\geq', category: 'Relations' },
    { name: 'Not Equal', command: '\\neq', category: 'Relations' },
    { name: 'Approx', command: '\\approx', category: 'Relations' },
    { name: 'Equiv', command: '\\equiv', category: 'Relations' },
    { name: 'Subset', command: '\\subset', category: 'Relations' },
    { name: 'Superset', command: '\\supset', category: 'Relations' },
    { name: 'Subset Eq', command: '\\subseteq', category: 'Relations' },
    { name: 'Superset Eq', command: '\\supseteq', category: 'Relations' },
    { name: 'In', command: '\\in', category: 'Relations' },
    { name: 'Not In', command: '\\notin', category: 'Relations' },

    // Logic & Sets
    { name: 'Union', command: '\\cup', category: 'Logic' },
    { name: 'Intersection', command: '\\cap', category: 'Logic' },
    { name: 'Set Minus', command: '\\setminus', category: 'Logic' },
    { name: 'For All', command: '\\forall', category: 'Logic' },
    { name: 'Exists', command: '\\exists', category: 'Logic' },
    { name: 'Infinity', command: '\\infty', category: 'Logic' },
    { name: 'Partial', command: '\\partial', category: 'Logic' },
    { name: 'Nabla', command: '\\nabla', category: 'Logic' },

    // Arrows
    { name: 'Right Arrow', command: '\\rightarrow', category: 'Arrows' },
    { name: 'Left Arrow', command: '\\leftarrow', category: 'Arrows' },
    { name: 'Right Double', command: '\\Rightarrow', category: 'Arrows' },
    { name: 'Left Double', command: '\\Leftarrow', category: 'Arrows' },
    { name: 'Left Right', command: '\\leftrightarrow', category: 'Arrows' },
    { name: 'LR Double', command: '\\Leftrightarrow', category: 'Arrows' },
    { name: 'Mapsto', command: '\\mapsto', category: 'Arrows' },
    { name: 'Implies', command: '\\implies', category: 'Arrows' },

    // Environments
    { name: 'Matrix (brackets)', command: '\\begin{bmatrix}\\end{bmatrix}', category: 'Environments' },
    { name: 'Matrix (parens)', command: '\\begin{pmatrix}\\end{pmatrix}', category: 'Environments' },
    { name: 'Cases', command: '\\begin{cases}\\end{cases}', category: 'Environments' },
    { name: 'Text', command: '\\text{}', category: 'Environments' },
]

const categories = ['All', 'Greek', 'Operators', 'Relations', 'Logic', 'Arrows', 'Environments']

// Extract simple commands list for autocomplete
const commands = referenceData.map(d => d.command)

const filteredReference = computed(() => {
    const q = searchQuery.value.toLowerCase()
    let data = referenceData
    
    // Filter by Category
    if (selectedCategory.value !== 'All') {
        data = data.filter(d => d.category === selectedCategory.value)
    }

    if (!q) return data
    return data.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.command.toLowerCase().includes(q) ||
        (item.keywords && item.keywords.toLowerCase().includes(q))
    )
})

const renderSymbol = (cmd: string) => {
    try {
        let preview = cmd
        // Handle specific patterns - Order matters!
        // Check for complex patterns before simple braces
        if (cmd.includes('_{}^{}')) preview = cmd.replace('_{}^{}', '_{a}^{b}')
        else if (cmd.includes('{}{}')) preview = cmd.replace('{}{}', '{x}{y}')
        else if (cmd.includes('{}')) preview = cmd.replace('{}', '{x}')
        
        return katex.renderToString(preview, {
            throwOnError: false,
            displayMode: false
        })
    } catch (e) {
        return '?'
    }
}

const insertReference = (cmd: string) => {
    // Re-use existing insertion logic
    selectSuggestion(cmd)
    // Keep focus on search input or return to textarea?
    // Usually inserting implies we want to continue typing in textarea.
    // So selectSuggestion focuses textarea.
}

// Unique ID for this node instance
const nodeId = `math-node-${Math.random().toString(36).substr(2, 9)}`

const toggleReference = () => {
    if (showReference.value) {
        showReference.value = false
        window.dispatchEvent(new CustomEvent('math-reference-closed'))
    } else {
        showReference.value = true
        window.dispatchEvent(new CustomEvent('math-reference-opened', { detail: { nodeId } }))
        nextTick(() => {
            searchInput.value?.focus()
        })
    }
}

const handleGlobalReferenceOpen = (e: Event) => {
    const customEvent = e as CustomEvent
    if (customEvent.detail?.nodeId !== nodeId) {
        showReference.value = false
    }
}

const filteredCommands = computed(() => {
    if (!currentPrefix.value) return []
    
    let search = currentPrefix.value
    // Normalize triggers: '/' and '、' are treated as '\'
    if (search.startsWith('/') || search.startsWith('、')) {
        search = '\\' + search.slice(1)
    }
    
    // Filter and sort by length (shorter first) then alphabetical
    return commands
        .filter(c => c.startsWith(search) && c !== search)
        .sort((a, b) => a.length - b.length || a.localeCompare(b))
        .slice(0, 10) // Limit to 10 suggestions
})

// Ghost Text Logic
const textBeforeGhost = computed(() => {
    return src.value.slice(0, cursorIndex.value)
})

const ghostText = computed(() => {
    if (!showSuggestions.value || filteredCommands.value.length === 0) return ''
    const bestMatch = filteredCommands.value[selectedIndex.value]
    
    let search = currentPrefix.value
    // Normalize for matching logic
    if (search.startsWith('/') || search.startsWith('、')) {
        search = '\\' + search.slice(1)
    }

    if (bestMatch.startsWith(search)) {
        return bestMatch.slice(search.length)
    }
    return ''
})

// Watch for external changes
watch(() => props.node.attrs.src, (newVal) => {
    if (newVal !== src.value) {
        src.value = newVal
        nextTick(resizeTextarea)
    }
})

watch(filteredCommands, (newVal) => {
    if (newVal.length === 0) {
        showSuggestions.value = false
    } else {
        // Reset selection when list changes
        selectedIndex.value = 0
    }
})

const rendered = computed(() => {
    try {
        if (!src.value) return '<span class="placeholder">Empty Formula (Click to edit)</span>'
        return katex.renderToString(src.value, {
            throwOnError: true,
            displayMode: true,
            output: 'html'
        })
    } catch (e: any) {
        return `<span class="error-placeholder">${src.value}</span>`
    }
})

const error = computed(() => {
    if (!src.value) return ''
    try {
        katex.renderToString(src.value, { throwOnError: true, displayMode: true })
        return ''
    } catch (e: any) {
        return e.message.replace('KaTeX parse error: ', '')
    }
})

const updateSrc = () => {
    props.updateAttributes({ src: src.value })
}

const resizeTextarea = () => {
    if (!textarea.value) return
    textarea.value.style.height = 'auto'
    textarea.value.style.height = textarea.value.scrollHeight + 'px'
}

const startEditing = () => {
    isEditing.value = true
    nextTick(() => {
        textarea.value?.focus()
        resizeTextarea()
    })
}

const stopEditing = () => {
    if (!error.value) {
        isEditing.value = false
        showSuggestions.value = false
    }
}

const handleBlur = (e: FocusEvent) => {
    // Delay hiding to allow click on suggestion list or reference panel
    setTimeout(() => {
        const active = document.activeElement
        
        // If focus moved to:
        // 1. Sidebar reference panel
        // 2. Suggestion list
        // 3. Anywhere inside this node
        if (active && (
            active.closest('.reference-panel-sidebar') || 
            active.closest('.suggestion-list') ||
            active.closest('.math-node')
        )) {
            return
        }
        
        // Special Case: Reference Panel is Open
        // If the reference panel is open, clicking "non-focusable" elements (like the toggle button or panel background)
        // results in activeElement being BODY. In this case, we want to KEEP editing.
        // We rely on handleClickOutside to close the editor if the user actually clicked the document background.
        if (showReference.value && (!active || active === document.body)) {
            return
        }
        
        // If focus moved to another input or genuinely outside, stop editing
        isEditing.value = false
        showSuggestions.value = false
    }, 200)
}

const handleClickOutside = (e: MouseEvent) => {
    if (!isEditing.value) return
    
    const target = e.target as HTMLElement
    
    // Check if click is inside the node root
    // Note: nodeRoot.value is the NodeViewWrapper
    // We can also check if target is inside the component's element if ref is not reliable
    if (nodeRoot.value) {
        if (nodeRoot.value.$el && nodeRoot.value.$el.contains(target)) return
        if (nodeRoot.value.contains && nodeRoot.value.contains(target)) return
    }
    
    // Check if click is inside the reference sidebar (teleported)
    if (target.closest('.reference-panel-sidebar')) return
    
    // Check if click is on the help icon (though it usually stops propagation)
    if (target.closest('.math-help')) return

    // If outside everything, stop editing
    stopEditing()
}

// Close reference panel when clicking outside
// We can use a window listener
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
    window.addEventListener('math-reference-opened', handleGlobalReferenceOpen)
    document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
    window.removeEventListener('math-reference-opened', handleGlobalReferenceOpen)
    document.removeEventListener('mousedown', handleClickOutside)
})

const updateCursor = () => {
    if (textarea.value) {
        cursorIndex.value = textarea.value.selectionStart
        detectCommand()
    }
}

const handleInput = () => {
    updateSrc()
    updateCursor()
    resizeTextarea()
}

const highlightedCode = computed(() => {
    if (!src.value) return ''
    let code = src.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    
    // Simple Highlighting
    code = code
        .replace(/(\\[a-zA-Z]+)/g, '<span class="hl-cmd">$1</span>')
        .replace(/([{}])/g, '<span class="hl-brace">$1</span>')
        .replace(/([\^_])/g, '<span class="hl-op">$1</span>')
        .replace(/(\d+)/g, '<span class="hl-num">$1</span>')
        
    return code + '<br>'
})

const detectCommand = () => {
    const text = src.value
    const cursor = cursorIndex.value
    
    // Look backwards from cursor for '\', '/', or '、'
    const before = text.slice(0, cursor)
    
    // Regex matches:
    // Group 1: trigger char (\ or / or 、)
    // Group 2: following letters
    const match = before.match(/([\\\/、])([a-zA-Z]*)$/)
    
    if (match) {
        const trigger = match[1]
        const letters = match[2]
        const candidate = match[0]
        
        // Rule: If trigger is '/' or '、', require at least one letter 
        // to avoid noise (e.g. division 1/2 or Chinese pause mark)
        if ((trigger === '/' || trigger === '、') && letters.length === 0) {
            showSuggestions.value = false
            currentPrefix.value = ''
            return
        }

        // Check if candidates exist for this prefix
        let search = candidate
        if (search.startsWith('/') || search.startsWith('、')) {
            search = '\\' + search.slice(1)
        }
        
        // Only show if there are actual matches
        const hasMatches = commands.some(c => c.startsWith(search) && c !== search)
        
        if (hasMatches) {
            currentPrefix.value = candidate
            showSuggestions.value = true
            return
        }
    }
    
    showSuggestions.value = false
    currentPrefix.value = ''
}

const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
        stopEditing()
        return
    }

    if (showSuggestions.value) {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            selectedIndex.value = (selectedIndex.value + 1) % filteredCommands.value.length
            return
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault()
            selectedIndex.value = (selectedIndex.value - 1 + filteredCommands.value.length) % filteredCommands.value.length
            return
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault()
            selectSuggestion(filteredCommands.value[selectedIndex.value])
            return
        }
    } else {
        // Standard Tab behavior if no suggestions
        if (e.key === 'Tab') {
            // Optional: Insert spaces or just prevent blur?
            // For now, allow default or do nothing.
        }
    }
}

const selectSuggestion = (command: string) => {
    if (!textarea.value) return
    
    const text = src.value
    const cursor = cursorIndex.value
    const prefixLen = currentPrefix.value.length
    
    const before = text.slice(0, cursor - prefixLen)
    const after = text.slice(cursor)
    
    const newText = before + command + after
    src.value = newText
    updateSrc()
    
    showSuggestions.value = false
    currentPrefix.value = ''
    
    nextTick(() => {
        if (!textarea.value) return
        
        // Smart Cursor Positioning
        // If command contains {}, place cursor inside first {}
        const relativeBracePos = command.indexOf('{}')
        let newPos = 0
        
        if (relativeBracePos !== -1) {
            newPos = before.length + relativeBracePos + 1
        } else {
            newPos = before.length + command.length
        }
        
        textarea.value.selectionStart = textarea.value.selectionEnd = newPos
        textarea.value.focus()
    })
}

// Simple positioning logic for suggestions
// For a real robust solution, we'd use something like textarea-caret package
// Here we just position it below the textarea for simplicity, 
// since calculating precise coordinates inside a textarea is heavy without libs.
const suggestionStyle = computed(() => {
    return {
        top: '100%',
        left: '0'
    }
})
</script>

<style scoped>
.math-node {
    margin: 1rem 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    page-break-inside: avoid;
}

.math-preview {
    width: 100%;
    text-align: center;
    padding: 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
    min-height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

.math-preview:hover {
    background-color: rgba(0, 0, 0, 0.03);
}

.math-preview.is-empty .placeholder {
    color: #9ca3af;
    font-style: italic;
    font-family: sans-serif;
    font-size: 0.9rem;
}

.math-preview.has-error {
    background-color: #fee2e2;
    border: 1px dashed #ef4444;
}

.error-placeholder {
    color: #ef4444;
    font-family: monospace;
}

.math-editor-container {
    width: 100%;
    max-width: 600px;
    margin-top: 0.5rem;
    position: relative;
    z-index: 10;
}

.textarea-wrapper {
    position: relative;
    width: 100%;
}

textarea {
    width: 100%;
    padding: 0.75rem;
    /* padding-left removed as icon is moved */
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9rem;
    background-color: transparent; /* Transparent for ghost text */
    resize: vertical;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    position: relative;
    z-index: 2;
    line-height: 1.5;
}

textarea:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    background-color: rgba(255, 255, 255, 0.9); /* Slight opacity to see ghost but keep readable */
}

/* Math Help Footer */
.math-help {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.25rem;
    color: #6b7280;
    font-size: 0.8rem;
}

.help-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background-color: #e5e7eb;
    color: #6b7280;
    font-size: 0.75rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
}

.help-icon:hover, .help-icon.is-active {
    background-color: #3b82f6;
    color: white;
}

/* Reference Panel in Sidebar */
.reference-panel-sidebar {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: white;
    overflow: hidden;
    z-index: 10;
}

.reference-header {
    padding: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
    background-color: #f9fafb;
}

.reference-search {
    width: 100%;
    padding: 0.25rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 0.8rem;
    outline: none;
}

.reference-search:focus {
    border-color: #3b82f6;
}

.reference-list {
    flex: 1;
    overflow-y: auto;
    /* max-height removed for sidebar mode */
}

.reference-header-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    padding: 0.5rem;
    background-color: #f3f4f6;
    font-size: 0.75rem;
    font-weight: bold;
    color: #4b5563;
    border-bottom: 1px solid #e5e7eb;
}

.reference-item {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    padding: 0.5rem;
    font-size: 0.8rem;
    border-bottom: 1px solid #f3f4f6;
    cursor: pointer;
    align-items: center;
}

.reference-item:hover {
    background-color: #eff6ff;
}

.reference-item:last-child {
    border-bottom: none;
}

.ref-name {
    color: #374151;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ref-symbol {
    text-align: center;
}

.ref-code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: #6b7280;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.reference-empty {
    padding: 1rem;
    text-align: center;
    color: #9ca3af;
    font-size: 0.8rem;
    font-style: italic;
}

/* Ghost Text Overlay */
.ghost-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 0.75rem; /* Match textarea padding */
    padding-right: 2rem;
    border: 1px solid transparent; /* Match border width */
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    pointer-events: none;
    white-space: pre-wrap;
    word-break: break-word;
    z-index: 1;
    color: transparent;
    overflow: hidden;
}

.ghost-text {
    color: #9ca3af; /* Gray text for ghost */
}

.invisible-text {
    color: transparent;
}

/* Suggestion List */
.suggestion-list {
    position: absolute;
    width: 200px;
    max-height: 200px;
    overflow-y: auto;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    z-index: 50;
    margin-top: 4px;
}

.suggestion-item {
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #374151;
}

.suggestion-item:hover, .suggestion-item.is-selected {
    background-color: #eff6ff;
    color: #2563eb;
}

.suggestion-ghost {
    font-size: 0.75rem;
    color: #9ca3af;
}

.math-error {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: #dc2626;
    background-color: #fef2f2;
    padding: 0.5rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.math-help {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: #6b7280;
    text-align: right;
}

/* Syntax Highlighting & Tools */
.transparent-textarea {
    color: transparent !important;
    background-color: transparent !important;
    caret-color: #000;
}

textarea.transparent-textarea:focus {
    background-color: transparent !important;
}

.syntax-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 0.75rem;
    border: 1px solid transparent;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
    pointer-events: none;
    z-index: 1;
    color: #333;
    box-sizing: border-box;
}

.hl-cmd { color: #007acc; font-weight: bold; }
.hl-brace { color: #a626a4; }
.hl-op { color: #986801; }
.hl-num { color: #50a14f; }

.math-tools {
    margin-right: auto;
    display: flex;
    gap: 4px;
}

.tool-btn {
    padding: 2px 8px;
    font-size: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    color: #666;
    transition: all 0.2s;
}

.tool-btn:hover {
    background: #f3f4f6;
    color: #333;
}

.tool-btn.active {
    background: #e0e7ff;
    color: #4f46e5;
    border-color: #c7d2fe;
}

.category-tabs {
    display: flex;
    gap: 6px;
    margin-top: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
}

.cat-tab {
    font-size: 0.75rem;
    padding: 2px 8px;
    background: #f3f4f6;
    border-radius: 12px;
    color: #6b7280;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
}

.cat-tab:hover {
    background: #e5e7eb;
}

.cat-tab.active {
    background: #3b82f6;
    color: white;
}

.category-tabs::-webkit-scrollbar {
    height: 2px;
}
.category-tabs::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 2px;
}

/* Numbering */
.math-node.is-numbered {
    counter-increment: equation;
}
.math-node.is-numbered .math-preview::after {
    content: "(" counter(equation) ")";
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #666;
    font-size: 0.9rem;
    pointer-events: none;
}
</style>

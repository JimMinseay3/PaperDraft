import { Node, mergeAttributes } from '@tiptap/core'

export default Node.create({
  name: 'commentMark',

  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'comment-mark',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['comment-mark', mergeAttributes(HTMLAttributes)]
  },
  
  addNodeView() {
    return ({ node }) => {
        const dom = document.createElement('span')
        dom.classList.add('comment-marker')
        dom.dataset.id = node.attrs.id
        dom.textContent = '💬'
        dom.title = 'Click to view comment'
        
        // Styles for right-side positioning
        dom.style.position = 'absolute'
        dom.style.right = '10px' // Inside the 50px padding of ProseMirror
        dom.style.cursor = 'pointer'
        dom.style.fontSize = '1em'
        dom.style.color = '#3b82f6' // blue-500
        dom.style.zIndex = '10' // Ensure it's above text
        
        // Add click listener
        dom.addEventListener('click', (e) => {
            e.stopPropagation()
            // Emit custom event that App.vue or Editor.vue can listen to
            const event = new CustomEvent('comment-selected', { detail: { id: node.attrs.id }, bubbles: true })
            dom.dispatchEvent(event)
        })
        
        return { dom }
    }
  }
})

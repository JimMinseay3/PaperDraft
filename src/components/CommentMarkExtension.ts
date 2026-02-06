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
        dom.style.cursor = 'pointer'
        dom.style.fontSize = '0.8em'
        dom.style.verticalAlign = 'super'
        dom.style.marginLeft = '2px'
        dom.style.marginRight = '2px'
        dom.style.color = '#3b82f6' // blue-500
        
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

import { Node, mergeAttributes, InputRule } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import MathNode from './MathNode.vue'

export const inputRegex = /^\$\$\s$/

export default Node.create({
  name: 'math',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      src: {
        default: '',
      },
      id: {
        default: null,
      },
      numbered: {
        default: true,
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="math"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'math' })]
  },

  addNodeView() {
    return VueNodeViewRenderer(MathNode)
  },

  addInputRules() {
    return [
      new InputRule({
        find: inputRegex,
        handler: ({ state, range, match }) => {
          const { tr } = state
          tr.delete(range.from, range.to)
          tr.replaceSelectionWith(this.type.create())
        },
      }),
    ]
  },
})

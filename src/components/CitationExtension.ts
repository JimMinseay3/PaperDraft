import { mergeAttributes, Node, Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { VueRenderer } from '@tiptap/vue-3'
import tippy from 'tippy.js'
import CitationList from './CitationList.vue'
import { PluginKey } from '@tiptap/pm/state'

export const CitationNode = Node.create({
  name: 'citation',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
      },
      label: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="citation"]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes({ 'data-type': 'citation' }, HTMLAttributes, { class: 'citation-chip bg-blue-100 text-blue-800 px-1 rounded text-xs cursor-pointer select-none' }),
      `[${node.attrs.label || 'Ref'}]`,
    ]
  },
})

export const CitationSuggestion = Extension.create({
  name: 'citationSuggestion',

  addOptions() {
    return {
      references: [],
      suggestion: {
        char: '@',
        pluginKey: new PluginKey('citationSuggestion'),
        command: ({ editor, range, props }: any) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'citation',
              attrs: { id: props.id, label: props.label || 'Ref' },
            })
            .run()
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        render: () => {
          let component: any
          let popup: any

          return {
            onStart: (props: any) => {
              component = new VueRenderer(CitationList, {
                props,
                editor: props.editor,
              })

              if (!props.clientRect) {
                return
              }

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              })
            },

            onUpdate(props: any) {
              component.updateProps(props)

              if (!props.clientRect) {
                return
              }

              popup[0].setProps({
                getReferenceClientRect: props.clientRect,
              })
            },

            onKeyDown(props: any) {
              if (props.event.key === 'Escape') {
                popup[0].hide()
                return true
              }

              // Check if component and ref exist before calling onKeyDown
              if (component && component.ref && typeof component.ref.onKeyDown === 'function') {
                  return component.ref.onKeyDown(props)
              }
              return false
            },

            onExit() {
              popup[0].destroy()
              component.destroy()
            },
          }
        },
      }),
    ]
  },
})

export default CitationNode

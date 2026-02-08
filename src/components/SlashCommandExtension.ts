import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { VueRenderer } from '@tiptap/vue-3'
import tippy from 'tippy.js'
import SlashCommandsList from './SlashCommandsList.vue'
import { 
  Type, 
  Heading1, 
  Heading2, 
  Heading3,
  Heading4,
  List, 
  ListOrdered, 
  CheckSquare, 
  Code,
  Image,
  Sigma
} from 'lucide-vue-next'
import { markRaw } from 'vue'

export default Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range })
        },
      },
    }
  },

  addStorage() {
    return {
      items: [
        {
          title: 'Heading 1',
          icon: markRaw(Heading1),
          command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
          },
        },
        {
          title: 'Heading 2',
          icon: markRaw(Heading2),
          command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
          },
        },
        {
          title: 'Heading 3',
          icon: markRaw(Heading3),
          command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
          },
        },
        {
          title: 'Heading 4',
          icon: markRaw(Heading4),
          command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run()
          },
        },
        {
          title: 'Text',
          icon: markRaw(Type),
          command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setNode('paragraph').run()
          },
        },
        {
          title: 'Bullet List',
          icon: markRaw(List),
          command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).toggleBulletList().run()
          },
        },
        {
          title: 'Numbered List',
          icon: markRaw(ListOrdered),
          command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).toggleOrderedList().run()
          },
        },
        {
          title: 'Task List',
          icon: markRaw(CheckSquare),
          command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).toggleTaskList().run()
          },
        },
        {
          title: 'Code Block',
          icon: markRaw(Code),
          command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
          },
        },
        {
          title: 'Math Formula',
          icon: markRaw(Sigma),
          command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).insertContent({ type: 'math' }).run()
          },
        },
        {
          title: 'Image',
          icon: markRaw(Image),
          command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).run()
            // Call the custom command registered in Editor.vue
            if (editor.commands.triggerImageUpload) {
              editor.commands.triggerImageUpload()
            }
          },
        },
      ],
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          return this.storage.items.filter((item: any) => 
            item.title.toLowerCase().startsWith(query.toLowerCase())
          )
        },
        render: () => {
          let component: any
          let popup: any

          return {
            onStart: (props: any) => {
              component = new VueRenderer(SlashCommandsList, {
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

              return component.ref?.onKeyDown(props)
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

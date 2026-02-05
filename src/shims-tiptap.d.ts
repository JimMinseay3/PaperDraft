
declare module '@tiptap/vue-3' {
  import { DefineComponent, Ref } from 'vue'
  
  export const EditorContent: DefineComponent<{ editor: any }, {}, any>
  export const FloatingMenu: DefineComponent<any, {}, any>
  export const BubbleMenu: DefineComponent<any, {}, any>
  export function useEditor(options: any): Ref<any>
  export class VueRenderer {
    constructor(component: any, props: any)
    element: HTMLElement
    ref: any
    updateProps(props: any): void
    destroy(): void
  }
}

declare module '@tiptap/vue-3/menus' {
  import { DefineComponent } from 'vue'
  
  export const BubbleMenu: DefineComponent<any, {}, any>
  export const FloatingMenu: DefineComponent<any, {}, any>
  export function useEditor(options: any): Ref<any>
}

declare module '@tiptap/starter-kit' {
  const StarterKit: any
  export default StarterKit
}

declare module '@tiptap/extension-image' {
  const Image: any
  export default Image
}

declare module '@tiptap/extension-placeholder' {
  const Placeholder: any
  export default Placeholder
}

declare module '@tiptap/extension-highlight' {
  const Highlight: any
  export default Highlight
}

declare module '@tiptap/extension-task-list' {
  const TaskList: any
  export default TaskList
}

declare module '@tiptap/extension-task-item' {
  const TaskItem: any
  export default TaskItem
}

declare module '@tiptap/extension-floating-menu' {
  const FloatingMenuExtension: any
  export default FloatingMenuExtension
}

declare module '@tiptap/extension-bubble-menu' {
  import { DefineComponent } from 'vue'
  const BubbleMenuExtension: any
  export const BubbleMenu: DefineComponent<any, {}, any>
  export default BubbleMenuExtension
}

import '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageUpload: {
      triggerImageUpload: () => ReturnType
    }
  }
}

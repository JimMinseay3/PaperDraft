import Image from '@tiptap/extension-image'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import ImageView from './ImageView.vue'

export default Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: '',
        renderHTML: attributes => {
          return {
            'data-caption': attributes.caption,
          }
        },
      },
      fileName: {
        default: null,
      },
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(ImageView)
  },
})
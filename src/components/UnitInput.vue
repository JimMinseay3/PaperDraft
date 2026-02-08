<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string | number
  unit?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const numericValue = computed({
  get: () => {
    if (!props.modelValue) return ''
    const val = parseFloat(props.modelValue.toString())
    return isNaN(val) ? '' : val
  },
  set: (val) => {
    if (val === '' || val === null || val === undefined) {
      // If cleared, maybe keep unit? Or just empty? 
      // Usually better to emit empty string or '0' + unit.
      // Let's assume empty string implies no value.
      // But for css, we probably want 0 or inherit.
      // For now, let's just emit what is typed + unit.
      // If val is empty, we emit empty string (invalid css usually, but safer than 0em if intent is unset)
      // Actually, if user clears input, we probably want to preserve unit if they type again.
      emit('update:modelValue', '')
    } else {
      emit('update:modelValue', `${val}${props.unit || ''}`)
    }
  }
})

const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    const val = target.value
    if (val === '') {
        emit('update:modelValue', '')
    } else {
        emit('update:modelValue', `${val}${props.unit || ''}`)
    }
}
</script>

<template>
  <div class="flex items-center rounded-md border border-gray-300 overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white">
    <input 
      type="number" 
      step="0.1"
      :value="numericValue" 
      @input="handleInput"
      class="w-full px-2 py-1 text-sm border-none focus:ring-0 focus:outline-none min-w-0"
      :placeholder="placeholder"
    />
    <span v-if="unit" class="bg-gray-50 px-2 py-1 text-xs text-gray-500 border-l border-gray-200 select-none whitespace-nowrap">{{ unit }}</span>
  </div>
</template>
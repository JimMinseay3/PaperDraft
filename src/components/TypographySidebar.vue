<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { ChevronDown, ChevronRight, Type } from 'lucide-vue-next'
import UnitInput from './UnitInput.vue'

const { t } = useI18n()

const props = defineProps<{
  globalStyles: any
}>()

const expanded = ref({
  fonts: true,
  h1: false,
  h2: false,
  h3: false,
  h4: false,
  body: false
})

const toggle = (key: keyof typeof expanded.value) => {
  expanded.value[key] = !expanded.value[key]
}

// Font Options
const enFonts = ['Times New Roman', 'Arial', 'Georgia', 'Verdana', 'Courier New']
const zhFonts = [
  { label: '宋体 (SimSun)', value: 'SimSun' },
  { label: '黑体 (SimHei)', value: 'SimHei' },
  { label: '楷体 (KaiTi)', value: 'KaiTi' },
  { label: '等线 (DengXian)', value: 'DengXian' },
  { label: '微软雅黑 (Microsoft YaHei)', value: 'Microsoft YaHei' }
]
</script>

<template>
  <div class="h-full flex flex-col bg-white border-r border-gray-200">
    <!-- Header -->
    <div class="h-10 px-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
      <h2 class="text-xs font-bold text-gray-700 uppercase flex items-center">
        <Type class="w-4 h-4 mr-2 text-blue-500" />
        {{ t('typography.title') }}
      </h2>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-6">
      <!-- Global Fonts -->
      <div>
        <button @click="toggle('fonts')" class="w-full flex items-center justify-between text-sm font-medium text-gray-900 border-b pb-1 focus:outline-none group">
          <span>{{ t('typography.globalFonts') }}</span>
          <component :is="expanded.fonts ? ChevronDown : ChevronRight" class="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
        </button>
        <div v-show="expanded.fonts" class="space-y-3 pt-2">
          <div class="space-y-2">
              <label class="block text-xs text-gray-500">{{ t('typography.enFont') }}</label>
              <select v-model="globalStyles.fonts.en" class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md">
                  <option v-for="font in enFonts" :key="font" :value="font">{{ font }}</option>
              </select>
          </div>
          <div class="space-y-2">
              <label class="block text-xs text-gray-500">{{ t('typography.zhFont') }}</label>
              <select v-model="globalStyles.fonts.zh" class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md">
                  <option v-for="font in zhFonts" :key="font.value" :value="font.value">{{ font.label }}</option>
              </select>
          </div>
        </div>
      </div>

      <!-- Heading 1 -->
      <div>
        <button @click="toggle('h1')" class="w-full flex items-center justify-between text-sm font-medium text-gray-900 border-b pb-1 focus:outline-none group">
          <span>{{ t('typography.heading1') }}</span>
          <component :is="expanded.h1 ? ChevronDown : ChevronRight" class="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
        </button>
        <div v-show="expanded.h1" class="grid grid-cols-2 gap-2 pt-2">
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.size') }}</label>
                <UnitInput v-model="globalStyles.h1.size" unit="em" placeholder="2.25" />
            </div>
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.color') }}</label>
                <div class="flex items-center gap-2">
                    <input type="color" v-model="globalStyles.h1.color" class="h-8 w-8 p-0 border-0 rounded cursor-pointer">
                    <span class="text-xs text-gray-400 font-mono">{{ globalStyles.h1.color }}</span>
                </div>
            </div>
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.spacingBefore') }}</label>
                <UnitInput v-model="globalStyles.h1.marginTop" unit="em" placeholder="1" />
            </div>
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.spacingAfter') }}</label>
                <UnitInput v-model="globalStyles.h1.marginBottom" unit="em" placeholder="0.5" />
            </div>
        </div>
      </div>

      <!-- Heading 2 -->
      <div>
        <button @click="toggle('h2')" class="w-full flex items-center justify-between text-sm font-medium text-gray-900 border-b pb-1 focus:outline-none group">
          <span>{{ t('typography.heading2') }}</span>
          <component :is="expanded.h2 ? ChevronDown : ChevronRight" class="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
        </button>
        <div v-show="expanded.h2" class="grid grid-cols-2 gap-2 pt-2">
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.size') }}</label>
                <UnitInput v-model="globalStyles.h2.size" unit="em" placeholder="1.5" />
            </div>
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.color') }}</label>
                <div class="flex items-center gap-2">
                    <input type="color" v-model="globalStyles.h2.color" class="h-8 w-8 p-0 border-0 rounded cursor-pointer">
                    <span class="text-xs text-gray-400 font-mono">{{ globalStyles.h2.color }}</span>
                </div>
            </div>
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.spacingBefore') }}</label>
                <UnitInput v-model="globalStyles.h2.marginTop" unit="em" placeholder="1" />
            </div>
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.spacingAfter') }}</label>
                <UnitInput v-model="globalStyles.h2.marginBottom" unit="em" placeholder="0.5" />
            </div>
        </div>
      </div>

      <!-- Heading 3 -->
      <div>
        <button @click="toggle('h3')" class="w-full flex items-center justify-between text-sm font-medium text-gray-900 border-b pb-1 focus:outline-none group">
          <span>{{ t('typography.heading3') }}</span>
          <component :is="expanded.h3 ? ChevronDown : ChevronRight" class="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
        </button>
        <div v-show="expanded.h3" class="grid grid-cols-2 gap-2 pt-2">
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.size') }}</label>
                <UnitInput v-model="globalStyles.h3.size" unit="em" placeholder="1.25" />
            </div>
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.color') }}</label>
                <div class="flex items-center gap-2">
                    <input type="color" v-model="globalStyles.h3.color" class="h-8 w-8 p-0 border-0 rounded cursor-pointer">
                    <span class="text-xs text-gray-400 font-mono">{{ globalStyles.h3.color }}</span>
                </div>
            </div>
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.spacingBefore') }}</label>
                <UnitInput v-model="globalStyles.h3.marginTop" unit="em" placeholder="1" />
            </div>
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.spacingAfter') }}</label>
                <UnitInput v-model="globalStyles.h3.marginBottom" unit="em" placeholder="0.5" />
            </div>
        </div>
      </div>

      <!-- Heading 4 -->
      <div>
        <button @click="toggle('h4')" class="w-full flex items-center justify-between text-sm font-medium text-gray-900 border-b pb-1 focus:outline-none group">
          <span>{{ t('typography.heading4') }}</span>
          <component :is="expanded.h4 ? ChevronDown : ChevronRight" class="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
        </button>
        <div v-show="expanded.h4" class="grid grid-cols-2 gap-2 pt-2">
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.size') }}</label>
                <UnitInput v-model="globalStyles.h4.size" unit="em" placeholder="1.1" />
            </div>
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.color') }}</label>
                <div class="flex items-center gap-2">
                    <input type="color" v-model="globalStyles.h4.color" class="h-8 w-8 p-0 border-0 rounded cursor-pointer">
                    <span class="text-xs text-gray-400 font-mono">{{ globalStyles.h4.color }}</span>
                </div>
            </div>
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.spacingBefore') }}</label>
                <UnitInput v-model="globalStyles.h4.marginTop" unit="em" placeholder="1" />
            </div>
            <div>
                <label class="block text-xs text-gray-500">{{ t('typography.spacingAfter') }}</label>
                <UnitInput v-model="globalStyles.h4.marginBottom" unit="em" placeholder="0.5" />
            </div>
        </div>
      </div>

      <!-- Body Text -->
      <div>
        <button @click="toggle('body')" class="w-full flex items-center justify-between text-sm font-medium text-gray-900 border-b pb-1 focus:outline-none group">
          <span>{{ t('typography.bodyText') }}</span>
          <component :is="expanded.body ? ChevronDown : ChevronRight" class="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
        </button>
        <div v-show="expanded.body" class="space-y-3 pt-2">
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs text-gray-500">{{ t('typography.size') }}</label>
                    <UnitInput v-model="globalStyles.body.size" unit="em" placeholder="1" />
                </div>
                <div>
                    <label class="block text-xs text-gray-500">{{ t('typography.color') }}</label>
                    <div class="flex items-center gap-2">
                        <input type="color" v-model="globalStyles.body.color" class="h-8 w-8 p-0 border-0 rounded cursor-pointer">
                        <span class="text-xs text-gray-400 font-mono">{{ globalStyles.body.color }}</span>
                    </div>
                </div>
            </div>
            
            <h4 class="text-xs font-medium text-gray-700 mt-2">{{ t('typography.paragraphLayout') }}</h4>
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs text-gray-500">{{ t('typography.firstLineIndent') }}</label>
                    <UnitInput v-model="globalStyles.body.indent" unit="em" placeholder="2" />
                </div>
                <div>
                    <label class="block text-xs text-gray-500">{{ t('typography.lineHeight') }}</label>
                    <UnitInput v-model="globalStyles.body.lineHeight" unit="" placeholder="1.6" />
                </div>
                <div>
                    <label class="block text-xs text-gray-500">{{ t('typography.spacingBefore') }}</label>
                    <UnitInput v-model="globalStyles.body.marginTop" unit="em" placeholder="0" />
                </div>
                <div>
                    <label class="block text-xs text-gray-500">{{ t('typography.spacingAfter') }}</label>
                    <UnitInput v-model="globalStyles.body.marginBottom" unit="em" placeholder="1" />
                </div>
            </div>
        </div>
      </div>
    </div>
  </div>
</template>
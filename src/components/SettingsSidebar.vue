<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, watch } from 'vue'

const { t, locale } = useI18n()

const currentLanguage = ref(locale.value)

watch(currentLanguage, (newLang) => {
  locale.value = newLang
})
</script>

<template>
  <div class="h-full flex flex-col bg-white border-r border-gray-200">
    <div class="p-4 border-b border-gray-200">
      <h2 class="text-lg font-semibold text-gray-800">{{ t('settings.title') }}</h2>
    </div>

    <div class="p-4 space-y-6">
      <!-- Language Settings -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">{{ t('settings.language') }}</label>
        <select 
          v-model="currentLanguage"
          class="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="zh">中文 (Chinese)</option>
          <option value="en">English</option>
        </select>
      </div>

      <!-- Theme Settings (Placeholder) -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">{{ t('settings.theme') }}</label>
        <div class="flex items-center space-x-4">
          <div class="flex items-center">
            <input id="theme-light" name="theme" type="radio" checked class="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300">
            <label for="theme-light" class="ml-2 block text-sm text-gray-900">{{ t('settings.themeLight') }}</label>
          </div>
          <div class="flex items-center">
            <input id="theme-dark" name="theme" type="radio" disabled class="focus:ring-blue-500 h-4 w-4 text-gray-300 border-gray-300">
            <label for="theme-dark" class="ml-2 block text-sm text-gray-400">{{ t('settings.themeDark') }}</label>
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="pt-6 border-t border-gray-200">
        <h3 class="text-sm font-medium text-gray-900">{{ t('settings.about') }}</h3>
        <p class="mt-1 text-xs text-gray-500">PaperDraft v0.1.0</p>
      </div>
    </div>
  </div>
</template>

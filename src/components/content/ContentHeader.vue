<template>
  <header class="content-header">
    <h1 class="content-title">{{ title }}</h1>
    <div class="content-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<style scoped>
@reference "tailwindcss";

.content-header {
  @apply relative z-10 w-full min-h-12 sm:min-h-14 flex items-center gap-2 sm:gap-3 pt-3 sm:pt-4 bg-white;
  padding-left: 16px;
  padding-right: 16px;
  padding-bottom: 0;
}

.content-title {
  @apply m-0 min-w-0 flex-1 truncate text-sm font-medium leading-6 text-slate-900 max-sm:text-xs;
}

.content-actions {
  @apply flex items-center justify-end gap-1;
}

</style>

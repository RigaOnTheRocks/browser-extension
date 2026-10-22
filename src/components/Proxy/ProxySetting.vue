<script lang="ts" setup>
import { NCheckbox, NTooltip } from 'naive-ui';

const {
  checked,
  disabled = false,
  hint,
  label,
} = defineProps<{
  checked: boolean;
  disabled?: boolean;
  hint: string;
  label: string;
}>();

const emit = defineEmits<{ update: [checked: boolean] }>();
</script>

<template>
  <!-- The popup is narrow, so the hint has to wrap instead of running off it -->
  <n-tooltip placement="top" :style="{ maxWidth: '15rem' }">
    <template #trigger>
      <n-checkbox :checked :disabled :focusable="false" @update-checked="emit('update', $event)">
        {{ label }}
      </n-checkbox>
    </template>
    <span>{{ hint }}</span>
  </n-tooltip>
</template>

<script lang="ts" setup>
import ProxySetting from '@/components/Proxy/ProxySetting.vue';

import useRandomProxy from '@/composables/useRandomProxy';

const { randomProxyDNS, randomProxyOverrides, setRandomProxyDNS, setRandomProxyOverrides } =
  useRandomProxy();
</script>

<template>
  <div class="flex flex-wrap gap-x-4 gap-y-1">
    <ProxySetting
      label="Override selections"
      hint="Checked: random proxies replace every selection. Unchecked: only domains without one of their own get a random proxy."
      :checked="randomProxyOverrides"
      @update="setRandomProxyOverrides"
    />
    <ProxySetting
      label="Mullvad DNS"
      hint="Checked: Mullvad resolves hostnames, through the proxy. Unchecked: this computer does."
      :checked="randomProxyDNS"
      @update="setRandomProxyDNS"
    />
  </div>
</template>

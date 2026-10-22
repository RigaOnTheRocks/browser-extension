<script lang="ts" setup>
import { computed, ref, watchEffect } from 'vue';
import { NCard, NCollapseTransition, NIcon, NSwitch, NTag } from 'naive-ui';

import Button from '@/components/Buttons/Button.vue';
import FeChevronDown from '@/components/Icons/FeChevronDown.vue';
import FeChevronUp from '@/components/Icons/FeChevronUp.vue';
import IconLabel from '@/components/IconLabel.vue';
import SplitButton from '@/components/Buttons/SplitButton.vue';
import TitleCategory from '@/components/TitleCategory.vue';
import InUseTag from '@/components/Proxy/InUseTag.vue';
import ProxySetting from '@/components/Proxy/ProxySetting.vue';
import RandomProxySettings from '@/components/Proxy/RandomProxySettings.vue';

import { checkDomain } from '@/helpers/domain';

import useActiveTab from '@/composables/useActiveTab';
import useLocations from '@/composables/useLocations';
import useProxyPermissions from '@/composables/useProxyPermissions';
import useRandomProxy from '@/composables/useRandomProxy';
import useSocksProxy from '@/composables/useSocksProxy';
import useSocksProxies from '@/composables/useSocksProxies';
import useStore from '@/composables/useStore';

const showDetailsAllWebsites = ref(false);
const showDetailsCurrentDomain = ref(false);
const showDetailsRandom = ref(false);

const { activeTabHost, isAboutPage, isExtensionPage } = useActiveTab();
const { proxySelect } = useLocations();
const { isGranted, requestPermissions } = useProxyPermissions();
const { toggleRandomProxyMode, randomProxyMode, randomProxyOverrides } = useRandomProxy();
const {
  allowProxy,
  canChooseProxyScope,
  currentEffectiveProxyHost,
  currentHostProxyEnabled,
  currentHostExcluded,
  currentScopeExcluded,
  currentScopeHost,
  currentScopeProxyDetails,
  currentScopeProxyDNS,
  currentScopeProxyEnabled,
  globalProxyDNS,
  globalProxyEnabled,
  includesSubdomains,
  neverProxyHost,
  removeCustomProxy,
  removeGlobalProxy,
  setGlobalProxyDNS,
  setHostProxyDNS,
  setIncludeSubdomains,
  shadowingProxyHost,
  toggleHostProxy,
  toggleGlobalProxy,
} = useSocksProxy();

const { globalProxyDetails, isStorageReady } = useStore();
const { getSocksProxies } = useSocksProxies();

const isCurrentHostProxyOverriden = computed(() => randomProxyOverrides.value);

const isAllWebsitesProxyOverriden = computed(() =>
  !randomProxyMode.value && !currentHostProxyEnabled.value && !currentHostExcluded.value
    ? false
    : true,
);

// Without a selection of its own, the current domain gets a random proxy
const isCurrentDomainRandomlyProxied = computed(
  () =>
    randomProxyMode.value &&
    !randomProxyOverrides.value &&
    !isAboutPage.value &&
    !isExtensionPage.value &&
    !currentHostProxyEnabled.value &&
    !currentHostExcluded.value,
);

// The active tab and the stored proxies are both read asynchronously: showing
// the settings before they are in would show the defaults as if they were the
// ones configured.
const isCurrentDomainReady = computed(() => isStorageReady.value && Boolean(activeTabHost.value));

const subdomainsHint = computed(() => {
  const { domain } = checkDomain(activeTabHost.value);

  // On a host without a subdomain there is nothing to narrow down to: the
  // proxy of a registrable domain always covers its subdomains.
  if (!canChooseProxyScope.value) {
    return `The proxy for ${domain} always covers its subdomains. Open a subdomain to give it a proxy of its own.`;
  }

  return `Checked: ${domain} and its subdomains. Unchecked: ${activeTabHost.value} alone.`;
});

const dnsHint = computed(() =>
  currentScopeProxyDetails.value
    ? 'Checked: Mullvad resolves hostnames, through the proxy. Unchecked: this computer does.'
    : 'Applies to the location you select next. Checked: Mullvad resolves hostnames. Unchecked: this computer does.',
);

// The line above names the host a proxy would be set for, which is not always
// the host an exclusion applies to
const neverProxyTitle = computed(() => `Never proxy ${currentEffectiveProxyHost.value}`);

const globalDnsHint = computed(() =>
  globalProxyDetails.value.server
    ? 'Checked: Mullvad resolves hostnames, through the proxy. Unchecked: this computer does.'
    : 'Applies to the location you select next. Checked: Mullvad resolves hostnames. Unchecked: this computer does.',
);

const proxyLocation = (details: { city?: string; country?: string; server?: string }) =>
  [[details.city, details.country].filter(Boolean).join(', '), details.server]
    .filter(Boolean)
    .join(' · ');

watchEffect(() => {
  if (isGranted.value) {
    getSocksProxies();
  }
});
</script>

<template>
  <div>
    <TitleCategory v-if="!isAboutPage && !isExtensionPage" title="Proxies" class="ml-3 mb-2" />
  </div>
  <n-card v-if="isGranted" :bordered="false" class="mb-2">
    <div v-if="!isAboutPage && !isExtensionPage" class="border-[#354f6b] border-b-1 mb-3 pb-3">
      <div
        class="flex justify-between cursor-pointer"
        @click="showDetailsCurrentDomain = !showDetailsCurrentDomain"
      >
        <div class="flex">
          <TitleCategory :level="3" title="Current domain" />
          <InUseTag
            v-if="!isCurrentHostProxyOverriden && (currentHostProxyEnabled || currentHostExcluded)"
          />
        </div>

        <div class="flex flex-row items-center">
          <n-switch
            v-if="currentScopeProxyDetails && !currentScopeExcluded"
            :value="currentScopeProxyEnabled"
            :disabled="isCurrentHostProxyOverriden"
            @update-value="toggleHostProxy(currentScopeHost)"
            @click.stop
            class="mr-2"
          />

          <n-icon size="20" class="cursor-pointer">
            <FeChevronUp v-if="showDetailsCurrentDomain" />
            <FeChevronDown v-else />
          </n-icon>
        </div>
      </div>

      <n-collapse-transition :show="showDetailsCurrentDomain" class="mt-2">
        <IconLabel v-if="!isCurrentDomainReady" type="spinner" text="Loading settings…" />
        <template v-else>
          <IconLabel type="info" class="mb-2">
            <span v-if="currentScopeExcluded">
              <strong>{{ currentScopeHost }}</strong> is set to never be proxied.
            </span>
            <span v-else-if="currentScopeProxyDetails">
              <strong>{{ currentScopeHost }}</strong> ·
              {{ proxyLocation(currentScopeProxyDetails) }}
            </span>
            <span v-else>
              No proxy for <strong>{{ currentScopeHost }}</strong> yet.
            </span>
          </IconLabel>

          <div class="flex flex-wrap gap-x-4 gap-y-1 mb-3">
            <ProxySetting
              v-if="canChooseProxyScope"
              label="Include all subdomains"
              :checked="includesSubdomains"
              :hint="subdomainsHint"
              @update="setIncludeSubdomains"
            />
            <ProxySetting
              v-if="!currentScopeExcluded"
              label="Mullvad DNS"
              :checked="currentScopeProxyDNS"
              :hint="dnsHint"
              @update="setHostProxyDNS(currentScopeHost, $event)"
            />
          </div>

          <IconLabel v-if="shadowingProxyHost" type="warning" class="mb-3">
            <span
              >The proxy set for <strong>{{ shadowingProxyHost }}</strong> takes precedence over
              this one.</span
            >
          </IconLabel>

          <div v-if="currentScopeExcluded">
            <Button size="small" @click="allowProxy(currentScopeHost)">Allow proxying</Button>
          </div>
          <div v-else class="flex justify-between">
            <Button size="small" @click="proxySelect(currentScopeHost, includesSubdomains)">
              {{ currentScopeProxyDetails ? 'Change location' : 'Select location' }}
            </Button>
            <SplitButton
              v-if="currentScopeProxyDetails"
              size="small"
              main-color="error"
              sub-color="white"
              main-text="Reset"
              sub-text="Never proxy"
              :sub-title="neverProxyTitle"
              @main-click="removeCustomProxy(currentScopeHost)"
              @sub-click="neverProxyHost(currentEffectiveProxyHost)"
            />
            <Button
              v-else
              size="small"
              class="flex items-center justify-center"
              :title="neverProxyTitle"
              @click="neverProxyHost(currentEffectiveProxyHost)"
            >
              Never proxy
            </Button>
          </div>
        </template>
      </n-collapse-transition>
    </div>

    <div class="border-[#354f6b] border-b-1 mb-3 pb-3">
      <div
        class="flex justify-between cursor-pointer"
        @click="showDetailsAllWebsites = !showDetailsAllWebsites"
      >
        <div class="flex flex-row items-center">
          <TitleCategory :level="3" title="All websites" />
          <InUseTag v-if="!isAllWebsitesProxyOverriden && globalProxyEnabled" />
        </div>

        <div class="flex flex-row items-center">
          <n-switch
            v-if="globalProxyDetails.server"
            :value="globalProxyEnabled"
            :disabled="isAllWebsitesProxyOverriden"
            @update-value="toggleGlobalProxy()"
            @click.stop
            class="mr-2"
          />

          <n-icon size="20" class="cursor-pointer">
            <FeChevronUp v-if="showDetailsAllWebsites" />
            <FeChevronDown v-else />
          </n-icon>
        </div>
      </div>

      <n-collapse-transition :show="showDetailsAllWebsites" class="mt-2">
        <IconLabel v-if="!isStorageReady" type="spinner" text="Loading settings…" />
        <template v-else>
          <IconLabel type="info" class="mb-2">
            <span v-if="globalProxyDetails.server">
              {{ proxyLocation(globalProxyDetails) }}, except for the domains with a proxy of their
              own.
            </span>
            <span v-else>No proxy for the websites without one of their own yet.</span>
          </IconLabel>

          <div class="mb-3">
            <ProxySetting
              label="Mullvad DNS"
              :checked="globalProxyDNS"
              :hint="globalDnsHint"
              @update="setGlobalProxyDNS"
            />
          </div>

          <div class="flex justify-between">
            <Button size="small" @click="proxySelect()" class="mr-2">
              {{ globalProxyDetails.server ? 'Change location' : 'Select location' }}
            </Button>
            <Button
              v-if="globalProxyDetails.server"
              size="small"
              color="error"
              @click="removeGlobalProxy"
            >
              Reset
            </Button>
          </div>
        </template>
      </n-collapse-transition>
    </div>

    <div class="">
      <div
        class="flex justify-between cursor-pointer"
        @click="showDetailsRandom = !showDetailsRandom"
      >
        <div class="flex flex-row items-center">
          <TitleCategory :level="3" title="Random mode" />
          <InUseTag v-if="randomProxyMode" />
        </div>

        <div class="flex flex-row items-center">
          <n-switch
            :value="randomProxyMode"
            @update-value="toggleRandomProxyMode()"
            @click.stop
            class="mr-2"
          />

          <n-icon size="20" class="cursor-pointer">
            <FeChevronUp v-if="showDetailsRandom" />
            <FeChevronDown v-else />
          </n-icon>
        </div>
      </div>

      <n-collapse-transition :show="showDetailsRandom" class="mt-2">
        <IconLabel type="info" class="mb-2">
          <span>
            A random proxy per domain, rotated when the browser restarts.
            <template v-if="isCurrentDomainRandomlyProxied">
              The current domain has no selection of its own, so it uses one.
            </template>
          </span>
        </IconLabel>

        <RandomProxySettings />
      </n-collapse-transition>
    </div>
  </n-card>

  <n-card v-else type="line" justify-content="start">
    <TitleCategory :level="2" title="Proxy permissions missing" />

    <IconLabel type="info" class="mb-2">
      <span>In order to use proxies, the following permissions are required:</span>
    </IconLabel>

    <div class="flex flex-col">
      <ul>
        <li>
          <strong><n-tag round size="small" type="info"> tabs </n-tag></strong> to show proxy
          settings from the active tab
        </li>
        <li>
          <strong><n-tag round size="small" type="info"> proxy </n-tag></strong> to configure and
          use Mullvad proxy servers
        </li>
        <li>
          <strong><n-tag round size="small" type="info"> all_urls </n-tag></strong> to have granular
          proxy settings
        </li>
      </ul>

      <Button size="small" class="mt-3" @click="requestPermissions"> Grant permissions </Button>
    </div>
  </n-card>
</template>

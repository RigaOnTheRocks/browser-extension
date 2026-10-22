import { computed } from 'vue';

import { reloadOptions } from '@/helpers/browserExtension';
import { updateCurrentTabProxyBadge } from '@/helpers/proxyBadge';
import { RandomProxyScope } from '@/helpers/socksProxy/socksProxy.types';

import useStore from '@/composables/useStore';
import useConnectionStatus from '@/composables/useConnection/useConnectionStatus';

const { randomProxyDNS, randomProxyMode, randomProxyScope } = useStore();
const { checkStatus } = useConnectionStatus();

// Whether random mode replaces the domain and global selections, as opposed to
// only filling in the domains without a selection of their own.
const randomProxyOverrides = computed(
  () => randomProxyMode.value && randomProxyScope.value === RandomProxyScope.override,
);

const useRandomProxy = () => {
  const toggleRandomProxyMode = () => {
    randomProxyMode.value = !randomProxyMode.value;
    reloadOptions();
    updateCurrentTabProxyBadge();
    checkStatus();
  };

  const setRandomProxyDNS = (proxyDNS: boolean) => {
    randomProxyDNS.value = proxyDNS;
    reloadOptions();
    updateCurrentTabProxyBadge();
    // Nothing is routed through a random proxy while the mode is off, so the
    // connection check would only repeat itself
    if (randomProxyMode.value) {
      checkStatus();
    }
  };

  const setRandomProxyOverrides = (overrides: boolean) => {
    randomProxyScope.value = overrides ? RandomProxyScope.override : RandomProxyScope.unselected;
    reloadOptions();
    updateCurrentTabProxyBadge();
    if (randomProxyMode.value) {
      checkStatus();
    }
  };

  return {
    randomProxyDNS,
    randomProxyMode,
    randomProxyOverrides,
    randomProxyScope,
    setRandomProxyDNS,
    setRandomProxyOverrides,
    toggleRandomProxyMode,
  };
};

export default useRandomProxy;

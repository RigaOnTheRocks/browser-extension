import type {
  ProxyDetails,
  ProxyDetailsMap,
  ProxyInfo,
  ProxyInfoMap,
} from '@/helpers/socksProxy/socksProxy.types';
import { ProxyScope, RandomProxyScope } from '@/helpers/socksProxy/socksProxy.types';
import { Tab } from '@/helpers/browserExtension';

import { ref } from 'vue';

import useBrowserStorageLocal from '@/composables/useBrowserStorageLocal';
import { SocksProxy } from '@/helpers/socksProxy/socksProxies.types';
import { HistoryEntriesMap } from '@/composables/useProxyHistory/HistoryEntries.types';
import { ConnCheckConfig, DEFAULT_CONFIG } from '@/helpers/config';

const connCheckConfig = useBrowserStorageLocal<ConnCheckConfig>('connCheckConfig', DEFAULT_CONFIG);
const excludedHosts = useBrowserStorageLocal<string[]>('excludedHosts', []);
const flatProxiesList = useBrowserStorageLocal<SocksProxy[]>('flatProxiesList', []);
const globalProxy = useBrowserStorageLocal<ProxyInfo>('globalProxy', {} as ProxyInfo);
const globalProxyDetails = useBrowserStorageLocal<ProxyDetails>(
  'globalProxyDetails',
  {} as ProxyDetails,
);
const historyEntries = useBrowserStorageLocal<HistoryEntriesMap>('historyEntries', {});
const hostProxies = useBrowserStorageLocal<ProxyInfoMap>('hostProxies', {});
const hostProxiesDetails = useBrowserStorageLocal<ProxyDetailsMap>('hostProxiesDetails', {});
const optionsActiveTab = useBrowserStorageLocal<Tab>('optionsActiveTab', Tab.SETTINGS);
const proxyAutoReload = useBrowserStorageLocal('proxyAutoReload', false);
const proxyScopePreference = useBrowserStorageLocal<ProxyScope>(
  'proxyScopePreference',
  ProxyScope.domain,
);
const randomProxyDNS = useBrowserStorageLocal('randomProxyDNS', true);
const randomProxyMode = useBrowserStorageLocal('randomProxyMode', false);
const randomProxyScope = useBrowserStorageLocal<RandomProxyScope>(
  'randomProxyScope',
  RandomProxyScope.override,
);
const webRTCStatus = useBrowserStorageLocal('webRTCStatus', true);

/**
 * The values above are read from the storage asynchronously, so they hold their
 * default until that read resolves. Reading the same keys once more tells us
 * when they are populated: storage requests are answered in the order they are
 * made, and this one is made last.
 */
const isStorageReady = ref(false);
const waitForStorage = async () => {
  try {
    await browser.storage.local.get(['excludedHosts', 'hostProxies', 'hostProxiesDetails']);
  } catch (e: unknown) {
    console.error('Could not read the stored proxy settings:', e);
  }
  // Even on failure, so that the settings are never hidden for good
  isStorageReady.value = true;
};
void waitForStorage();

const useStore = () => {
  return {
    connCheckConfig,
    excludedHosts,
    flatProxiesList,
    globalProxy,
    globalProxyDetails,
    historyEntries,
    hostProxies,
    isStorageReady,
    hostProxiesDetails,
    optionsActiveTab,
    proxyAutoReload,
    proxyScopePreference,
    randomProxyDNS,
    randomProxyMode,
    randomProxyScope,
    webRTCStatus,
  };
};

export default useStore;

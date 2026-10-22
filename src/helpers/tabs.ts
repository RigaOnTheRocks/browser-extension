import { checkDomain } from '@/helpers/domain';
import { coversSubdomains } from '@/helpers/socksProxy/coversSubdomains';
import { ProxyDetails, ProxyDetailsMap } from '@/helpers/socksProxy/socksProxy.types';
import { parseStoredValue } from '@/helpers/storage';

export const reloadMatchingTabs = async (url: string) => {
  const urlPattern = `*://*.${url}/*`;

  const tabs = await browser.tabs.query({ url: urlPattern });
  tabs.forEach((tab) => {
    if (tab.id) {
      browser.tabs.reload(tab.id);
    }
  });
};

export const reloadGlobalProxiedTabs = async (excludedURLs: string[]) => {
  const tabs = await browser.tabs.query({ url: '*://*/*' });

  const tabsToReload = tabs.filter((tab) => {
    if (!tab.url) {
      return false;
    }
    return !isExcludedURL(tab.url, excludedURLs);
  });

  tabsToReload.forEach((tab) => {
    if (tab.id) {
      browser.tabs.reload(tab.id);
    }
  });
};

const isExcludedURL = (url: string, excludedURLs: string[]): boolean => {
  const { hostname } = new URL(url);
  return excludedURLs.some((excludedUrl) => hostname === excludedUrl);
};

export const getActiveTabDetails = async () => {
  const activeTab = await getActiveTab();

  // activeTab will be null if tabs permission has not been granted
  if (!activeTab?.url) {
    return { host: '', protocol: '', isAboutPage: false, isExtensionPage: false };
  }

  const activeTabURL = new URL(activeTab.url);

  return {
    host: activeTabURL.hostname,
    protocol: activeTabURL.protocol,
    isAboutPage: activeTabURL.protocol === 'about:',
    isExtensionPage: activeTabURL.protocol === 'moz-extension:',
  };
};

export const getActiveProxyDetails = async (tab?: browser.tabs.Tab): Promise<ProxyDetails> => {
  const stored = await browser.storage.local.get(['globalProxyDetails', 'hostProxiesDetails']);
  const globalProxyDetails = parseStoredValue<ProxyDetails>(stored.globalProxyDetails, {
    socksEnabled: false,
  });
  const hostProxiesDetails = parseStoredValue<ProxyDetailsMap>(stored.hostProxiesDetails, {});

  // The caller often knows the tab already, which saves a query
  const activeTab = tab ?? (await getActiveTab());
  const tabHost = activeTab?.url ? new URL(activeTab.url).hostname : '';
  const { domain } = checkDomain(tabHost);

  // Check subdomain proxy first
  if (hostProxiesDetails[tabHost]?.socksEnabled) {
    return hostProxiesDetails[tabHost];
  }

  // Then check domain proxy, when it reaches the subdomains
  if (hostProxiesDetails[domain]?.socksEnabled && coversSubdomains(hostProxiesDetails[domain])) {
    return hostProxiesDetails[domain];
  }

  return globalProxyDetails;
};

export const getActiveTab = async () => {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  return activeTab;
};

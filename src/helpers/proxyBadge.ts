import { checkDomain } from '@/helpers/domain';
import { coversSubdomains } from '@/helpers/socksProxy/coversSubdomains';
import { isLocalOrReservedIP } from '@/helpers/socksProxy/socksProxy';
import { ProxyDetails, RandomProxyScope } from '@/helpers/socksProxy/socksProxy.types';
import { parseStoredValue } from '@/helpers/storage';
import { getActiveProxyDetails, getActiveTab } from '@/helpers/tabs';

export const updateCurrentTabProxyBadge = async () => {
  const activeTab = await getActiveTab();

  if (activeTab) {
    await updateTabProxyBadge(activeTab, await getActiveProxyDetails(activeTab));
  }
};

export const updateTabProxyBadge = async (
  tab: browser.tabs.Tab,
  activeProxyDetails: ProxyDetails,
) => {
  const { id: tabId, url } = tab;
  // One read: each one is a round trip, and the badge is updated on every tab
  // update and every proxy change
  const {
    excludedHosts,
    globalProxyDetails,
    hostProxiesDetails,
    randomProxyMode,
    randomProxyScope,
  } = await browser.storage.local.get([
    'excludedHosts',
    'globalProxyDetails',
    'hostProxiesDetails',
    'randomProxyMode',
    'randomProxyScope',
  ]);

  const hostProxiesDetailsParsed = parseStoredValue<Record<string, ProxyDetails>>(
    hostProxiesDetails,
    {},
  );
  const excludedHostsParsed = parseStoredValue<string[]>(excludedHosts, []);
  const globalProxyDetailsParsed = parseStoredValue(globalProxyDetails, {} as ProxyDetails);
  const randomProxyModeParsed = parseStoredValue(randomProxyMode, false);
  const randomProxyScopeParsed = parseStoredValue(randomProxyScope, RandomProxyScope.override);
  const isRandomProxyOverriding =
    randomProxyModeParsed && randomProxyScopeParsed === RandomProxyScope.override;

  const tabHost = new URL(url!).hostname;
  const { domain, fullHost, hasSubdomain } = checkDomain(tabHost);

  // Block for local/reserved IPs
  if (isLocalOrReservedIP(tabHost)) {
    browser.browserAction.setTitle({ tabId, title: 'Local/Reserved IP - No proxy needed' });
    await setTabExtBadge(tab, false, false);
    return;
  }

  // 0. Check for random proxy mode, when set to override every selection
  if (isRandomProxyOverriding) {
    await setRandomProxyBadge(tab);
    return;
  }

  // 1. Check subdomain level
  if (hasSubdomain) {
    if (excludedHostsParsed.includes(fullHost)) {
      browser.browserAction.setTitle({ tabId, title: `${fullHost} is set to never be proxied` });
      await setTabExtBadge(tab, false, true);
      return;
    }

    if (hostProxiesDetailsParsed[fullHost]?.socksEnabled) {
      const proxyDNSMessage = activeProxyDetails.proxyDNS ? 'DNS proxied' : 'DNS not proxied';
      const title = `${activeProxyDetails.city}, ${activeProxyDetails.country}\nServer: ${activeProxyDetails.server}\n${proxyDNSMessage}`;
      browser.browserAction.setTitle({ tabId, title });
      await setTabExtBadge(tab, true, false, activeProxyDetails.countryCode);
      return;
    }
  }

  // 2. Check domain level
  if (excludedHostsParsed.includes(domain)) {
    browser.browserAction.setTitle({ tabId, title: `${domain} is set to never be proxied` });
    await setTabExtBadge(tab, false, true);
    return;
  }

  if (
    hostProxiesDetailsParsed[domain]?.socksEnabled &&
    (!hasSubdomain || coversSubdomains(hostProxiesDetailsParsed[domain]))
  ) {
    const proxyDNSMessage = activeProxyDetails.proxyDNS ? 'DNS proxied' : 'DNS not proxied';
    const title = `${activeProxyDetails.city}, ${activeProxyDetails.country}\nServer: ${activeProxyDetails.server}\n${proxyDNSMessage}`;
    browser.browserAction.setTitle({ tabId, title });
    await setTabExtBadge(tab, true, false, activeProxyDetails.countryCode);
    return;
  }

  // 2b. Random proxy mode takes the place of the global proxy for the domains
  // without a selection of their own
  if (randomProxyModeParsed) {
    await setRandomProxyBadge(tab);
    return;
  }

  // 3. Check global proxy
  if (globalProxyDetailsParsed.socksEnabled) {
    const proxyDNSMessage = activeProxyDetails.proxyDNS ? 'DNS proxied' : 'DNS not proxied';
    const title = `${activeProxyDetails.city}, ${activeProxyDetails.country}\nServer: ${activeProxyDetails.server}\n${proxyDNSMessage}`;
    browser.browserAction.setTitle({ tabId, title });
    await setTabExtBadge(tab, true, false, activeProxyDetails.countryCode);
    return;
  }

  // 4. Default: no proxy
  browser.browserAction.setTitle({ tabId, title: 'Proxy not in use' });
  await setTabExtBadge(tab, false, false);
};

const setRandomProxyBadge = async (tab: browser.tabs.Tab) => {
  // In random proxy mode, we show a shuffle icon on the badge
  browser.browserAction.setTitle({ tabId: tab.id, title: 'Random proxy' });
  await setTabExtBadge(tab, true, false, '🔀', true);
};

const setTabExtBadge = async (
  tab: browser.tabs.Tab,
  proxy = true,
  isExcluded = false,
  countryCode = 'P',
  randomProxyMode = false,
) => {
  const { id: tabId } = tab;

  if (isExcluded) {
    browser.browserAction.setBadgeText({ text: '🚫', tabId });
    browser.browserAction.setBadgeBackgroundColor({ color: '#ffd524', tabId });
    browser.browserAction.setBadgeTextColor({ color: 'black', tabId });
  } else if (proxy) {
    browser.browserAction.setBadgeText({ text: countryCode.toUpperCase(), tabId });
    browser.browserAction.setBadgeBackgroundColor({ color: '#ffd524', tabId });
    browser.browserAction.setBadgeTextColor({ color: 'black', tabId });
  } else if (randomProxyMode) {
    browser.browserAction.setBadgeText({ text: countryCode, tabId });
  } else {
    browser.browserAction.setBadgeText({ text: '', tabId });
  }
};

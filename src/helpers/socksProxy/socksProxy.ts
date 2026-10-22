import ipaddr from 'ipaddr.js';
import { parse } from 'tldts';

import {
  RequestDetails,
  ProxyDetails,
  ProxyInfoMap,
  ProxyInfo,
  RandomProxyScope,
} from '@/helpers/socksProxy/socksProxy.types';
import { ConnCheckConfig, DEFAULT_CONFIG } from '@/helpers/config';
import { checkDomain } from '@/helpers/domain';
import { coversSubdomains } from '@/helpers/socksProxy/coversSubdomains';
import { getRandomSessionProxy } from '@/helpers/socksProxy/getRandomSessionProxy';
import { parseStoredValue } from '@/helpers/storage';
import { getActiveTabDetails } from '@/helpers/tabs';

// TODO decide what how to handle fallback proxy (if proxy is invalid, it will fallback to Firefox proxy if configured)
// https://bugzilla.mozilla.org/show_bug.cgi?id=1750561

export const handleProxyRequest = async (details: browser.proxy._OnRequestDetails) => {
  try {
    const {
      connCheckConfig,
      excludedHosts,
      globalProxy,
      globalProxyDetails,
      hostProxies,
      hostProxiesDetails,
      randomProxyDNS,
      randomProxyMode,
      randomProxyScope,
    } = await getLocalStorageItems();

    const currentHost = new URL(details.url).hostname;
    const { hasSubdomain, domain, fullHost } = checkDomain(currentHost);
    const currentDomain = hasSubdomain ? fullHost : domain;

    const isDomainExcluded =
      excludedHosts.includes(currentDomain) || (hasSubdomain && excludedHosts.includes(domain));
    const isDomainProxied = Object.hasOwn(hostProxies, currentDomain);
    const isDomainProxydEnabled = Boolean(hostProxiesDetails[currentDomain]?.socksEnabled);
    const isParentDomainProxied = hasSubdomain && Object.hasOwn(hostProxies, domain);
    const isParentProxyEnabled =
      hasSubdomain &&
      Boolean(hostProxiesDetails[domain]?.socksEnabled) &&
      coversSubdomains(hostProxiesDetails[domain]);
    const isGlobalProxyEnabled = globalProxyDetails.socksEnabled;
    const isRandomProxyOverriding =
      randomProxyMode && randomProxyScope === RandomProxyScope.override;

    // 1. Block speculative requests, since we can't identify their origins
    if (details.type === 'speculative') {
      return { cancel: true };
    }

    // 2. Skip proxy for local/reserved IPs
    if (isLocalOrReservedIP(currentHost)) {
      return { type: 'direct' };
    }

    // 3. When the request if a conncheck/DNS check originating from the extension,
    // we want to use the same proxy as the active tab, to get a consistent conncheck result
    if (isExtConnCheck(details, connCheckConfig)) {
      return getProxyForExtensionConnectionCheck(
        isGlobalProxyEnabled,
        globalProxy,
        randomProxyMode,
        randomProxyScope,
        randomProxyDNS,
        excludedHosts,
        hostProxies,
        hostProxiesDetails,
      );
    }

    // 4. Check for random proxy mode, when set to override every selection
    if (isRandomProxyOverriding) {
      return getRandomSessionProxy(domain, randomProxyDNS);
    }

    // 5. Check domain/subdomain level
    if (isDomainExcluded) {
      return { type: 'direct' };
    }

    if (isDomainProxied && isDomainProxydEnabled) {
      return hostProxies[currentDomain];
    }

    // 5b. Fallback to parent domain for subdomains (e.g., www.reddit.com -> reddit.com)
    if (isParentDomainProxied && isParentProxyEnabled) {
      return hostProxies[domain];
    }

    // 5c. Random proxy mode takes the place of the global proxy for the domains
    // without a selection of their own
    if (randomProxyMode) {
      return getRandomSessionProxy(domain, randomProxyDNS);
    }

    // 6. Check global proxy
    if (isGlobalProxyEnabled) {
      return globalProxy;
    }

    // 7. Default: no proxy
    return { type: 'direct' };
  } catch (error) {
    console.log(error);
  }
};

async function getLocalStorageItems(): Promise<{
  connCheckConfig: ConnCheckConfig;
  excludedHosts: string[];
  globalProxy: ProxyInfo;
  globalProxyDetails: ProxyDetails;
  hostProxies: ProxyInfoMap;
  hostProxiesDetails: Record<string, ProxyDetails>;
  randomProxyDNS: boolean;
  randomProxyMode: boolean;
  randomProxyScope: RandomProxyScope;
}> {
  const data = await browser.storage.local.get([
    'connCheckConfig',
    'excludedHosts',
    'globalProxy',
    'globalProxyDetails',
    'hostProxies',
    'hostProxiesDetails',
    'randomProxyDNS',
    'randomProxyMode',
    'randomProxyScope',
  ]);

  return {
    connCheckConfig: parseStoredValue(data.connCheckConfig, DEFAULT_CONFIG),
    excludedHosts: parseStoredValue<string[]>(data.excludedHosts, []),
    globalProxy: parseStoredValue(data.globalProxy, {} as ProxyInfo),
    globalProxyDetails: parseStoredValue(data.globalProxyDetails, {} as ProxyDetails),
    hostProxies: parseStoredValue<ProxyInfoMap>(data.hostProxies, {}),
    hostProxiesDetails: parseStoredValue<Record<string, ProxyDetails>>(data.hostProxiesDetails, {}),
    randomProxyDNS: parseStoredValue(data.randomProxyDNS, true),
    randomProxyMode: parseStoredValue(data.randomProxyMode, false),
    randomProxyScope: parseStoredValue(data.randomProxyScope, RandomProxyScope.override),
  };
}

export const isExtConnCheck = (
  details: RequestDetails,
  config: ConnCheckConfig = DEFAULT_CONFIG,
): boolean => {
  const isExtensionRequest = Boolean(details.documentUrl?.startsWith('moz-extension://'));
  const isConnCheck =
    details.url === `${config.ipv4_url}/json` || details.url === `${config.ipv6_url}/json`;
  const isDNSCheck =
    checkDomain(details.url).domain === 'mullvad.net' &&
    details.url.endsWith(`${config.dns_leak_domain}/`);

  return isExtensionRequest && (isConnCheck || isDNSCheck);
};

export const isLocalOrReservedIP = (hostname: string) => {
  //Parse with `tldts` to normalize the host (it strips the brackets for IPv6 and lowercases),
  // and to match "localhost" via the special-use flag.
  const parsed = parse(hostname, { detectSpecialUse: true });
  const normalizedHost = parsed.hostname;
  if (!normalizedHost) return false;
  if (parsed.isSpecialUse && normalizedHost === 'localhost') return true;
  if (!ipaddr.isValid(normalizedHost)) return false;

  try {
    const addr = ipaddr.parse(normalizedHost);
    const range = addr.range();

    return (
      range === 'private' ||
      range === 'multicast' ||
      range === 'linkLocal' ||
      range === 'loopback' ||
      range === 'uniqueLocal'
    );
  } catch (e: unknown) {
    console.error('Invalid IP address:', e);
    return false;
  }
};

const getProxyForExtensionConnectionCheck = async (
  isGlobalProxyEnabled: boolean,
  globalProxy: ProxyInfo,
  randomProxyMode: boolean,
  randomProxyScope: RandomProxyScope,
  randomProxyDNS: boolean,
  excludedHosts: string[],
  hostProxies: ProxyInfoMap,
  hostProxiesDetails: Record<string, ProxyDetails>,
) => {
  const { isAboutPage, host } = await getActiveTabDetails();
  const { domain, hasSubdomain, fullHost } = checkDomain(host);
  const tabDomain = hasSubdomain ? fullHost : domain;

  const isTabDomainExcluded =
    excludedHosts.includes(tabDomain) || (hasSubdomain && excludedHosts.includes(domain));
  const isTabDomainProxied = Object.hasOwn(hostProxies, tabDomain);
  const isTabProxyEnabled = !!hostProxiesDetails[tabDomain]?.socksEnabled;
  const isParentDomainProxied = hasSubdomain && Object.hasOwn(hostProxies, domain);
  const isParentProxyEnabled =
    hasSubdomain &&
    !!hostProxiesDetails[domain]?.socksEnabled &&
    coversSubdomains(hostProxiesDetails[domain]);

  // a) If the current tab is an about page, we only need to check for a global proxy
  if (isAboutPage) {
    return isGlobalProxyEnabled ? globalProxy : { type: 'direct' };
  }

  // b) If random proxy mode overrides every selection, we need to check for the
  // current tab's random proxy
  if (randomProxyMode && randomProxyScope === RandomProxyScope.override) {
    return getRandomSessionProxy(tabDomain, randomProxyDNS);
  }

  // c) If current tab domain is excluded, connection is direct
  if (isTabDomainExcluded) {
    return { type: 'direct' };
  }

  // d) If current tab is proxied, we need to check for the current tab's proxy
  if (isTabDomainProxied && isTabProxyEnabled) {
    return hostProxies[tabDomain];
  }

  // d-b) Fallback to parent domain for subdomains (e.g., www.reddit.com -> reddit.com)
  if (isParentDomainProxied && isParentProxyEnabled) {
    return hostProxies[domain];
  }

  // d-c) Random proxy mode, for a tab domain without a selection of its own
  if (randomProxyMode) {
    return getRandomSessionProxy(tabDomain, randomProxyDNS);
  }

  // e) If global proxy is enabled
  if (isGlobalProxyEnabled) {
    return globalProxy;
  }

  return { type: 'direct' };
};

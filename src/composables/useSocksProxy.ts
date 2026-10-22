import { computed, ref, watch } from 'vue';

import {
  ProxyDetails,
  ProxyInfo,
  ProxyInfoType,
  ProxyOperationArgs,
  ProxyScope,
} from '@/helpers/socksProxy/socksProxy.types';
import { reloadOptions } from '@/helpers/browserExtension';
import { updateCurrentTabProxyBadge } from '@/helpers/proxyBadge';

import { reloadGlobalProxiedTabs, reloadMatchingTabs } from '@/helpers/tabs';
import { checkDomain } from '@/helpers/domain';
import { coversSubdomains } from '@/helpers/socksProxy/coversSubdomains';
import { getTargetHost } from '@/helpers/socksProxy/getTargetHost';
import { baseConfig, socksIp } from '@/helpers/socksProxy/constants';

import useActiveTab from '@/composables/useActiveTab';
import useConnectionStatus from '@/composables/useConnection/useConnectionStatus';
import useStore from '@/composables/useStore';

const { checkStatus } = useConnectionStatus();

const { activeTabHost } = useActiveTab();

const {
  excludedHosts,
  globalProxy,
  globalProxyDetails,
  hostProxies,
  hostProxiesDetails,
  proxyAutoReload,
  proxyScopePreference,
} = useStore();

const activeTabDomainInfo = computed(() => checkDomain(activeTabHost.value));

// A DNS choice made before a proxy exists has nowhere to be stored yet, so it
// is held until a location is picked for that same host. It deliberately does
// not outlive the view: a choice made for one host is not a default for others.
const pendingHostProxyDNS = ref<Record<string, boolean>>({});
const pendingGlobalProxyDNS = ref<boolean | null>(null);
const defaultProxyDNS = baseConfig.proxyDNS ?? true;

const isHostConfigured = (host: string) =>
  Boolean(hostProxiesDetails.value[host]) || excludedHosts.value.includes(host);

// The connection check is a handful of network requests, so it is only worth
// running when the change can alter how the active tab is routed.
const affectsActiveTab = (host: string) =>
  host === activeTabHost.value || host === activeTabDomainInfo.value.domain;

// Scope explicitly picked for the host currently shown, which takes precedence
// over the stored preference until another host is displayed.
const pickedProxyScope = ref<ProxyScope | null>(null);
watch(activeTabHost, () => {
  pickedProxyScope.value = null;
});

const currentProxyScope = computed<ProxyScope>(() => {
  const { hasSubdomain, domain, fullHost } = activeTabDomainInfo.value;

  if (pickedProxyScope.value) {
    return pickedProxyScope.value;
  }
  // Reflect the configuration already in place, before falling back to the
  // scope the user picked last. A proxy on the exact hostname is for it alone,
  // while one on the registrable domain carries the reach of its subdomains.
  if (hasSubdomain && isHostConfigured(fullHost)) {
    return ProxyScope.host;
  }
  if (hostProxiesDetails.value[domain]) {
    return coversSubdomains(hostProxiesDetails.value[domain]) ? ProxyScope.domain : ProxyScope.host;
  }
  // An exclusion is a flat entry, it always covers the subdomains
  if (excludedHosts.value.includes(domain)) {
    return ProxyScope.domain;
  }
  return proxyScopePreference.value;
});

const currentScopeHost = computed(() => {
  const { domain, fullHost } = activeTabDomainInfo.value;
  return currentProxyScope.value === ProxyScope.domain ? domain : fullHost;
});

const currentScopeProxyDetails = computed(
  () => hostProxiesDetails.value[currentScopeHost.value] ?? null,
);

const currentScopeExcluded = computed(() => excludedHosts.value.includes(currentScopeHost.value));

// The choice is only offered where it can change something: an exclusion on a
// host without a subdomain has nowhere to move to and carries no reach.
const canChooseProxyScope = computed(
  () => activeTabDomainInfo.value.hasSubdomain || !currentScopeExcluded.value,
);

const currentScopeProxyEnabled = computed(
  () => !currentScopeExcluded.value && (currentScopeProxyDetails.value?.socksEnabled ?? false),
);

const currentScopeProxyDNS = computed(
  () =>
    currentScopeProxyDetails.value?.proxyDNS ??
    pendingHostProxyDNS.value[currentScopeHost.value] ??
    defaultProxyDNS,
);

// A configuration on the exact hostname always wins over the one inherited from
// the registrable domain, so a domain wide scope can be shadowed by it.
const shadowingProxyHost = computed(() => {
  const { hasSubdomain, fullHost } = activeTabDomainInfo.value;

  if (!hasSubdomain || currentProxyScope.value !== ProxyScope.domain) {
    return '';
  }
  return isHostConfigured(fullHost) ? fullHost : '';
});

const currentHostProxyDetails = computed(() => {
  const { hasSubdomain, domain } = activeTabDomainInfo.value;

  // First check for exact matches that are enabled
  if (hostProxiesDetails.value[activeTabHost.value]?.socksEnabled) {
    return hostProxiesDetails.value[activeTabHost.value];
  }

  // Then check parent domain if this is a subdomain, when it reaches them
  if (
    hasSubdomain &&
    hostProxiesDetails.value[domain]?.socksEnabled &&
    coversSubdomains(hostProxiesDetails.value[domain])
  ) {
    return hostProxiesDetails.value[domain];
  }

  // If no enabled proxies found, return any existing proxy config
  if (hostProxiesDetails.value[activeTabHost.value]) {
    return hostProxiesDetails.value[activeTabHost.value];
  }

  // Also check parent domain for disabled configs (subdomain fallback), when
  // it reaches them
  if (
    hasSubdomain &&
    hostProxiesDetails.value[domain] &&
    coversSubdomains(hostProxiesDetails.value[domain])
  ) {
    return hostProxiesDetails.value[domain];
  }

  return null;
});

const globalProxyEnabled = computed(() => globalProxyDetails.value.socksEnabled);

const globalProxyDNS = computed(
  () => globalProxyDetails.value.proxyDNS ?? pendingGlobalProxyDNS.value ?? defaultProxyDNS,
);

const currentHostExcluded = computed(() => {
  const { domain, hasSubdomain } = activeTabDomainInfo.value;
  return (
    excludedHosts.value.includes(activeTabHost.value) ||
    (hasSubdomain && excludedHosts.value.includes(domain))
  );
});

const currentHostProxyEnabled = computed(
  () => !currentHostExcluded.value && (currentHostProxyDetails.value?.socksEnabled ?? false),
);

const currentEffectiveProxyHost = computed(() => {
  const { hasSubdomain, domain } = activeTabDomainInfo.value;

  // If the host or its parent domain is excluded, return the excluded domain
  if (excludedHosts.value.includes(activeTabHost.value)) {
    return activeTabHost.value;
  }
  if (hasSubdomain && excludedHosts.value.includes(domain)) {
    return domain;
  }

  // Then check for exact matches that are enabled
  if (hostProxiesDetails.value[activeTabHost.value]?.socksEnabled) {
    return activeTabHost.value;
  }

  // Then check parent domain if this is a subdomain (fallback), when it reaches them
  if (
    hasSubdomain &&
    hostProxiesDetails.value[domain]?.socksEnabled &&
    coversSubdomains(hostProxiesDetails.value[domain])
  ) {
    return domain;
  }

  // Any existing proxy config for the exact host
  if (hostProxiesDetails.value[activeTabHost.value]) {
    return activeTabHost.value;
  }

  // Parent domain fallback for disabled configs, when it reaches them
  if (
    hasSubdomain &&
    hostProxiesDetails.value[domain] &&
    coversSubdomains(hostProxiesDetails.value[domain])
  ) {
    return domain;
  }

  return activeTabHost.value;
});

const combinedHosts = computed(() => {
  // hosts that are excluded from proxying + hosts that enabled for proxying
  const enabledProxyHosts = Object.entries(hostProxiesDetails.value)
    .filter(([, details]) => details.socksEnabled)
    .map(([host]) => host);
  const allHosts = [...enabledProxyHosts, ...excludedHosts.value];
  return [...new Set(allHosts)].sort((a, b) => a.localeCompare(b));
});

const toggleGlobalProxy = () => {
  globalProxyDetails.value.socksEnabled = !globalProxyDetails.value.socksEnabled;
  reloadOptions();
  if (proxyAutoReload.value) {
    reloadGlobalProxiedTabs(combinedHosts.value);
  }
  updateCurrentTabProxyBadge();
  checkStatus();
};

const toggleHostProxy = (host: string) => {
  hostProxiesDetails.value[host].socksEnabled = !hostProxiesDetails.value[host].socksEnabled;
  reloadOptions();
  if (proxyAutoReload.value) {
    reloadMatchingTabs(host);
  }
  updateCurrentTabProxyBadge();
  checkStatus();
};

const toggleCustomProxy = (host: string) => {
  const targetHost = getTargetHost(host, hostProxiesDetails.value);
  hostProxiesDetails.value[targetHost].socksEnabled =
    !hostProxiesDetails.value[targetHost].socksEnabled;
  reloadOptions();
  if (proxyAutoReload.value) {
    reloadMatchingTabs(targetHost);
  }
  updateCurrentTabProxyBadge();
  checkStatus();
};

const moveHostProxy = (from: string, to: string) => {
  if (from === to) {
    return;
  }

  if (hostProxies.value[from]) {
    const { [from]: proxy, ...otherProxies } = hostProxies.value;
    hostProxies.value = { ...otherProxies, [to]: proxy };
  }

  if (hostProxiesDetails.value[from]) {
    const { [from]: details, ...otherDetails } = hostProxiesDetails.value;
    hostProxiesDetails.value = { ...otherDetails, [to]: details };
  }

  if (excludedHosts.value.includes(from)) {
    excludedHosts.value = [...excludedHosts.value.filter((host) => host !== from), to];
  }

  updateCurrentTabProxyBadge();
  reloadOptions();
  if (proxyAutoReload.value) {
    // Both hosts share the same registrable domain, so one query covers them.
    reloadMatchingTabs(checkDomain(to).domain);
  }
  checkStatus();
};

const setCurrentProxyScope = (scope: ProxyScope) => {
  const { domain, fullHost } = activeTabDomainInfo.value;
  const previousHost = currentScopeHost.value;
  const nextHost = scope === ProxyScope.domain ? domain : fullHost;
  const includeSubdomains = scope === ProxyScope.domain;

  proxyScopePreference.value = scope;
  pickedProxyScope.value = scope;

  // Carry an existing configuration over to the new scope, unless the host it
  // would move to is already configured on its own.
  if (!isHostConfigured(nextHost)) {
    moveHostProxy(previousHost, nextHost);
  }

  // On a host without a subdomain both scopes are the same host, so the reach
  // is recorded on the proxy itself.
  setHostIncludeSubdomains(nextHost, includeSubdomains);
};

const includesSubdomains = computed(() => currentProxyScope.value === ProxyScope.domain);

const setHostIncludeSubdomains = (host: string, includeSubdomains: boolean) => {
  if (!hostProxiesDetails.value[host]) {
    return;
  }

  hostProxiesDetails.value[host].includeSubdomains = includeSubdomains;

  updateCurrentTabProxyBadge();
  // Other extension views hold their own copy of the storage, so they need to
  // be refreshed to show the change
  reloadOptions();
  if (proxyAutoReload.value) {
    reloadMatchingTabs(checkDomain(host).domain);
  }
  if (affectsActiveTab(host) || affectsActiveTab(checkDomain(host).domain)) {
    checkStatus();
  }
};

const setIncludeSubdomains = (include: boolean) => {
  setCurrentProxyScope(include ? ProxyScope.domain : ProxyScope.host);
};

const setHostProxyDNS = (host: string, proxyDNS: boolean) => {
  if (!hostProxiesDetails.value[host] || !hostProxies.value[host]) {
    // No proxy for this host yet, so hold the choice for it alone
    pendingHostProxyDNS.value = { ...pendingHostProxyDNS.value, [host]: proxyDNS };
    return;
  }

  hostProxiesDetails.value[host].proxyDNS = proxyDNS;
  hostProxies.value[host].proxyDNS = proxyDNS;

  updateCurrentTabProxyBadge();
  // Other extension views hold their own copy of the storage, so they need to
  // be refreshed to show the change
  reloadOptions();
  if (proxyAutoReload.value) {
    reloadMatchingTabs(host);
  }
  if (affectsActiveTab(host)) {
    checkStatus();
  }
};

const setGlobalProxyDNS = (proxyDNS: boolean) => {
  if (!globalProxyDetails.value.server) {
    // No proxy for all websites yet, so hold the choice until one is picked
    pendingGlobalProxyDNS.value = proxyDNS;
    return;
  }

  globalProxyDetails.value.proxyDNS = proxyDNS;
  globalProxy.value.proxyDNS = proxyDNS;

  updateCurrentTabProxyBadge();
  // Other extension views hold their own copy of the storage, so they need to
  // be refreshed to show the change
  reloadOptions();
  if (proxyAutoReload.value) {
    reloadGlobalProxiedTabs(combinedHosts.value);
  }
  checkStatus();
};

const setGlobalProxy = ({
  country,
  countryCode,
  city,
  hostname,
  ipv4_address,
  port = baseConfig.port,
}: ProxyOperationArgs) => {
  // Keep the DNS choice already made for this proxy, or the one just picked
  const proxyDNS =
    globalProxyDetails.value.proxyDNS ?? pendingGlobalProxyDNS.value ?? defaultProxyDNS;
  pendingGlobalProxyDNS.value = null;

  const newGlobalProxy: ProxyInfo = {
    host: ipv4_address,
    port: port || 1080,
    proxyDNS,
    type: ProxyInfoType.socks,
  };

  const newGlobalProxyDetails: ProxyDetails = {
    socksEnabled: true,
    server: hostname,
    country: country,
    countryCode: countryCode,
    city: city,
    proxyDNS,
  };

  globalProxy.value = newGlobalProxy;
  globalProxyDetails.value = newGlobalProxyDetails;

  reloadOptions();
  if (proxyAutoReload.value) {
    reloadGlobalProxiedTabs(combinedHosts.value);
  }
  checkStatus();
};

const setCustomProxy = (
  {
    country,
    countryCode,
    city,
    hostname,
    ipv4_address,
    port = baseConfig.port,
    includeSubdomains,
  }: Partial<ProxyOperationArgs>,
  host: string,
) => {
  // Keep the DNS choice and the subdomains reach already set for this host
  const proxyDNS =
    hostProxiesDetails.value[host]?.proxyDNS ?? pendingHostProxyDNS.value[host] ?? defaultProxyDNS;
  const reachesSubdomains =
    includeSubdomains ?? hostProxiesDetails.value[host]?.includeSubdomains ?? true;

  const newHostProxy: ProxyInfo = {
    host: ipv4_address || socksIp,
    port: port!,
    proxyDNS,
    type: ProxyInfoType.socks,
  };

  const newHostProxyDetails: ProxyDetails = {
    socksEnabled: true,
    server: hostname,
    country: country,
    countryCode: countryCode,
    city: city,
    proxyDNS,
    includeSubdomains: reachesSubdomains,
  };

  hostProxies.value = { ...hostProxies.value, [host]: newHostProxy };
  hostProxiesDetails.value = { ...hostProxiesDetails.value, [host]: newHostProxyDetails };

  const { [host]: _applied, ...stillPending } = pendingHostProxyDNS.value;
  pendingHostProxyDNS.value = stillPending;

  reloadOptions();
  if (proxyAutoReload.value) {
    reloadMatchingTabs(host);
  }
  checkStatus();
};

const removeCustomProxy = (host: string) => {
  delete hostProxies.value[host];
  delete hostProxiesDetails.value[host];
  updateCurrentTabProxyBadge();
  reloadOptions();
  if (proxyAutoReload.value) {
    reloadMatchingTabs(host);
  }
  checkStatus();
};

const removeGlobalProxy = () => {
  globalProxy.value = {} as ProxyInfo;
  globalProxyDetails.value = {} as ProxyDetails;
  updateCurrentTabProxyBadge();
  reloadOptions();
  if (proxyAutoReload.value) {
    reloadGlobalProxiedTabs(combinedHosts.value);
  }
  checkStatus();
};

const allowProxy = (host: string) => {
  excludedHosts.value = excludedHosts.value.filter((excluded) => excluded !== host);
  updateCurrentTabProxyBadge();
  reloadOptions();
  if (proxyAutoReload.value) {
    reloadMatchingTabs(host);
  }
  checkStatus();
};

const neverProxyHost = (host: string) => {
  excludedHosts.value = [...excludedHosts.value, host];
  updateCurrentTabProxyBadge();
  reloadOptions();
  if (proxyAutoReload.value) {
    reloadMatchingTabs(host);
  }
  checkStatus();
};

const useSocksProxy = () => {
  return {
    allowProxy,
    canChooseProxyScope,
    currentHostProxyDetails,
    currentHostProxyEnabled,
    currentHostExcluded,
    currentEffectiveProxyHost,
    currentProxyScope,
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
    setCurrentProxyScope,
    setCustomProxy,
    setGlobalProxy,
    setGlobalProxyDNS,
    setHostIncludeSubdomains,
    setHostProxyDNS,
    setIncludeSubdomains,
    shadowingProxyHost,
    toggleHostProxy,
    toggleCustomProxy,
    toggleGlobalProxy,
  };
};

export default useSocksProxy;

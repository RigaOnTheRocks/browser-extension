import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import { ProxyInfoType, ProxyScope } from '@/helpers/socksProxy/socksProxy.types';
import { reloadOptions } from '@/helpers/browserExtension';

import useActiveTab from '@/composables/useActiveTab';
import useSocksProxy from '@/composables/useSocksProxy';
import useStore from '@/composables/useStore';

vi.mock('@/composables/useBrowserStorageLocal', async () => {
  const { ref } = await import('vue');
  return { default: <T>(_key: string, initialValue: T) => ref(initialValue) };
});

vi.mock('@/composables/useActiveTab', async () => {
  const { ref } = await import('vue');
  const activeTabHost = ref('');
  return {
    default: () => ({
      activeTabHost,
      isAboutPage: ref(false),
      isExtensionPage: ref(false),
    }),
  };
});

const { checkStatus } = vi.hoisted(() => ({ checkStatus: vi.fn() }));
vi.mock('@/composables/useConnection/useConnectionStatus', () => ({
  default: () => ({ checkStatus }),
}));

vi.mock('@/helpers/browserExtension', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/helpers/browserExtension')>()),
  reloadOptions: vi.fn(),
}));
vi.mock('@/helpers/proxyBadge', () => ({ updateCurrentTabProxyBadge: vi.fn() }));
vi.mock('@/helpers/tabs', () => ({
  reloadGlobalProxiedTabs: vi.fn(),
  reloadMatchingTabs: vi.fn(),
}));

const { activeTabHost } = useActiveTab();
const { excludedHosts, hostProxies, hostProxiesDetails, proxyScopePreference } = useStore();
const { globalProxyDetails } = useStore();

const {
  canChooseProxyScope,
  setHostIncludeSubdomains,
  currentHostProxyEnabled,
  currentEffectiveProxyHost,
  includesSubdomains,
  setIncludeSubdomains,
  currentProxyScope,
  currentScopeHost,
  currentScopeProxyDetails,
  currentScopeProxyDNS,
  setCurrentProxyScope,
  setCustomProxy,
  setGlobalProxy,
  setHostProxyDNS,
  shadowingProxyHost,
} = useSocksProxy();

const gothenburg = {
  country: 'Sweden',
  countryCode: 'se',
  city: 'Gothenburg',
  hostname: 'se-got-wg-001',
  ipv4_address: '10.124.0.1',
  port: 1080,
};

const proxyFor = (host: string) => ({
  type: ProxyInfoType.socks,
  host,
  port: 1080,
  proxyDNS: true,
});

const detailsFor = (server: string, proxyDNS = true, includeSubdomains?: boolean) => ({
  socksEnabled: true,
  server,
  country: 'Sweden',
  countryCode: 'se',
  city: 'Gothenburg',
  proxyDNS,
  ...(includeSubdomains === undefined ? {} : { includeSubdomains }),
});

const setActiveTabHost = async (host: string) => {
  activeTabHost.value = host;
  // Lets the watcher clearing the picked scope run
  await nextTick();
};

describe('useSocksProxy proxy scope', () => {
  beforeEach(async () => {
    excludedHosts.value = [];
    hostProxies.value = {};
    hostProxiesDetails.value = {};
    proxyScopePreference.value = ProxyScope.domain;
    await setActiveTabHost('');
  });

  it('covers all subdomains by default', async () => {
    await setActiveTabHost('www.example.com');

    expect(canChooseProxyScope.value).toBe(true);
    expect(currentProxyScope.value).toBe(ProxyScope.domain);
    expect(currentScopeHost.value).toBe('example.com');
  });

  it('narrows a proxy on a host without a subdomain down to that host', async () => {
    hostProxies.value = { 'example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'example.com': detailsFor('se-got-wg-001') };
    await setActiveTabHost('example.com');

    expect(canChooseProxyScope.value).toBe(true);
    expect(includesSubdomains.value).toBe(true);

    setIncludeSubdomains(false);

    // Same host either way, so the reach is recorded on the proxy itself
    expect(currentScopeHost.value).toBe('example.com');
    expect(includesSubdomains.value).toBe(false);
    expect(hostProxiesDetails.value['example.com'].includeSubdomains).toBe(false);
  });

  it('reads the reach of a proxy back from the stored flag', async () => {
    hostProxies.value = { 'example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'example.com': detailsFor('se-got-wg-001', true, false) };
    await setActiveTabHost('example.com');

    expect(includesSubdomains.value).toBe(false);
  });

  it('treats a proxy configured before the flag existed as covering subdomains', async () => {
    hostProxies.value = { 'example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'example.com': detailsFor('se-got-wg-001') };
    await setActiveTabHost('sub.example.com');

    expect(includesSubdomains.value).toBe(true);
    expect(currentScopeHost.value).toBe('example.com');
  });

  it('does not report a domain proxy as in use on a subdomain it leaves out', async () => {
    hostProxies.value = { 'example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'example.com': detailsFor('se-got-wg-001', true, false) };
    await setActiveTabHost('www.example.com');

    // What the popup reports has to match what the requests actually do
    expect(currentHostProxyEnabled.value).toBe(false);
    expect(currentEffectiveProxyHost.value).toBe('www.example.com');
    expect(currentScopeProxyDetails.value).toBe(null);
  });

  it('reports a domain proxy as in use on a subdomain it covers', async () => {
    hostProxies.value = { 'example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'example.com': detailsFor('se-got-wg-001', true, true) };
    await setActiveTabHost('www.example.com');

    expect(currentHostProxyEnabled.value).toBe(true);
    expect(currentEffectiveProxyHost.value).toBe('example.com');
  });

  it('sets the reach of any host, for the options page listing', async () => {
    hostProxies.value = { 'shop.example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'shop.example.com': detailsFor('se-got-wg-001') };

    setHostIncludeSubdomains('shop.example.com', false);

    expect(hostProxiesDetails.value['shop.example.com'].includeSubdomains).toBe(false);

    setHostIncludeSubdomains('shop.example.com', true);

    expect(hostProxiesDetails.value['shop.example.com'].includeSubdomains).toBe(true);
  });

  it('leaves a host without a proxy alone', async () => {
    setHostIncludeSubdomains('nothing.example.com', false);

    expect(hostProxiesDetails.value['nothing.example.com']).toBeUndefined();
  });

  it('offers no choice for an exclusion that has nowhere to move to', async () => {
    excludedHosts.value = ['example.com'];
    await setActiveTabHost('example.com');

    expect(canChooseProxyScope.value).toBe(false);
  });

  it('reflects a proxy already configured for the hostname only', async () => {
    hostProxiesDetails.value = { 'www.example.com': detailsFor('se-got-wg-001') };
    await setActiveTabHost('www.example.com');

    expect(currentProxyScope.value).toBe(ProxyScope.host);
    expect(currentScopeHost.value).toBe('www.example.com');
  });

  it('reflects a proxy already configured for the whole domain', async () => {
    hostProxiesDetails.value = { 'example.com': detailsFor('se-got-wg-001') };
    await setActiveTabHost('www.example.com');

    expect(currentProxyScope.value).toBe(ProxyScope.domain);
    expect(currentScopeHost.value).toBe('example.com');
  });

  it('widens a hostname proxy to the whole domain', async () => {
    hostProxies.value = { 'www.example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'www.example.com': detailsFor('se-got-wg-001') };
    await setActiveTabHost('www.example.com');

    setCurrentProxyScope(ProxyScope.domain);

    expect(currentScopeHost.value).toBe('example.com');
    expect(hostProxies.value).toEqual({ 'example.com': proxyFor('10.124.0.1') });
    expect(hostProxiesDetails.value).toEqual({
      'example.com': detailsFor('se-got-wg-001', true, true),
    });
  });

  it('narrows a domain proxy down to the current hostname', async () => {
    hostProxies.value = { 'example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'example.com': detailsFor('se-got-wg-001') };
    await setActiveTabHost('www.example.com');

    setCurrentProxyScope(ProxyScope.host);

    expect(currentScopeHost.value).toBe('www.example.com');
    expect(hostProxies.value).toEqual({ 'www.example.com': proxyFor('10.124.0.1') });
    expect(hostProxiesDetails.value).toEqual({
      'www.example.com': detailsFor('se-got-wg-001', true, false),
    });
  });

  it('widens an exclusion to the whole domain', async () => {
    excludedHosts.value = ['www.example.com'];
    await setActiveTabHost('www.example.com');

    setCurrentProxyScope(ProxyScope.domain);

    expect(excludedHosts.value).toEqual(['example.com']);
  });

  it('keeps the configuration already in place at the scope it switches to', async () => {
    hostProxies.value = {
      'example.com': proxyFor('10.124.0.1'),
      'www.example.com': proxyFor('10.124.0.2'),
    };
    hostProxiesDetails.value = {
      'example.com': detailsFor('se-got-wg-001'),
      'www.example.com': detailsFor('se-got-wg-002'),
    };
    await setActiveTabHost('www.example.com');

    setCurrentProxyScope(ProxyScope.domain);

    expect(currentScopeHost.value).toBe('example.com');
    expect(currentScopeProxyDetails.value?.server).toBe('se-got-wg-001');
    expect(hostProxies.value['www.example.com']).toEqual(proxyFor('10.124.0.2'));
  });

  it('reports the hostname proxy shadowing the domain one', async () => {
    hostProxiesDetails.value = {
      'example.com': detailsFor('se-got-wg-001'),
      'www.example.com': detailsFor('se-got-wg-002'),
    };
    await setActiveTabHost('www.example.com');
    setCurrentProxyScope(ProxyScope.domain);

    expect(shadowingProxyHost.value).toBe('www.example.com');
  });

  it('exposes the scope as a single subdomains choice', async () => {
    hostProxies.value = { 'www.example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'www.example.com': detailsFor('se-got-wg-001') };
    await setActiveTabHost('www.example.com');

    expect(includesSubdomains.value).toBe(false);

    setIncludeSubdomains(true);

    expect(includesSubdomains.value).toBe(true);
    expect(currentScopeHost.value).toBe('example.com');
    expect(hostProxiesDetails.value).toEqual({
      'example.com': detailsFor('se-got-wg-001', true, true),
    });

    setIncludeSubdomains(false);

    expect(includesSubdomains.value).toBe(false);
    expect(currentScopeHost.value).toBe('www.example.com');
    expect(hostProxiesDetails.value).toEqual({
      'www.example.com': detailsFor('se-got-wg-001', true, false),
    });
  });

  it('remembers the scope picked last for the next domain', async () => {
    await setActiveTabHost('www.example.com');
    setCurrentProxyScope(ProxyScope.host);

    await setActiveTabHost('login.other.com');

    expect(proxyScopePreference.value).toBe(ProxyScope.host);
    expect(currentScopeHost.value).toBe('login.other.com');
  });
});

describe('useSocksProxy DNS choice', () => {
  beforeEach(async () => {
    excludedHosts.value = [];
    hostProxies.value = {};
    hostProxiesDetails.value = {};
    proxyScopePreference.value = ProxyScope.domain;
    await setActiveTabHost('');
  });

  it('updates both the proxy and its details for a configured host', async () => {
    hostProxies.value = { 'example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'example.com': detailsFor('se-got-wg-001') };
    await setActiveTabHost('example.com');

    setHostProxyDNS('example.com', false);

    expect(hostProxies.value['example.com'].proxyDNS).toBe(false);
    expect(hostProxiesDetails.value['example.com'].proxyDNS).toBe(false);
    expect(currentScopeProxyDNS.value).toBe(false);
  });

  it('holds the choice made for a host without a proxy yet', async () => {
    await setActiveTabHost('example.com');

    setHostProxyDNS('example.com', false);

    expect(currentScopeProxyDNS.value).toBe(false);
  });

  it('keeps that choice to the host it was made for', async () => {
    await setActiveTabHost('example.com');
    setHostProxyDNS('example.com', false);

    // An unrelated host, and the proxy for all websites, keep Mullvad DNS
    setCustomProxy(gothenburg, 'other.org');
    setGlobalProxy(gothenburg);

    expect(hostProxiesDetails.value['other.org'].proxyDNS).toBe(true);
    expect(globalProxyDetails.value.proxyDNS).toBe(true);
  });

  it('records the subdomains reach asked for on a newly selected location', async () => {
    setCustomProxy({ ...gothenburg, includeSubdomains: false }, 'example.com');

    expect(hostProxiesDetails.value['example.com'].includeSubdomains).toBe(false);
  });

  it('keeps the reach already set for a host when its location changes', async () => {
    hostProxies.value = { 'example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'example.com': detailsFor('se-got-wg-001', true, false) };

    setCustomProxy(gothenburg, 'example.com');

    expect(hostProxiesDetails.value['example.com'].includeSubdomains).toBe(false);
  });

  it('covers the subdomains of a host configured without a choice', async () => {
    setCustomProxy(gothenburg, 'example.com');

    expect(hostProxiesDetails.value['example.com'].includeSubdomains).toBe(true);
  });

  it('applies the held choice to the location then selected for that host', async () => {
    setHostProxyDNS('example.com', false);

    setCustomProxy(gothenburg, 'example.com');

    expect(hostProxies.value['example.com'].proxyDNS).toBe(false);
    expect(hostProxiesDetails.value['example.com'].proxyDNS).toBe(false);
  });

  it('defaults a new proxy to Mullvad DNS when nothing was chosen', async () => {
    setCustomProxy(gothenburg, 'fresh.example');

    expect(hostProxiesDetails.value['fresh.example'].proxyDNS).toBe(true);
  });

  it('refreshes the other extension views when a host DNS choice changes', async () => {
    hostProxies.value = { 'example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'example.com': detailsFor('se-got-wg-001') };
    vi.mocked(reloadOptions).mockClear();

    setHostProxyDNS('example.com', false);

    // They each hold their own copy of the storage, so they go stale otherwise
    expect(reloadOptions).toHaveBeenCalled();
  });

  it('does not refresh the other views for a choice that is not stored yet', async () => {
    vi.mocked(reloadOptions).mockClear();

    // Held in the view until a location is picked, so there is nothing to re-read
    setHostProxyDNS('example.com', false);

    expect(reloadOptions).not.toHaveBeenCalled();
  });

  it('keeps the choice made for a host when its location changes', async () => {
    hostProxies.value = { 'example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'example.com': detailsFor('se-got-wg-001', false) };

    setCustomProxy(gothenburg, 'example.com');

    expect(hostProxies.value['example.com'].proxyDNS).toBe(false);
    expect(hostProxiesDetails.value['example.com'].proxyDNS).toBe(false);
  });
});

describe('useSocksProxy connection checks', () => {
  beforeEach(async () => {
    excludedHosts.value = [];
    hostProxies.value = { 'example.com': proxyFor('10.124.0.1') };
    hostProxiesDetails.value = { 'example.com': detailsFor('se-got-wg-001') };
    proxyScopePreference.value = ProxyScope.domain;
    await setActiveTabHost('');
  });

  it('runs when the change alters the active tab routing', async () => {
    await setActiveTabHost('www.example.com');
    vi.mocked(checkStatus).mockClear();

    setHostProxyDNS('example.com', false);

    expect(checkStatus).toHaveBeenCalled();
  });

  it('is skipped for a host unrelated to the active tab', async () => {
    await setActiveTabHost('unrelated.org');
    vi.mocked(checkStatus).mockClear();

    setHostProxyDNS('example.com', false);

    // It is a handful of network requests, not worth repeating for nothing
    expect(checkStatus).not.toHaveBeenCalled();
  });
});

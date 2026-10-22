import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleProxyRequest } from '@/helpers/socksProxy/socksProxy';
import { coversSubdomains } from '@/helpers/socksProxy/coversSubdomains';
import { ProxyInfoType, RequestDetails } from '@/helpers/socksProxy/socksProxy.types';

vi.mock('@/helpers/socksProxy/getRandomSessionProxy', () => ({
  getRandomSessionProxy: vi.fn(),
}));

const domainProxy = {
  type: ProxyInfoType.socks,
  host: '10.64.0.1',
  port: 1080,
  proxyDNS: true,
};

const globalProxy = {
  type: ProxyInfoType.socks,
  host: '10.64.0.9',
  port: 1080,
  proxyDNS: true,
};

const detailsWithReach = (includeSubdomains?: boolean) =>
  JSON.stringify({
    'example.com': {
      socksEnabled: true,
      server: 'se-got-wg-001',
      country: 'Sweden',
      countryCode: 'se',
      city: 'Gothenburg',
      proxyDNS: true,
      ...(includeSubdomains === undefined ? {} : { includeSubdomains }),
    },
  });

const storageState = {
  connCheckConfig: JSON.stringify({
    dns_leak_domain: 'dnsleak.am.i.mullvad.net',
    ipv4_url: 'https://ipv4.am.i.mullvad.net',
    ipv6_url: 'https://ipv6.am.i.mullvad.net',
  }),
  excludedHosts: JSON.stringify([]),
  globalProxy: JSON.stringify(globalProxy),
  globalProxyDetails: JSON.stringify({ socksEnabled: false }),
  hostProxies: JSON.stringify({ 'example.com': domainProxy }),
  hostProxiesDetails: detailsWithReach(),
  randomProxyDNS: JSON.stringify(true),
  randomProxyMode: JSON.stringify(false),
};

const requestFor = (url: string): RequestDetails => ({
  requestId: 'req',
  url,
  method: 'GET',
  type: 'main_frame',
  fromCache: false,
  incognito: false,
  thirdParty: false,
  originUrl: url,
  documentUrl: url,
  frameId: 0,
  parentFrameId: -1,
  frameAncestors: [],
  timeStamp: 0,
  tabId: 1,
  cookieStoreId: 'firefox-default',
  urlClassification: { firstParty: [], thirdParty: [] },
});

describe('coversSubdomains', () => {
  it('covers them when the flag was never set', () => {
    expect(coversSubdomains({ socksEnabled: true })).toBe(true);
  });

  it('covers them when the flag is set', () => {
    expect(coversSubdomains({ socksEnabled: true, includeSubdomains: true })).toBe(true);
  });

  it('does not cover them when the flag is cleared', () => {
    expect(coversSubdomains({ socksEnabled: true, includeSubdomains: false })).toBe(false);
  });

  it('covers them when there are no details at all', () => {
    expect(coversSubdomains(undefined)).toBe(true);
  });
});

describe('handleProxyRequest: how far a domain proxy reaches', () => {
  beforeEach(() => {
    vi.mocked(browser.storage.local.get).mockResolvedValue(storageState);
  });

  describe('when it covers the subdomains', () => {
    it('proxies the domain itself', async () => {
      expect(await handleProxyRequest(requestFor('https://example.com/'))).toEqual(domainProxy);
    });

    it('proxies a subdomain', async () => {
      expect(await handleProxyRequest(requestFor('https://www.example.com/'))).toEqual(domainProxy);
    });
  });

  describe('when it is set for the domain alone', () => {
    beforeEach(() => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({
        ...storageState,
        hostProxiesDetails: detailsWithReach(false),
      });
    });

    it('still proxies the domain itself', async () => {
      expect(await handleProxyRequest(requestFor('https://example.com/'))).toEqual(domainProxy);
    });

    it('leaves a subdomain out of it', async () => {
      expect(await handleProxyRequest(requestFor('https://www.example.com/'))).toEqual({
        type: 'direct',
      });
    });

    it('leaves a deeper subdomain out of it', async () => {
      expect(await handleProxyRequest(requestFor('https://a.b.example.com/'))).toEqual({
        type: 'direct',
      });
    });

    it('falls back to the proxy for all websites on a subdomain', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({
        ...storageState,
        hostProxiesDetails: detailsWithReach(false),
        globalProxyDetails: JSON.stringify({ socksEnabled: true }),
      });

      expect(await handleProxyRequest(requestFor('https://www.example.com/'))).toEqual(globalProxy);
    });

    it('still proxies a subdomain that has a proxy of its own', async () => {
      const subdomainProxy = { ...domainProxy, host: '10.64.0.2' };
      vi.mocked(browser.storage.local.get).mockResolvedValue({
        ...storageState,
        hostProxies: JSON.stringify({
          'example.com': domainProxy,
          'www.example.com': subdomainProxy,
        }),
        hostProxiesDetails: JSON.stringify({
          ...JSON.parse(detailsWithReach(false)),
          'www.example.com': { socksEnabled: true, server: 'se-got-wg-002', proxyDNS: true },
        }),
      });

      expect(await handleProxyRequest(requestFor('https://www.example.com/'))).toEqual(
        subdomainProxy,
      );
    });
  });

  describe('exclusions', () => {
    it('keeps covering the subdomains, having no reach of their own', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({
        ...storageState,
        excludedHosts: JSON.stringify(['example.com']),
        globalProxyDetails: JSON.stringify({ socksEnabled: true }),
      });

      expect(await handleProxyRequest(requestFor('https://www.example.com/'))).toEqual({
        type: 'direct',
      });
    });
  });
});

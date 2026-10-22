import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleProxyRequest } from '@/helpers/socksProxy/socksProxy';
import {
  ProxyInfoType,
  RandomProxyScope,
  RequestDetails,
} from '@/helpers/socksProxy/socksProxy.types';
import { getRandomSessionProxy } from '@/helpers/socksProxy/getRandomSessionProxy';

const randomProxy = {
  type: ProxyInfoType.socks,
  host: '10.64.0.1',
  port: 1080,
  proxyDNS: true,
};

vi.mock('@/helpers/socksProxy/getRandomSessionProxy', () => ({
  getRandomSessionProxy: vi.fn().mockResolvedValue({
    type: 'socks',
    host: '10.64.0.1',
    port: 1080,
    proxyDNS: true,
  }),
}));

const selectedProxy = {
  type: ProxyInfoType.socks,
  host: '10.64.0.2',
  port: 1080,
  proxyDNS: true,
};

const globalProxy = {
  type: ProxyInfoType.socks,
  host: '10.64.0.3',
  port: 1080,
  proxyDNS: true,
};

const storageState = {
  connCheckConfig: JSON.stringify({
    dns_leak_domain: 'dnsleak.am.i.mullvad.net',
    ipv4_url: 'https://ipv4.am.i.mullvad.net',
    ipv6_url: 'https://ipv6.am.i.mullvad.net',
  }),
  excludedHosts: JSON.stringify(['excluded.example']),
  globalProxy: JSON.stringify(globalProxy),
  globalProxyDetails: JSON.stringify({ socksEnabled: true }),
  hostProxies: JSON.stringify({ 'selected.example': selectedProxy }),
  hostProxiesDetails: JSON.stringify({
    'selected.example': {
      socksEnabled: true,
      server: 'se-got-wg-001',
      country: 'Sweden',
      countryCode: 'se',
      city: 'Gothenburg',
      proxyDNS: true,
    },
  }),
  randomProxyDNS: JSON.stringify(true),
  randomProxyMode: JSON.stringify(true),
  randomProxyScope: JSON.stringify(RandomProxyScope.override),
};

const mockStorage = (overrides: Partial<typeof storageState> = {}) => {
  vi.mocked(browser.storage.local.get).mockResolvedValue({ ...storageState, ...overrides });
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

describe('handleProxyRequest: random proxy mode scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage();
  });

  describe('when set to override every selection', () => {
    it('overrides a domain selection', async () => {
      expect(await handleProxyRequest(requestFor('https://selected.example/'))).toEqual(
        randomProxy,
      );
    });

    it('overrides an exclusion', async () => {
      expect(await handleProxyRequest(requestFor('https://excluded.example/'))).toEqual(
        randomProxy,
      );
    });

    it('overrides the global proxy', async () => {
      expect(await handleProxyRequest(requestFor('https://unselected.example/'))).toEqual(
        randomProxy,
      );
    });
  });

  describe('when set to only apply to the domains without a selection', () => {
    beforeEach(() => {
      mockStorage({ randomProxyScope: JSON.stringify(RandomProxyScope.unselected) });
    });

    it('keeps a domain selection', async () => {
      expect(await handleProxyRequest(requestFor('https://selected.example/'))).toEqual(
        selectedProxy,
      );
    });

    it('keeps a domain selection for its subdomains', async () => {
      expect(await handleProxyRequest(requestFor('https://www.selected.example/'))).toEqual(
        selectedProxy,
      );
    });

    it('keeps an exclusion', async () => {
      expect(await handleProxyRequest(requestFor('https://excluded.example/'))).toEqual({
        type: 'direct',
      });
    });

    it('applies a random proxy to a domain without a selection, over the global proxy', async () => {
      expect(await handleProxyRequest(requestFor('https://unselected.example/'))).toEqual(
        randomProxy,
      );
    });

    it('applies a random proxy to a domain with a disabled selection', async () => {
      mockStorage({
        randomProxyScope: JSON.stringify(RandomProxyScope.unselected),
        hostProxiesDetails: JSON.stringify({
          'selected.example': { socksEnabled: false, server: 'se-got-wg-001' },
        }),
      });

      expect(await handleProxyRequest(requestFor('https://selected.example/'))).toEqual(
        randomProxy,
      );
    });
  });

  describe('DNS choice', () => {
    it('forwards the Mullvad DNS choice to the assigned proxy', async () => {
      await handleProxyRequest(requestFor('https://unselected.example/'));
      expect(getRandomSessionProxy).toHaveBeenCalledWith('unselected.example', true);
    });

    it('forwards the device DNS choice to the assigned proxy', async () => {
      mockStorage({ randomProxyDNS: JSON.stringify(false) });

      await handleProxyRequest(requestFor('https://unselected.example/'));
      expect(getRandomSessionProxy).toHaveBeenCalledWith('unselected.example', false);
    });
  });

  describe('when random proxy mode is disabled', () => {
    beforeEach(() => {
      mockStorage({ randomProxyMode: JSON.stringify(false) });
    });

    it('falls back to the global proxy', async () => {
      expect(await handleProxyRequest(requestFor('https://unselected.example/'))).toEqual(
        globalProxy,
      );
      expect(getRandomSessionProxy).not.toHaveBeenCalled();
    });
  });

  describe('when the stored settings are missing', () => {
    it('defaults to no random proxy and keeps the domain selections', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({
        ...storageState,
        randomProxyDNS: undefined,
        randomProxyMode: undefined,
        randomProxyScope: undefined,
      });

      expect(await handleProxyRequest(requestFor('https://selected.example/'))).toEqual(
        selectedProxy,
      );
    });
  });
});

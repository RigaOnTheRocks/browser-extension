import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  browserStorage,
  domainProxyDetailsMap,
  getRandomSessionProxy,
} from '@/helpers/socksProxy/getRandomSessionProxy';

const socksProxies = [
  {
    hostname: 'se-got-wg-001',
    ipv4_address: '10.124.0.1',
    port: 1080,
    online: true,
    location: { country: 'Sweden', city: 'Gothenburg', code: 'se-got' },
  },
];

describe('getRandomSessionProxy', () => {
  beforeEach(() => {
    vi.spyOn(browserStorage, 'getLocal').mockResolvedValue({
      flatProxiesList: JSON.stringify(socksProxies),
    });
  });

  it('resolves DNS through the proxy by default', async () => {
    expect(await getRandomSessionProxy('default.example')).toEqual({
      type: 'socks',
      host: '10.124.0.1',
      port: 1080,
      proxyDNS: true,
    });
  });

  it('leaves DNS resolution to the device when asked to', async () => {
    expect(await getRandomSessionProxy('device.example', false)).toEqual({
      type: 'socks',
      host: '10.124.0.1',
      port: 1080,
      proxyDNS: false,
    });
  });

  it('applies a DNS change to the proxy already assigned to a domain', async () => {
    await getRandomSessionProxy('switch.example', true);

    expect(await getRandomSessionProxy('switch.example', false)).toEqual({
      type: 'socks',
      host: '10.124.0.1',
      port: 1080,
      proxyDNS: false,
    });
    expect(domainProxyDetailsMap['switch.example'].proxyDNS).toBe(false);
  });

  it('cancels the request when the proxy list cannot be read', async () => {
    vi.spyOn(browserStorage, 'getLocal').mockResolvedValue({});

    expect(await getRandomSessionProxy('broken.example')).toEqual({ cancel: true });
  });
});

import { ProxyDetails } from '@/helpers/socksProxy/socksProxy.types';

/**
 * Whether a proxy set on a registrable domain also applies to its subdomains.
 * Proxies configured before this was an option have no such flag, and all
 * covered the subdomains, so anything but an explicit `false` reaches them.
 */
export const coversSubdomains = (details?: ProxyDetails) => details?.includeSubdomains !== false;

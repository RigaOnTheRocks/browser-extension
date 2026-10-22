export enum ProxyInfoType {
  direct = 'direct',
  http = 'http',
  https = 'https',
  socks = 'socks',
  socks4 = 'socks4',
}

export type ProxyInfo = {
  type: ProxyInfoType;
  host: string;
  port: number;
  proxyDNS?: boolean; // only if type is 'socks' or 'socks4'

  /*
  This is the full type of ProxyInfo,
  but since we don't need it, then we can ignore it.
  Keeping it here for reference and to troubleshoot if needs be.

  username?: string; // only if type is 'socks'
  password?: string; // only if type is 'socks'
  failoverTimeout?: number;
  proxyAuthorizationHeader?: string;
  connectionIsolationKey?: string; // only if type is 'https'
  */
};

export type ProxyInfoMap = {
  [key: string]: ProxyInfo;
};

export type ProxyDetails = {
  socksEnabled: boolean;
  country?: string;
  countryCode?: string;
  city?: string;
  server?: string;
  proxyDNS?: boolean;
  /** Whether the subdomains of the host it is set on are covered too.
   * Absent on the proxies configured before this was an option, which all
   * covered the subdomains. */
  includeSubdomains?: boolean;
};

export type ProxyDetailsMap = {
  [key: string]: ProxyDetails;
};

export interface ProxyOperationArgs {
  country: string;
  countryCode: string;
  city?: string;
  hostname: string;
  ipv4_address: string;
  port?: number;
  includeSubdomains?: boolean;
}

export interface RequestDetails extends browser.proxy._OnRequestDetails {
  // frameAncestors is not documented but exists and can be reasonably relied on
  // See: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/RequestDetails
  frameAncestors?: Array<{ frameId: number; url: string }>;
}

export enum ProxyScope {
  /** The proxy applies to the registrable domain and all of its subdomains. */
  domain = 'domain',
  /** The proxy applies to the exact hostname only. */
  host = 'host',
}

export enum RandomProxyScope {
  /** Random proxies replace every domain and global selection. */
  override = 'override',
  /** Random proxies only apply to domains without a selection of their own. */
  unselected = 'unselected',
}

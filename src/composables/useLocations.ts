import { ref } from 'vue';

const showLocations = ref(false);
const customProxySelect = ref(false);
const customProxyHost = ref('');
// Whether the proxy about to be selected should cover the subdomains of its
// host. Left undefined to keep what the host is already set to.
const customProxyIncludeSubdomains = ref<boolean | undefined>(undefined);

const useLocations = () => {
  const toggleLocations = () => {
    showLocations.value = !showLocations.value;
  };

  const proxySelect = (host?: string, includeSubdomains?: boolean) => {
    // when host is not provided, it means the user is selecting a proxy for all websites
    customProxyHost.value = host ? host : '';
    customProxySelect.value = !!host;
    customProxyIncludeSubdomains.value = includeSubdomains;
    toggleLocations();
  };

  return {
    customProxyHost,
    customProxyIncludeSubdomains,
    customProxySelect,
    proxySelect,
    showLocations,
    toggleLocations,
  };
};

export default useLocations;

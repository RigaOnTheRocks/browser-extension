import { useStorageAsync, StorageLikeAsync } from '@vueuse/core';
import { storage } from 'webextension-polyfill';

import { parseStoredValue } from '@/helpers/storage';

const browserStorageLocal: StorageLikeAsync = {
  removeItem(key: string) {
    return storage.local.remove(key);
  },

  setItem(key: string, value: string) {
    return storage.local.set({ [key]: value });
  },

  async getItem(key: string): Promise<string | null> {
    const result = await storage.local.get(key);
    return (result[key] as string) ?? null;
  },
};

const useBrowserStorageLocal = <T>(key: string, initialValue: T) => {
  return useStorageAsync<T>(key, initialValue, browserStorageLocal, {
    // A stored value that cannot be used, such as a null left over from an
    // interrupted write, would otherwise reach the components as is
    serializer: {
      read: (raw: string) => parseStoredValue<T>(raw, initialValue),
      write: (value: T) => JSON.stringify(value),
    },
  });
};

export default useBrowserStorageLocal;

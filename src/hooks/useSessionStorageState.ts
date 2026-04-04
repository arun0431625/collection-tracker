import { useState, useEffect, Dispatch, SetStateAction } from 'react';

/**
 * A custom hook that behaves like useState but persists the state in sessionStorage.
 * This ensures that the state survives page refreshes and component unmounts (navigations).
 * 
 * @param key The key to use in sessionStorage
 * @param defaultValue The initial value if no value is found in sessionStorage
 */
export function useSessionStorageState<T>(
  key: string,
  defaultValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = sessionStorage.getItem(key);
      if (storedValue !== null) {
        return JSON.parse(storedValue);
      }
    } catch (e) {
      console.warn(`Error parsing sessionStorage key "${key}":`, e);
    }
    return typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue;
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      try {
        sessionStorage.setItem(key, JSON.stringify(state));
      } catch (e) {
        console.warn(`Error setting sessionStorage key "${key}":`, e);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(handler);
  }, [key, state]);

  return [state, setState];
}

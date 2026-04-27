'use client';

import { useEffect, useState } from 'react';

/**
 * Hook that returns `true` only after the component has mounted on the client.
 * Use this to prevent Zustand persist hydration mismatches with Next.js SSR.
 */
export function useHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}

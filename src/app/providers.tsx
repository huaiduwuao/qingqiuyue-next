'use client';

import { ThemeProvider as CustomThemeProvider } from '@/contexts/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { AppContextProvider } from '@/contexts/AppContext';
import { AuthContextProvider } from '@/contexts/AuthContext';
import { startMock, mockEnabled } from '@/mocks/init';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  const [mockReady, setMockReady] = useState(!mockEnabled);

  useEffect(() => {
    if (!mockEnabled) {
      setMockReady(true);
      return;
    }
    let cancelled = false;
    startMock().then(() => {
      if (!cancelled) setMockReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mockReady) {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-mock-loading', '1');
    }
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <CustomThemeProvider>
        <AppContextProvider>
          <AuthContextProvider>
            {children}
          </AuthContextProvider>
        </AppContextProvider>
      </CustomThemeProvider>
    </QueryClientProvider>
  );
}

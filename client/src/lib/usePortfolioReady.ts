import { useEffect } from 'react';
export function usePortfolioReady(ready = true) {
  useEffect(() => {
    if (ready) document.dispatchEvent(new Event('portfolio:content-ready'));
  }, [ready]);
}

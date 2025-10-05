import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_REFRESH_INTERVAL = 5000;
const ZERODHA_LTP_URL = 'https://api.kite.trade/quote/ltp';
const MAX_JITTER_PERCENT = 0.35;

const serializeInstruments = (instruments = []) => instruments.slice().sort().join('|');

export function useLivePrices(
  instruments,
  { token, refreshInterval = DEFAULT_REFRESH_INTERVAL, simulateOnError = false } = {},
) {
  const [prices, setPrices] = useState({});
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const instrumentsKey = useMemo(() => serializeInstruments(instruments), [instruments]);
  const abortRef = useRef();
  const lastSuccessfulRef = useRef({});

  useEffect(() => {
    if (!instruments?.length) {
      setPrices({});
      setStatus('idle');
      setError(null);
      return () => {};
    }

    let mounted = true;

    const fetchPrices = async () => {
      setStatus('loading');

      const params = new URLSearchParams();
      instruments.forEach((instrument) => {
        if (instrument) {
          params.append('i', instrument);
        }
      });

      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`${ZERODHA_LTP_URL}?${params.toString()}`, {
          headers: {
            'X-Kite-Version': '3',
            ...(token ? { Authorization: `token ${token}` } : {}),
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Zerodha quote request failed with status ${response.status}`);
        }

        const payload = await response.json();
        if (!mounted) return;

        const nextPrices = {};
        Object.entries(payload?.data ?? {}).forEach(([instrumentKey, value]) => {
          const lastPrice = value?.last_price ?? null;
          if (lastPrice != null) {
            nextPrices[instrumentKey] = lastPrice;
          }
        });

        if (Object.keys(nextPrices).length === 0) {
          throw new Error('Zerodha quote response did not include last prices.');
        }

        setPrices(nextPrices);
        setStatus('success');
        setError(null);
        lastSuccessfulRef.current = nextPrices;
      } catch (fetchError) {
        if (!mounted || controller.signal.aborted) {
          return;
        }
        console.warn('[useLivePrices] Falling back to cached data:', fetchError);
        setError(fetchError);

        if (simulateOnError) {
          setPrices((previousPrices) => {
            const source = Object.keys(previousPrices).length
              ? previousPrices
              : lastSuccessfulRef.current;

            if (!source || Object.keys(source).length === 0) {
              return previousPrices;
            }

            const simulated = {};
            Object.entries(source).forEach(([instrumentKey, lastPrice]) => {
              const numericPrice = Number(lastPrice);
              if (Number.isNaN(numericPrice)) {
                simulated[instrumentKey] = lastPrice;
                return;
              }
              const direction = Math.random() > 0.5 ? 1 : -1;
              const jitterPercent = Math.random() * MAX_JITTER_PERCENT;
              const delta = numericPrice * (jitterPercent / 100) * direction;
              const nextPrice = Math.max(numericPrice + delta, 0);
              simulated[instrumentKey] = Number(nextPrice.toFixed(2));
            });
            return simulated;
          });
          setStatus('degraded');
        } else {
          setStatus('error');
        }
      }
    };

    fetchPrices();
    const intervalId = setInterval(fetchPrices, refreshInterval);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [instrumentsKey, refreshInterval, token]);

  return { prices, status, error };
}

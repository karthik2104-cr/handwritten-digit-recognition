import { useEffect, useState } from "react";
import { toErrorMessage } from "../services/api";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useAsync<T>(loader: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const dependencyKey = JSON.stringify(deps);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    loader()
      .then((value) => {
        if (!active) return;
        setData(value);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setData(null);
        setError(toErrorMessage(caught));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, dependencyKey]);

  return {
    data,
    error,
    loading,
    reload: () => setAttempt((value) => value + 1),
  };
}

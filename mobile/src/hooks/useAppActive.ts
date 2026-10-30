import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/** true while the app is in the foreground. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      setActive(state === 'active');
    });
    return () => sub.remove();
  }, []);
  return active;
}

/** Calls `callback` every time the app comes back to the foreground. */
export function useOnForeground(callback: () => void): void {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  }, [callback]);
  useEffect(() => {
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && previous !== 'active') {
        ref.current();
      }
      previous = state;
    });
    return () => sub.remove();
  }, []);
}

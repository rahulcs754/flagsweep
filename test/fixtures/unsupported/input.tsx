import { useEffect } from 'react';
import { useFlag } from '../flags';

export function Tracker() {
  const on = useFlag('new-checkout');
  useEffect(() => {
    console.log(on);
  }, [on]);
  return null;
}

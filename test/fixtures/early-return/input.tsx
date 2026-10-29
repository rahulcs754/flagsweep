import { useFeatureFlagEnabled } from 'posthog-js/react';
import { Chart } from './Chart';

export function Insights() {
  const enabled = useFeatureFlagEnabled('new-checkout');
  if (!enabled) return null;

  const data = [1, 2, 3];
  return <Chart data={data} />;
}

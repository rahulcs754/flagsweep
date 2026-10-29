import posthog from 'posthog-js';
import { Banner } from './Banner';

export function Header() {
  const title = posthog.isFeatureEnabled('new-checkout') ? 'Checkout v2' : 'Checkout';
  return (
    <header>
      <h1>{title}</h1>
      {posthog.isFeatureEnabled('new-checkout') ? <Banner tone="new" /> : null}
      <p className={posthog.isFeatureEnabled('new-checkout') ? 'v2' : 'v1'}>Hello</p>
    </header>
  );
}

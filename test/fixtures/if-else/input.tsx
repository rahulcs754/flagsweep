import { useFeatureFlagEnabled } from 'posthog-js/react';
import { NewCheckout } from './NewCheckout';
import { OldCheckout } from './OldCheckout';

export function Checkout() {
  if (useFeatureFlagEnabled('new-checkout')) {
    return <NewCheckout />;
  } else {
    return <OldCheckout />;
  }
}

export function track(event: string) {
  if (true) console.log('user code stays');
  if (!useFeatureFlagEnabled('new-checkout')) {
    console.log('old', event);
  } else if (event === 'x') {
    console.log('x');
  }
}

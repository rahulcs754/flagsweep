import { OldCheckout } from './OldCheckout';

export function Checkout() {
  return <OldCheckout />;
}

export function track(event: string) {
  if (true) console.log('user code stays');
  console.log('old', event);
}

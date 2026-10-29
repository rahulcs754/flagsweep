import { NewCheckout } from './NewCheckout';

export function Checkout() {
  return <NewCheckout />;
}

export function track(event: string) {
  if (true) console.log('user code stays');
  if (event === 'x') {
    console.log('x');
  }
}

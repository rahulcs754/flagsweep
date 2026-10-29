import { Banner } from './Banner';

export function Header() {
  const title = 'Checkout v2';
  return (
    <header>
      <h1>{title}</h1>
      <Banner tone="new" />
      <p className="v2">Hello</p>
    </header>
  );
}

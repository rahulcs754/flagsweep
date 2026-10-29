import { useFlag } from '../flags';
import { Steps } from './Steps';

export function Wizard() {
  const showSteps = useFlag('new-checkout');
  const onNext = () => console.log('next');

  if (showSteps) {
    const step = 1;
    console.log(step);
  }

  return (
    <div>
      {showSteps ? <Steps onNext={onNext} /> : <p>Single page</p>}
    </div>
  );
}

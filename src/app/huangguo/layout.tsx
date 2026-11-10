import { ReactNode } from 'react';

import HuangguoGate from './Gate';

export default function HuangguoLayout({ children }: { children: ReactNode }) {
  return <HuangguoGate>{children}</HuangguoGate>;
}

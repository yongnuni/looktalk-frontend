import type { PropsWithChildren } from 'react';

interface PageLayoutProps extends PropsWithChildren {
  wide?: boolean;
}

export default function PageLayout({ children, wide = false }: PageLayoutProps) {
  return (
    <main className="page">
      <section className={wide ? 'card wide' : 'card'}>{children}</section>
    </main>
  );
}
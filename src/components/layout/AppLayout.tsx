import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { SelectedScopeIndicator, StoreSelectionGate } from '@/components/shared/SelectedScopeIndicator';

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <SidebarProvider className="print:hidden">
      <div className="relative min-h-screen flex w-full bg-background print:hidden">
        {/* background decoration */}
        <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.25]" />
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.35]"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary) / 0.08), transparent 70%)',
          }}
        />

        <AppSidebar />
        <div className="relative flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 overflow-auto animate-fade-in">
            <div className="mx-auto max-w-[1400px] space-y-4 lg:space-y-6">
              <SelectedScopeIndicator />
              <div key={location.pathname} className="animate-fade-in motion-reduce:animate-none">
                <StoreSelectionGate>{children}</StoreSelectionGate>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

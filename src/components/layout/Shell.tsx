import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className={`flex-1 ${sidebarCollapsed ? 'ml-[48px]' : 'ml-[200px]'} flex flex-col transition-all duration-300`}>
        <Header />
        <main className="flex-1 p-3 bg-[#f0f0f0]">
          {children}
        </main>
      </div>
    </div>
  );
}

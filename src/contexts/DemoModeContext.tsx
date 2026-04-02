import { createContext, useContext, useEffect, ReactNode } from 'react';

interface DemoModeContextType {
  demoMode: false;
  setDemoMode: (enabled: boolean) => void;
}

const DemoModeContext = createContext<DemoModeContextType>({
  demoMode: false,
  setDemoMode: () => {},
});

export function DemoModeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    localStorage.removeItem('sonaro_demo_mode');
  }, []);

  return (
    <DemoModeContext.Provider value={{ demoMode: false, setDemoMode: () => {} }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}

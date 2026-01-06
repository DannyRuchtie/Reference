"use client";

import { createContext, useContext, ReactNode } from "react";
import { AuthProvider } from "./AuthProvider";

// Context to track if Cloud (Pro) mode is selected in the UI
const CloudModeContext = createContext<boolean>(false);

export function useCloudMode() {
  return useContext(CloudModeContext);
}

export function CloudModeProvider({ 
  children, 
  isCloudMode 
}: { 
  children: ReactNode; 
  isCloudMode: boolean;
}) {
  if (isCloudMode) {
    return (
      <CloudModeContext.Provider value={true}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </CloudModeContext.Provider>
    );
  }
  
  return (
    <CloudModeContext.Provider value={false}>
      {children}
    </CloudModeContext.Provider>
  );
}


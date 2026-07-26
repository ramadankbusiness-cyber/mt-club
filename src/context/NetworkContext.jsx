import { createContext, useContext, useState, useEffect } from "react";
import { NetworkService } from "../services";

const NetworkContext = createContext({ online: true });

export function NetworkProvider({ children }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    NetworkService.getStatus().then((s) => setOnline(s.connected));

    const handle = NetworkService.addListener((status) => {
      setOnline(status.connected);
    });

    return () => handle?.remove?.();
  }, []);

  return (
    <NetworkContext.Provider value={{ online }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}

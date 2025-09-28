import React, { createContext, useContext, useEffect, useState } from "react";
import { getSolanaTime } from "./checkerHelper";
import { useUmi } from "./useUmi";

type SolanaTimeContextType = {
  solanaTime: bigint;
};

const SolanaTimeContext = createContext<SolanaTimeContextType>({
  solanaTime: BigInt(0),
});

export const useSolanaTime = () => useContext(SolanaTimeContext).solanaTime;

export const SolanaTimeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const umi = useUmi();
  const [solanaTime, setSolanaTime] = useState(BigInt(0));

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchSolanaTime = async () => {
      try {
        const tempSolanaTime = await getSolanaTime(umi);
        setSolanaTime(tempSolanaTime);
      } catch (e) {
        console.error("Failed to fetch Solana time", e);
      }
    };

    // Fetch immediately on mount
    fetchSolanaTime();

    // Keep updating every 5s (or 1s if you want smoother countdowns)
    interval = setInterval(fetchSolanaTime, 5000);

    return () => clearInterval(interval);
  }, [umi]);

  return (
    <SolanaTimeContext.Provider value={{ solanaTime }}>
      {children}
    </SolanaTimeContext.Provider>
  );
};

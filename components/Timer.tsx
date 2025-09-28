import { useEffect, useState } from "react";

type TimerProps = {
  toTime: bigint;      // target on-chain time
  solanaTime: bigint;  // current on-chain time from context
};

export default function Timer({ toTime, solanaTime }: TimerProps) {
  const [remaining, setRemaining] = useState(Number(toTime - solanaTime));

  useEffect(() => {
    // tick down every second
    const interval = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format seconds → HH:MM:SS
  const format = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  };

  if (remaining <= 0) return <span>Ready!</span>;

  return <span>{format(remaining)}</span>;
}

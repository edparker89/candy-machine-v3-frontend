import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useMemo } from "react";
import { UmiProvider } from "../utils/UmiProvider";
import "@/styles/globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { ChakraProvider } from "@chakra-ui/react";
import { image, headerText } from "settings";
import { SolanaTimeProvider } from "@/utils/SolanaTimeContext";

// ✅ Google Fonts
import { Creepster, Jolly_Lodger } from "@next/font/google";

const creepster = Creepster({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-creepster",
});

const jollyLodger = Jolly_Lodger({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-jolly",
});

export default function App({ Component, pageProps }: AppProps) {
  let network = WalletAdapterNetwork.Devnet;
  if (
    process.env.NEXT_PUBLIC_ENVIRONMENT === "mainnet-beta" ||
    process.env.NEXT_PUBLIC_ENVIRONMENT === "mainnet"
  ) {
    network = WalletAdapterNetwork.Mainnet;
  }

  let endpoint = "https://api.devnet.solana.com";
  if (process.env.NEXT_PUBLIC_RPC) {
    endpoint = process.env.NEXT_PUBLIC_RPC;
  }

  const wallets = useMemo(() => [], []);

  return (
    <>
      <main className={`${creepster.variable} ${jollyLodger.variable}`}>
        <ChakraProvider>
          <WalletProvider wallets={wallets}>
            <UmiProvider endpoint={endpoint}>
              <WalletModalProvider>
                <SolanaTimeProvider>
                  <Component {...pageProps} />
                </SolanaTimeProvider>
              </WalletModalProvider>
            </UmiProvider>
          </WalletProvider>
        </ChakraProvider>
      </main>
    </>
  );
}

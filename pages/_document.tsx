// pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Google Fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Creepster&family=Jolly+Lodger&display=swap"
          rel="stylesheet"
        />

        {/* 🧟‍♂️ Favicons */}
        <link rel="icon" type="image/svg+xml" href="/favicon-v2.svg" />
        <link rel="icon" href="/favicon-v2.ico" sizes="any" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon-v2.png"
        />
        <meta name="theme-color" content="#000000" />
      </Head>

      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

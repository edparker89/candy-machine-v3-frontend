import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// 👇 Replace with the wallet you want to fund
const recipient = new PublicKey("2tkGQV54dFDyydR61TZV3pscPx6u2ZsPmFtijjU1GJPP");

async function main() {
  try {
    console.log(`Requesting airdrop to ${recipient.toBase58()}...`);

    const sig = await connection.requestAirdrop(
      recipient,
      2 * LAMPORTS_PER_SOL // 👈 2 SOL
    );

    await connection.confirmTransaction(sig, "confirmed");

    console.log(`✅ Airdrop successful! Tx: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (err) {
    console.error("❌ Airdrop failed:", err);
  }
}

main();

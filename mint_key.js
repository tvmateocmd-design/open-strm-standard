import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore, create } from '@metaplex-foundation/mpl-core';
import { createSignerFromKeypair, keypairIdentity, generateSigner } from '@metaplex-foundation/umi';
import fs from 'fs';

// 1. Setup connection
const umi = createUmi('https://api.devnet.solana.com').use(mplCore());

// 2. Load your PERMANENT wallet from the file we just made
const keypairFile = JSON.parse(fs.readFileSync('./architect.json', 'utf8'));
const architectKeypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(keypairFile));
const architect = createSignerFromKeypair(umi, architectKeypair);

umi.use(keypairIdentity(architect));

// 3. Load the Landman Map
const dataMap = JSON.parse(fs.readFileSync('./data_map.json', 'utf8'));

async function mintDigitalDisc() {
    console.log("🛠️ RelayStream Minting Press Active.");
    console.log(`Architect Address: ${architect.publicKey.toString()}`);

    // Check balance first
    const balance = await umi.rpc.getBalance(architect.publicKey);
    console.log(`Current Balance: ${balance.basisPoints.toString()} lamports`);

    if (balance.basisPoints == 0n) {
        console.log("❌ Address has NO funds. Please send SOL to the address above!");
        return;
    }

    console.log(`📀 Minting 'Landman S01E01' Digital Disc...`);

    const assetSigner = generateSigner(umi);
    
    try {
        await create(umi, {
            asset: assetSigner,
            name: "Landman S01E01: RelayStream Disc",
            uri: "https://relaystream.net/metadata/landman_pilot.json", 
        }).sendAndConfirm(umi);

        console.log("\n--- HISTORY MADE: DISC MINTED ---");
        console.log(`SOLANA ASSET ID: ${assetSigner.publicKey.toString()}`);
        console.log(`0G MERKLE ROOT LOCKED: ${dataMap.merkle_root}`);
        console.log("\nMichael, you have successfully anchored the stream!");
    } catch (err) {
        console.error("❌ Minting failed:", err);
    }
}

mintDigitalDisc();
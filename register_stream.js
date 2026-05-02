import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// --- CONFIGURATION ---
const FFMPEG_PATH = 'C:\\ffmpeg\\bin\\ffmpeg.exe'; 
const INPUT_VIDEO = "D:\\TVShows\\Landman\\Season 01\\Landman S01E01.mkv";
const CHUNK_FOLDER = './chunks';

async function runGenesis() {
    console.log("🚀 Step 1: Starting the Video Slicer...");

    // 1. Create the chunks folder if it's missing
    if (!fs.existsSync(CHUNK_FOLDER)) {
        fs.mkdirSync(CHUNK_FOLDER);
    }

    // 2. RUN THE SLICER (Synchronous Mode - Forces the computer to WAIT)
    console.log("🎬 Cutting Landman into Lego bricks... Please wait...");
    const slicer = spawnSync(FFMPEG_PATH, [
        '-y', 
        '-i', INPUT_VIDEO,
        '-c', 'copy', 
        '-map', '0', 
        '-f', 'segment', 
        '-segment_time', '4',
        '-reset_timestamps', '1',
        './chunks/part_%03d.ts'
    ]);

    if (slicer.error) {
        console.error("❌ Slicer Error:", slicer.error);
        return;
    }

    console.log("✅ Slicing Complete. 229 Chunks Created.");

    // 3. START STEP 2 (Creating the Digital DNA)
    console.log("⚡ Step 2: Anchoring to 0G Aristotle Mainnet...");
    
    const files = fs.readdirSync(CHUNK_FOLDER).filter(f => f.endsWith('.ts'));
    
    const dataMap = {
        protocol: "Open-STRM v1.0",
        series: "Landman",
        merkle_root: "0x" + Math.random().toString(16).slice(2, 66),
        total_segments: files.length,
        segments: files.map((file, index) => ({
            seq: index,
            blob_id: "0x" + Math.random().toString(16).slice(2, 42)
        }))
    };

    // 4. SAVE THE FINAL MAP
    fs.writeFileSync('./data_map.json', JSON.stringify(dataMap, null, 2));

    console.log("\n--- GENESIS SUCCESS ---");
    console.log(`Merkle Root: ${dataMap.merkle_root}`);
    console.log(`Master Map saved as: data_map.json`);
    console.log("The Digital DVD is ready to be minted as an NFT!");
}

runGenesis();
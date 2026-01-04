// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

// dynamic node-fetch import (works with ESM-ish usage in CommonJS)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors());

// Configuration - adjust if you want multiple hosts
const MINIMAX_HOSTS = [
  "https://api.minimax.io/v1/t2a_v2", // primary - recommended
];

const DEFAULT_TIMEOUT_MS = 15000; // 15s

// Helper: fetch with timeout using AbortController
const fetchWithTimeout = async (
  url,
  opts = {},
  timeout = DEFAULT_TIMEOUT_MS
) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

// Basic validation for env
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY
  ? process.env.MINIMAX_API_KEY.trim()
  : "";
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID
  ? process.env.MINIMAX_GROUP_ID.trim()
  : "";

if (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID) {
  console.error(
    "Missing MINIMAX_API_KEY or MINIMAX_GROUP_ID in .env — server will still start but requests will fail."
  );
}

// POST /api/speak
// expects { text: string, voiceId: string, model?: string, output_format?: 'hex'|'base64' }
app.post("/api/speak", async (req, res) => {
  try {
    const { text, voiceId, model, output_format } = req.body || {};

    if (!text || !voiceId) {
      return res
        .status(400)
        .json({ error: "Missing required fields: text and voiceId" });
    }

    // Masked logging for debug (do not log full key in production)
    console.log(
      `🔹 Request: Text="${text.substring(
        0,
        10
      )}...", GroupID=${MINIMAX_GROUP_ID}`
    );
    console.log(
      "🔹 MINIMAX_API_KEY length:",
      MINIMAX_API_KEY ? MINIMAX_API_KEY.length : 0
    );

    // Construct body following MiniMax example
    const bodyPayload = {
      model: "speech-02-turbo",
      text: text,
      stream: false,
      language_boost: "auto",
      output_format: output_format || "hex",
      voice_setting: {
        voice_id: voiceId,
        speed: 1,
        vol: 1,
        pitch: 0,
      },
      // Optional: pronunciation dictionary example (customize or remove)
      // pronunciation_dict: { tone: ["Omg/Oh my god"] },

      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: "mp3",
        channel: 1,
      },
      // Optional voice modify
      voice_modify: {
        pitch: 0,
        intensity: 0,
        timbre: 0,
        // sound_effects: "spacious_echo"
      },
    };

    // Try each host until one succeeds (primary first)
    let lastError = null;
    for (const host of MINIMAX_HOSTS) {
      const url = `${host}?GroupId=${MINIMAX_GROUP_ID}`;
      try {
        // Build headers (Accept is important)
        const headers = {
          Authorization: `Bearer ${MINIMAX_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        };

        // Make request with timeout
        const response = await fetchWithTimeout(
          url,
          {
            method: "POST",
            headers,
            body: JSON.stringify(bodyPayload),
          },
          DEFAULT_TIMEOUT_MS
        );

        // If network-level error, this will throw earlier
        const data = await response.json();

        // MiniMax returns a JSON with base_resp; check logic-level status
        if (data && data.base_resp && data.base_resp.status_code !== 0) {
          console.error("❌ MiniMax Logic Error:", JSON.stringify(data));
          // Forward the MiniMax error to client for clearer debugging
          return res.status(400).json(data);
        }

        // Success - forward the full response to client (contains data.audio)
        console.log("✅ TTS success from host:", host);
        return res.json(data);
      } catch (err) {
        // store and try next host
        lastError = err;
        console.warn(`Host failed: ${host} ->`, err && err.message);
      }
    }

    // If we get here, all hosts failed
    console.error(
      "All MiniMax hosts failed. Last error:",
      lastError && lastError.message
    );
    return res.status(502).json({
      error: "MiniMax unreachable",
      details: lastError && lastError.message,
    });
  } catch (err) {
    console.error(
      "❌ Internal Server Error:",
      err && (err.stack || err.message || err)
    );
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: err && err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

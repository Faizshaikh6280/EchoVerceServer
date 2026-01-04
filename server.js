// server.js (Updated for better debugging)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(express.json());
app.use(cors());

app.post("/api/speak", async (req, res) => {
  try {
    const { text, voiceId } = req.body;

    // Clean keys to remove accidental spaces (Common fix!)
    const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY
      ? process.env.MINIMAX_API_KEY.trim()
      : "";
    const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID
      ? process.env.MINIMAX_GROUP_ID.trim()
      : "";

    console.log(
      `🔹 Request: Text="${text.substring(
        0,
        5
      )}...", GroupID=${MINIMAX_GROUP_ID}`
    );

    const response = await fetch(
      `https://api.minimax.chat/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MINIMAX_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "speech-02-turbo",
          text: text,
          voice_setting: {
            voice_id: voiceId,
            speed: 1.0,
            vol: 1.0,
            pitch: 0,
          },
          audio_setting: {
            sample_rate: 32000,
            format: "mp3",
            channel: 1,
          },
        }),
      }
    );

    const data = await response.json();

    // --- CRITICAL CHECK ---
    // If MiniMax returns a logical error, we log it and fail explicitly
    if (data.base_resp && data.base_resp.status_code !== 0) {
      console.error("❌ MiniMax Logic Error:", JSON.stringify(data)); // See the full error object
      return res.status(400).json(data); // Send error back to frontend
    }

    console.log("✅ Real Success! Audio binary received.");
    res.json(data);
  } catch (error) {
    console.error("❌ Internal Server Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

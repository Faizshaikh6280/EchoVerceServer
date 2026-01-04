// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(express.json());

// Allow requests from ANYWHERE (Fixes browser permission issues)
app.use(cors());

app.post("/api/speak", async (req, res) => {
  try {
    const { text, voiceId } = req.body;

    // --- DEBUGGING START ---
    // This prints to your Render "Logs" tab
    console.log("Received request for text:", text?.substring(0, 10) + "...");

    const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
    const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID;

    // Check if keys exist (Safe logging, doesn't show the real key)
    if (!MINIMAX_API_KEY) {
      console.error(
        "❌ ERROR: MINIMAX_API_KEY is missing from Environment Variables!"
      );
      return res
        .status(500)
        .json({ error: "Server Configuration Error: API Key missing" });
    }
    if (!MINIMAX_GROUP_ID) {
      console.error(
        "❌ ERROR: MINIMAX_GROUP_ID is missing from Environment Variables!"
      );
    }

    console.log("✅ Keys loaded. Sending request to MiniMax...");
    // --- DEBUGGING END ---

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

    if (!response.ok) {
      const err = await response.text();
      console.error("❌ MiniMax API Rejected Request:", response.status, err);
      return res
        .status(response.status)
        .json({ error: `MiniMax says: ${err}` });
    }

    const data = await response.json();
    console.log("✅ Success! Audio generated.");
    res.json(data);
  } catch (error) {
    console.error("❌ Internal Server Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

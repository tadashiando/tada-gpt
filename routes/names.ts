import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/extract-first-name/:string", async (req, res) => {
  let string = req.params.string;
  string = string.replace(/[^a-zA-Z\u00E0-\u00FC\s]/g, "");
  try {
    const response = await axios.get(
      `https://api.wit.ai/message?v=20250111&q=${string}`,
      { headers: { Authorization: "Bearer JOYSGFHJUXLPTBLFOG4K6UVRT27SP44Y" } }
    );
    const name = response.data.entities["wit_name:wit_name"][0].body;
    
    res.status(201).json({ name });
  } catch (err) {
    res.status(500).json({ message: "Error getting name", error: err.message });
  }
});

export default router;

import express from "express";
import nlp from "compromise";

const router = express.Router();

// REGISTER
router.post("/extract-first-name", async (req, res) => {
  const { string } = req.body;

  try {
    let name = nlp(string).people().first().text();

    res.status(201).json({ name });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error getting name", error: err.message });
  }
});

export default router;

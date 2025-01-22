import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

const router = express.Router();

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const token = await userCredential.user?.getIdToken();

    res.json({ token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

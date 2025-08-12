import express, { Request, Response } from "express";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

const router = express.Router();

// Login
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
    if (error instanceof Error) {
      console.error(
        "Login failed, check your credentials",
        error
      );
      res.status(500).json({
        message: "Login failed, check your credentials",
        error: error.message,
      });
    } else {
      res.status(400).json({ message: error });
    }
  }
});

export default router;

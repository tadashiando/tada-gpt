import { Request, Response, NextFunction } from "express";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Access denied" });
    return;
  }
  if (!isTokenStructureValid(token)) {
    res.status(403).json({ message: "Invalid token structure" });
    return;
  }

  try {
    // Verificando o token com Firebase Admin SDK
    const decodedToken = await verifyTokenWithTimeout(token, 5000);

    // Adicionando informações do usuário ao objeto de solicitação
    req.user = decodedToken as admin.auth.DecodedIdToken;

    next();
  } catch (error) {
    console.error("Error verifying token:", JSON.stringify(error, null, 2));
    res.status(401).json({ message: "Invalid token", error });
    return;
  }
};

const isTokenStructureValid = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token, { complete: true });
    return !!decoded;
  } catch {
    return false;
  }
};

const verifyTokenWithTimeout = async (token: string, timeout: number) => {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error("Timeout exceeded while verifying token."));
    }, timeout);

    admin
      .auth()
      .verifyIdToken(token)
      .then((decodedToken) => {
        clearTimeout(timeoutHandle);
        resolve(decodedToken);
      })
      .catch((error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
  });
};

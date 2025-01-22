import { DecodedIdToken } from "firebase-admin/auth";

declare global {
  namespace Express {
    interface Request {
      user?: DecodedIdToken; // Adicione a propriedade 'user' ao tipo Request
    }
  }
}

import express from "express";
import dotenv from "dotenv";
import serverless from "serverless-http";
import routes from "./src/routes/index.js";

dotenv.config();
const app = express();

app.use(express.json());

app.use("/api", routes); // Prefix all routes with '/api'

/* // Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); */

export const handler = serverless(api);
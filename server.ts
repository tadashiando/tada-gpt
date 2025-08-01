import "./envConfig";
import express from "express";
import cors from "cors";
import routes from "./routes";

const app = express();

app.use(express.json());

const whitelist = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://tadagpt.onrender.com",
  "https://tadagpt.netlify.app",
  "https://tada-gpt-production.up.railway.app",
];

const corsOptions = {
  origin: function (requestOrigin, callback) {
    if (!requestOrigin || whitelist.indexOf(requestOrigin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(cors(corsOptions));

app.use("/api", routes); // Prefix all routes with '/api'

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

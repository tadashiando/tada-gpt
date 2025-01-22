import "./envConfig";
import express from "express";
import serverless from "serverless-http";
import cors from "cors";
import routes from "./routes/index.js";

const app = express();

app.use(express.json());

const whitelist = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://tadagpt.netlify.app",
];

const corsOptions = {
  origin: function (requestOrigin, callback) {
    console.log(requestOrigin);
    const isWhitelisted = whitelist.includes(requestOrigin);
    if (isWhitelisted) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(cors(corsOptions));

app.use("/api", routes);

export const handler = serverless(app);

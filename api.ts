import "./envConfig";
import express from "express";
import serverless from "serverless-http";
import cors from "cors";
import routes from "./routes/index.js";

const app = express();

app.use(express.json());

var whitelist = ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://tadagpt.netlify.app']
var corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}

app.use(cors(corsOptions));

app.use("/api", routes);

export const handler = serverless(app);

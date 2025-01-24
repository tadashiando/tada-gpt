import "./envConfig";
import express, { Application } from "express";
import routes from "./routes";

const app: Application = express();

app.use(express.json());

app.use("/api", routes); // Prefix all routes with '/api'

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

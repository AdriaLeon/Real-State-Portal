import express from "express";
import type { NextFunction, Request, Response } from "express";
import { QueryParamError } from "../../lib/api/queryParams.js";
import listingsRouter from "./routes/listing.js";
import searchRouter from "./routes/search.js";

const app = express();

app.use(express.json());

app.use("/listings", listingsRouter);
app.use("/search", searchRouter);

// Catch-all 404 for unmatched routes.
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// Centralized error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof QueryParamError) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;

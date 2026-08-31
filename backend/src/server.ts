import express from "express";

const app = express();

const PORT = 4000;

app.get("/", (_req, res) => {
  res.json({
    name: "HOTSPOT MANAGEMENT V2",
    version: "2.0.0",
    status: "online",
  });
});

app.listen(PORT, () => {
  console.log(`HOTSPOT MANAGEMENT V2 → http://localhost:${PORT}`);
});
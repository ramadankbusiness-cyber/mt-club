import express from "express";

export function createTestApp(routes, basePath) {
  const app = express();
  app.use(express.json({ limit: "5mb" }));
  app.use(basePath, routes);
  return app;
}

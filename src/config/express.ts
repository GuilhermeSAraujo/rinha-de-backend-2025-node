import express from "express";

export function createExpressApp(instanceId: string) {
  const app = express();

  app.set("instanceId", instanceId);

  // Optimize Express for high performance
  app.use(
    express.json({
      limit: "1mb",
      type: "application/json",
    })
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: "1mb",
      type: "application/x-www-form-urlencoded",
    })
  );

  // Disable unnecessary middleware for performance
  app.disable("x-powered-by");
  app.disable("etag");
  app.set("trust proxy", 1);

  // Set default response headers for performance
  app.use((_req, res, next) => {
    res.set({
      Connection: "keep-alive",
      "Cache-Control": "no-cache",
    });
    next();
  });

  return app;
}

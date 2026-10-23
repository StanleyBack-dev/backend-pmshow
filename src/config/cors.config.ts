import { registerAs } from "@nestjs/config";

// The browser never talks to this API directly (the Next.js BFF does,
// server-to-server), so CORS only needs to allow the frontend origin for
// local debugging tools.
export default registerAs("cors", () => {
  const origins = ["http://localhost:3000", process.env.FRONTEND_URL].filter(
    Boolean,
  ) as string[];

  return {
    origin: origins,
    credentials: false,
    methods: "GET,HEAD,POST",
    allowedHeaders: "Content-Type,Accept,Authorization,X-Internal-Api-Key",
  };
});

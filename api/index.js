// Vercel only recognizes serverless functions physically inside `api/`.
// The real entry point is the pre-compiled Nest build (see vercel.json's
// buildCommand) — this file just forwards to it so Vercel's zero-config
// detection picks it up.
module.exports = require("../dist/serverless.js");

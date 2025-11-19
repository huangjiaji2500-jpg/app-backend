// Vercel serverless catch-all: forwards all /api/* requests to the Express app in backend/server.js
// This file allows deploying the existing Express app as a serverless function on Vercel.

const app = require('../backend/server');

// Export the Express app directly — Vercel's Node runtime supports exporting an Express app
module.exports = app;

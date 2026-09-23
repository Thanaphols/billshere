// Load .env before Next boots so PORT from .env is honored (Next binds the
// port before reading .env itself). Shell env still wins over .env.
try {
  process.loadEnvFile();
} catch {}
await import("next/dist/bin/next");

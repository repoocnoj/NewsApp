import { runLiveIngestion } from "../src/lib/ingest/runner";

(async () => {
  const result = await runLiveIngestion();
  console.log("[ingest]", result);
  process.exit(0);
})();

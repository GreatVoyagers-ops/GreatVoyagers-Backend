import config, { assertConfig } from "./config.js";
import { connectDb } from "./db.js";
import { createApp } from "./app.js";

assertConfig();
await connectDb(config.mongoUri);

createApp().listen(config.port, () => {
  console.log(`GreatVoyagers API running on http://localhost:${config.port}`);
});

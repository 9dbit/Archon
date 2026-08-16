import { createApp } from "./app";

const port = Number(process.env.API_PORT ?? 3001);
const app = createApp();

app.listen(port, "0.0.0.0", () => {
  console.log(`ARCHON API listening on :${port}`);
});

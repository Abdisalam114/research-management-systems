const dotenv = require("dotenv");
dotenv.config();

const { createApp } = require("./app");
const { connectDB } = require("./config/db");

async function start() {
  await connectDB(process.env.MONGO_URI);

  const app = createApp();
  const port = process.env.PORT || 5000;

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${port}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


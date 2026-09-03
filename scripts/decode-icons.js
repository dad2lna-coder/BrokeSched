const fs = require("fs");
const path = require("path");

const dir = path.resolve(__dirname, "../src-tauri/icons");
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".b64")) continue;
  const out = path.join(dir, name.slice(0, -4));
  const b64 = fs.readFileSync(path.join(dir, name), "utf8").trim();
  fs.writeFileSync(out, Buffer.from(b64, "base64"));
  console.log("wrote", path.basename(out));
}

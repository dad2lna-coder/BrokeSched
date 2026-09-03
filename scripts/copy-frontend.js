const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dest = path.join(root, "dist-frontend");

function rm(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copy(src, out) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(out, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copy(path.join(src, name), path.join(out, name));
    }
  } else {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(src, out);
  }
}

rm(dest);
fs.mkdirSync(dest, { recursive: true });

["index.html", "INSTRUCTIONS.md"].forEach((f) => {
  copy(path.join(root, f), path.join(dest, f));
});
["css", "js", "lib"].forEach((d) => {
  copy(path.join(root, d), path.join(dest, d));
});

console.log("Copied web assets to dist-frontend/");

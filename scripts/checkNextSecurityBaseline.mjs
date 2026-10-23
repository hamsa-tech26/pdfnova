import fs from "node:fs";
import assert from "node:assert/strict";

// Enforce the October 2026 Next.js security upgrade for RCE/DoS
// advisories. npm audit separately evaluates current and transitive risks.
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const specs = {
  next: pkg.dependencies?.next,
  "eslint-config-next": pkg.devDependencies?.["eslint-config-next"],
};
const exact = value => typeof value === "string" &&
  /^[0-9]+\.[0-9]+\.[0-9]+$/.test(value);
for (const [name, spec] of Object.entries(specs)) {
  assert.ok(exact(spec), name + " must remain an exact stable version");
  assert.equal(lock.packages?.[""]?.[
    name === "next" ? "dependencies" : "devDependencies"
  ]?.[name], spec, name + " manifest and lockfile root disagree");
  assert.equal(lock.packages?.["node_modules/" + name]?.version, spec,
    name + " installed version does not match the package-lock.json");
}
assert.equal(specs.next, specs["eslint-config-next"],
  "Next.js and eslint-config-next must stay version-aligned");
const [major, minor, patch] = specs.next.split(".").map(Number);
assert.ok(major > 16 || (major === 16 &&
  (minor > 4 || (minor === 4 && patch >= 2))),
  "Next.js is below patched 16.4.2 security baseline");
console.log("Next.js and eslint-config-next:", specs.next,
  "(aligned, pinned, patched minimum 16.4.2)");

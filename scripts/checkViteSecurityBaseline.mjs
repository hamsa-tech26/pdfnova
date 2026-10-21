import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const pkg=JSON.parse(readFileSync("package.json","utf8"));
const lock=JSON.parse(readFileSync("package-lock.json","utf8"));
const secure="8.2.4";
assert.equal(pkg.devDependencies?.vite,secure,
  "Vite must remain exactly pinned to security-patched 8.2.4.");
assert.equal(lock.packages?.[""]?.devDependencies?.vite,secure,
  "Root lockfile Vite pin differs from manifest.");
const resolved=lock.packages?.["node_modules/vite"];
assert.equal(resolved?.version,secure,"Installed Vite version is not patched.");
assert.equal(resolved?.resolved,"https://registry.npmjs.org/vite/-/vite-8.2.4.tgz");
assert.equal(resolved?.integrity,
  "sha512-lfauXnrf2x0p+UoA+wXh0dgFWnUjCyG6Js95KBkgaCwUU9k0DAHI4W6Q0WCx+h+5g+Alce1y4Zi2QjjK0UvGBw==",
  "Vite npm registry integrity is not the reviewed patched artifact.");
assert.equal(resolved.dev,true,"Vite must remain a development-only dependency.");
console.log("Vite security baseline: patched, exact-pinned 8.2.4 (development only).");

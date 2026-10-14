/* eslint-disable @typescript-eslint/no-require-imports -- The Next ESLint plugin consumes this shim through CommonJS. */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { globSync } = require("./index.cjs");

test("finds directories and excludes files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kukureku-glob-"));
  try {
    fs.mkdirSync(path.join(root, "app"));
    fs.mkdirSync(path.join(root, "other"));
    fs.writeFileSync(path.join(root, "plain.txt"), "test");
    assert.deepEqual(globSync("*", {cwd:root,onlyDirectories:true}).sort(), ["app","other"]);
    assert.deepEqual(globSync("app", {cwd:root,onlyDirectories:true}), ["app"]);
    assert.deepEqual(globSync("missing", {cwd:root,onlyDirectories:true}), []);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test("rejects unsupported operations and hostile nesting", () => {
  assert.throws(() => globSync("*"), /directory globbing/);
  assert.throws(() => globSync("*",{onlyDirectories:false}), /directory globbing/);
  assert.throws(() => globSync("{".repeat(33)+"a"+"}".repeat(33), {onlyDirectories:true}), /Nested/);
  assert.throws(() => globSync("x".repeat(4097), {onlyDirectories:true}), /bounded/);
});

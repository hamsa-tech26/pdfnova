/* eslint-disable @typescript-eslint/no-require-imports -- The Next ESLint plugin consumes this shim through CommonJS. */
"use strict";

// Constrained replacement for the single fast-glob API used by
// @next/eslint-plugin-next@16.3.8 (utils/get-root-dirs).
// Do NOT silently extend this to general globbing. Fail closed.
const fs = require("node:fs");
const path = require("node:path");

function globSync(pattern, options = {}) {
  if (typeof pattern !== "string" || pattern.length > 4096) {
    throw new TypeError("Expected a bounded directory glob pattern");
  }
  if (options == null || options.onlyDirectories !== true ||
      Object.keys(options).some(key => !["onlyDirectories", "cwd"].includes(key))) {
    throw new TypeError("Only directory globbing is supported");
  }
  const cwd = options.cwd == null ? process.cwd() : options.cwd;
  if (typeof cwd !== "string") throw new TypeError("Invalid glob cwd");

  // Deep nested brace patterns are unnecessary for locating Next.js roots.
  let depth = 0;
  for (const char of pattern) {
    if (char === "{") {
      if (++depth > 32) throw new RangeError("Nested glob braces exceed limit");
    } else if (char === "}") {
      depth = Math.max(0, depth - 1);
    }
  }

  return fs.globSync(pattern, { cwd }).filter(entry => {
    try {
      return fs.statSync(path.isAbsolute(entry) ? entry : path.resolve(cwd, entry)).isDirectory();
    } catch (error) {
      if (error && ["ENOENT", "ENOTDIR", "EACCES"].includes(error.code)) return false;
      throw error;
    }
  });
}
module.exports = { globSync };

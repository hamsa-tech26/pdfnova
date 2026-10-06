import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  HOST,
  ORIGIN,
  PUBLIC_ROUTES,
  TOOL_ROUTES,
} from "./indexNowRoutes.mjs";

function discoverIndexNowKey() {
  const publicDir = path.join(process.cwd(), "public");
  const candidates = readdirSync(publicDir)
    .filter((name) => /^[a-f0-9]{32}\.txt$/i.test(name))
    .filter((name) => {
      const expected = name.replace(/\.txt$/i, "");
      const actual = readFileSync(path.join(publicDir, name), "utf8").trim();
      return actual === expected;
    });

  if (candidates.length !== 1) {
    throw new Error(
      `Expected exactly one valid IndexNow key file, found ${candidates.length}.`,
    );
  }

  return candidates[0].replace(/\.txt$/i, "");
}

function allUrls() {
  return PUBLIC_ROUTES.map((route) =>
    route === "/" ? `${ORIGIN}/` : `${ORIGIN}${route}`,
  );
}

function changedFiles(beforeSha, afterSha) {
  if (!beforeSha || /^0+$/.test(beforeSha) || !afterSha) {
    return [];
  }

  return execFileSync(
    "git",
    ["diff", "--name-only", beforeSha, afterSha],
    { encoding: "utf8" },
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function routesForFile(file) {
  const routes = new Set();

  if (
    file === "app/layout.tsx" ||
    file === "lib/site.ts" ||
    file === "app/sitemap.ts" ||
    file === "app/robots.ts" ||
    file === "scripts/indexNowRoutes.mjs" ||
    file === "scripts/submitIndexNowSafe.mjs" ||
    file === ".github/workflows/indexnow.yml" ||
    file.startsWith("app/opengraph-image") ||
    file.startsWith("public/brand/")
  ) {
    PUBLIC_ROUTES.forEach((route) => routes.add(route));
  }

  if (file === "app/page.tsx") routes.add("/");
  if (file === "app/about/page.tsx") routes.add("/about");
  if (file === "app/press/page.tsx") routes.add("/press");
  if (file === "app/trust/page.tsx") routes.add("/trust");
  if (file === "app/trust/verification/page.tsx") routes.add("/trust/verification");
  if (file === "app/guides/page.tsx") routes.add("/guides");
  if (file === "app/privacy/page.tsx") routes.add("/privacy");
  if (file === "app/terms/page.tsx") routes.add("/terms");

  if (file.startsWith("app/guides/")) {
    const guideRoute = "/" + file.replace(/\/page\.tsx$/, "");
    if (PUBLIC_ROUTES.includes(guideRoute)) {
      routes.add(guideRoute);
      routes.add("/guides");
    }
  }

  for (const route of TOOL_ROUTES) {
    const slug = route.slice(1);
    if (file.startsWith(`app/(workspace)/${slug}/`)) {
      routes.add(route);
    }
  }

  if (
    file === "components/pdf/ToolLayout.tsx" ||
    file === "components/seo/ToolSeoLayout.tsx" ||
    file === "lib/seo/tools.ts"
  ) {
    TOOL_ROUTES.forEach((route) => routes.add(route));
  }

  return routes;
}

function urlsForPush() {
  if (process.env.INDEXNOW_FULL === "1") {
    return allUrls();
  }

  const beforeSha = process.env.INDEXNOW_BEFORE_SHA;
  const afterSha = process.env.INDEXNOW_AFTER_SHA || "HEAD";
  const files = changedFiles(beforeSha, afterSha);

  const routes = new Set();
  for (const file of files) {
    for (const route of routesForFile(file)) {
      routes.add(route);
    }
  }

  return [...routes].map((route) =>
    route === "/" ? `${ORIGIN}/` : `${ORIGIN}${route}`,
  );
}

async function submit(urlList) {
  if (urlList.length === 0) {
    console.log("IndexNow: no search-facing URLs changed; nothing to submit.");
    return;
  }

  const key = discoverIndexNowKey();
  const keyLocation = `${ORIGIN}/${key}.txt`;

  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      host: HOST,
      key,
      keyLocation,
      urlList,
    }),
  });

  if (![200, 202].includes(response.status)) {
    const body = await response.text();
    throw new Error(
      `IndexNow submission failed: ${response.status} ${body}`,
    );
  }

  console.log(
    `IndexNow accepted ${urlList.length} URL(s) with status ${response.status}.`,
  );
}

await submit(urlsForPush());

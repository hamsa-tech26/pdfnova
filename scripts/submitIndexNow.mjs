import { execFileSync } from "node:child_process";

const ORIGIN = "https://kukureku.com";
const HOST = "kukureku.com";
const KEY = "0747c1e68411804665f849f2b4cf2492";
const KEY_LOCATION = `${ORIGIN}/${KEY}.txt`;

const PUBLIC_ROUTES = [
  "/",
  "/merge-pdf",
  "/split-pdf",
  "/compress-pdf",
  "/pdf-to-word",
  "/word-to-pdf",
  "/jpg-to-pdf",
  "/pdf-to-jpg",
  "/organize-pdf",
  "/watermark-pdf",
  "/unlock-pdf",
  "/about",
  "/press",
  "/trust",
  "/trust/verification",
  "/guides",
  "/guides/private-pdf-tools",
  "/guides/compress-pdf-without-uploading",
  "/guides/watermark-pdf-without-uploading",
  "/guides/word-to-pdf-without-uploading",
  "/privacy",
  "/terms",
];

const TOOL_ROUTES = PUBLIC_ROUTES.filter(
  (route) =>
    route !== "/" &&
    route !== "/about" &&
    route !== "/press" &&
    route !== "/trust" &&
    route !== "/trust/verification" &&
    route !== "/guides" &&
    !route.startsWith("/guides/") &&
    route !== "/privacy" &&
    route !== "/terms",
);

function allUrls() {
  return PUBLIC_ROUTES.map((route) =>
    route === "/" ? `${ORIGIN}/` : `${ORIGIN}${route}`,
  );
}

function changedFiles(beforeSha, afterSha) {
  if (
    !beforeSha ||
    /^0+$/.test(beforeSha) ||
    !afterSha
  ) {
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
    file === "scripts/submitIndexNow.mjs" ||
    file === ".github/workflows/indexnow.yml" ||
    file === `public/${KEY}.txt` ||
    file.startsWith("app/opengraph-image") ||
    file.startsWith("public/brand/")
  ) {
    PUBLIC_ROUTES.forEach((route) => routes.add(route));
  }

  if (file === "app/page.tsx") {
    routes.add("/");
  }

  if (file === "app/about/page.tsx") {
    routes.add("/about");
  }

  if (file === "app/press/page.tsx") {
    routes.add("/press");
  }

  if (file === "app/trust/page.tsx") {
    routes.add("/trust");
  }

  if (file === "app/trust/verification/page.tsx") {
    routes.add("/trust/verification");
  }

  if (file === "app/guides/page.tsx") {
    routes.add("/guides");
  }

  if (file.startsWith("app/guides/")) {
    const guideRoute = "/" + file.replace(/\/page\.tsx$/, "");
    if (PUBLIC_ROUTES.includes(guideRoute)) {
      routes.add(guideRoute);
      routes.add("/guides");
    }
  }

  if (file === "app/privacy/page.tsx") {
    routes.add("/privacy");
  }

  if (file === "app/terms/page.tsx") {
    routes.add("/terms");
  }

  for (const route of TOOL_ROUTES) {
    const slug = route.slice(1);
    if (
      file.startsWith(`app/(workspace)/${slug}/`)
    ) {
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

  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: KEY_LOCATION,
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

  for (const url of urlList) {
    console.log(`- ${url}`);
  }
}

await submit(urlsForPush());

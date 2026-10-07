import fs from "node:fs";
import path from "node:path";
import { TOOL_ROUTES } from "./indexNowRoutes.mjs";

const ROOT = process.cwd();
const WORKSPACE = path.join(ROOT, "app", "(workspace)");
const INTERNAL_ROUTES = new Set([
  "dashboard",
  "dev-layout",
  "engine-inspector",
  "document-inspector",
  "compare-documents",
  "magic-drop",
  "workflow-recipes",
]);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function sorted(values) {
  return [...new Set(values)].sort();
}

function toolRoutesFromWorkspace() {
  return sorted(
    fs
      .readdirSync(WORKSPACE, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !INTERNAL_ROUTES.has(name))
      .filter((name) =>
        fs.existsSync(path.join(WORKSPACE, name, "page.tsx")),
      )
      .map((name) => `/${name}`),
  );
}

function seoRoutes() {
  const source = read("lib/seo/tools.ts");

  return sorted(
    [...source.matchAll(/^\s+"?([a-z0-9-]+)"?:\s+\{/gm)]
      .map((match) => `/${match[1]}`)
      .filter((route) => route.includes("-")),
  );
}

function hrefRoutes(relativePath) {
  const source = read(relativePath);

  return sorted(
    [...source.matchAll(/href:\s*"\/([a-z0-9-]+)"/g)]
      .map((match) => `/${match[1]}`)
      .filter((route) => !INTERNAL_ROUTES.has(route.slice(1))),
  );
}

function sitemapRoutes() {
  const source = read("app/sitemap.ts");

  return sorted(
    [...source.matchAll(/"\/([a-z0-9-]+)"/g)]
      .map((match) => `/${match[1]}`)
      .filter((route) => TOOL_ROUTES.includes(route)),
  );
}

function assertSame(label, expected, actual) {
  const missing = expected.filter((value) => !actual.includes(value));
  const extra = actual.filter((value) => !expected.includes(value));

  if (missing.length || extra.length) {
    throw new Error(
      [
        `${label} does not match the live tool routes.`,
        missing.length ? `Missing: ${missing.join(", ")}` : "",
        extra.length ? `Extra: ${extra.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

function assertToolLayouts(routes) {
  for (const route of routes) {
    const slug = route.slice(1);
    const layoutPath = path.join(WORKSPACE, slug, "layout.tsx");

    if (!fs.existsSync(layoutPath)) {
      throw new Error(`Missing layout.tsx for ${route}.`);
    }

    const layout = fs.readFileSync(layoutPath, "utf8");
    const metadataPattern = new RegExp(
      `buildToolMetadata\\(\\s*["']${slug}["']\\s*,?\\s*\\)`,
    );

    if (!metadataPattern.test(layout)) {
      throw new Error(
        `${route} layout does not call buildToolMetadata("${slug}").`,
      );
    }
  }
}

function assertHomepageCount(expectedCount) {
  const homepage = read("app/page.tsx");
  const match = homepage.match(/(\d+) working tools/);

  if (!match) {
    throw new Error(
      'Homepage is missing the "<number> working tools" label.',
    );
  }

  const displayedCount = Number(match[1]);

  if (displayedCount !== expectedCount) {
    throw new Error(
      `Homepage says ${displayedCount} working tools, but ${expectedCount} live tool routes exist.`,
    );
  }
}

const liveRoutes = toolRoutesFromWorkspace();
const indexNowRoutes = sorted(TOOL_ROUTES);

const registries = [
  ["SEO registry", seoRoutes()],
  ["Homepage tool cards", hrefRoutes("components/ToolsSection.tsx")],
  ["Dashboard tool cards", hrefRoutes("app/(workspace)/dashboard/page.tsx")],
  ["Sitemap", sitemapRoutes()],
  ["IndexNow route registry", indexNowRoutes],
];

for (const [label, routes] of registries) {
  assertSame(label, liveRoutes, routes);
}

assertToolLayouts(liveRoutes);
assertHomepageCount(liveRoutes.length);

console.log(
  `Tool registry check passed: ${liveRoutes.length} live tools are synchronized across routes, SEO, homepage, dashboard, sitemap, and IndexNow.`,
);

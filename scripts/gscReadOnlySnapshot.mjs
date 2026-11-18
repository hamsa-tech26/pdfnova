/**
 * Owner-only Google Search Console evidence collector.
 *
 * Google OAuth is deliberately NOT implemented here: the owner must separately
 * authorize the narrow webmasters.readonly scope and supply a short-lived token
 * through GSC_ACCESS_TOKEN in their own environment. Never put tokens in git,
 * a website bundle, a query string, or a ChatGPT message.
 *
 * Usage after authorized access exists:
 *   GSC_ACCESS_TOKEN=... node scripts/gscReadOnlySnapshot.mjs
 *   GSC_ACCESS_TOKEN=... node scripts/gscReadOnlySnapshot.mjs --compare .local/gsc/older.json
 *
 * No Google credentials means NOT_CONNECTED and zero outgoing requests.
 * The two POST endpoints below read data; they do not submit indexing requests.
 */

import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

export const GSC_PROPERTY = "https://kukureku.com/";
export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const PRIORITY_URLS = [
  "https://kukureku.com/merge-pdf",
  "https://kukureku.com/compress-pdf",
  "https://kukureku.com/pdf-to-word",
];

const SEARCH_ANALYTICS_URL =
  `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_PROPERTY)}/searchAnalytics/query`;
const URL_INSPECTION_URL =
  "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const PRIVATE_REPORT_DIR = path.join(process.cwd(), ".local", "gsc");

function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function dateString(date) {
  return date.toISOString().slice(0, 10);
}

function requireDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    dateString(new Date(value + "T00:00:00Z")) !== value) {
    throw fail("INVALID_DATE");
  }
  return value;
}

export function finalizedDateWindow(now = new Date()) {
  // Use a conservative lag. Google interprets the dates in Pacific Time,
  // and only finalized rows are requested, never its preliminary 24h data.
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw fail("INVALID_CLOCK");
  }
  const end = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3,
  ));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 27);
  return {startDate: dateString(start), endDate: dateString(end)};
}

function validateWindow(window) {
  const startDate = requireDate(window.startDate);
  const endDate = requireDate(window.endDate);
  if (endDate < startDate ||
    (Date.parse(endDate) - Date.parse(startDate)) / 86400000 > 93) {
    throw fail("INVALID_DATE_RANGE");
  }
  return {startDate, endDate};
}

function safeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw fail("INVALID_METRIC");
  return number;
}

export function summarizeDailyAnalytics(response) {
  const rows = response?.rows ?? [];
  if (!Array.isArray(rows)) throw fail("INVALID_SEARCH_ANALYTICS_RESPONSE");

  let clicks = 0;
  let impressions = 0;
  let positionWeighted = 0;
  const dates = new Set();
  for (const row of rows) {
    const day = row?.keys?.[0];
    requireDate(day);
    if (dates.has(day)) throw fail("DUPLICATE_DATE_ROW");
    dates.add(day);
    const rowClicks = safeNumber(row.clicks);
    const rowImpressions = safeNumber(row.impressions);
    const position = safeNumber(row.position);
    if (rowClicks > rowImpressions) throw fail("INVALID_METRIC");
    clicks += rowClicks;
    impressions += rowImpressions;
    positionWeighted += position * rowImpressions;
  }

  return {
    returnedDays: dates.size,
    // No rows does not prove zero search activity or lack of indexing.
    dataAvailability: dates.size ? "ROWS_RETURNED" : "NO_ROWS_RETURNED",
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : null,
    averagePosition: impressions ? positionWeighted / impressions : null,
  };
}

export function summarizeIndexInspection(response) {
  const result = response?.inspectionResult?.indexStatusResult;
  if (!result || typeof result !== "object") {
    return {state: "NOT_VERIFIED", verdict: null, coverageState: null,
      lastCrawlTime: null, pageFetchState: null, indexingState: null};
  }
  const field = name => typeof result[name] === "string" ? result[name] : null;
  return {
    state: "REPORTED_BY_GOOGLE_INDEX_API",
    verdict: field("verdict"),
    coverageState: field("coverageState"),
    lastCrawlTime: field("lastCrawlTime"),
    pageFetchState: field("pageFetchState"),
    indexingState: field("indexingState"),
  };
}

async function postReadOnlyJson(url, body, {accessToken, fetchImpl}) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    // Do not print request headers or an error containing authorization data.
    throw fail("GOOGLE_REQUEST_UNAVAILABLE");
  }

  if (response.status === 401 || response.status === 403) {
    throw fail("GOOGLE_ACCESS_DENIED_OR_EXPIRED");
  }
  if (response.status === 429) throw fail("GOOGLE_QUOTA_EXCEEDED");
  if (!response.ok) throw fail(`GOOGLE_HTTP_${response.status}`);
  try {
    return await response.json();
  } catch {
    throw fail("GOOGLE_RESPONSE_NOT_JSON");
  }
}

function dailyQuery(window, page) {
  return {
    ...window,
    type: "web",
    dataState: "final",
    dimensions: ["date"],
    rowLimit: 100,
    ...(page ? {
      dimensionFilterGroups: [{
        groupType: "and",
        filters: [{dimension: "page", operator: "equals", expression: page}],
      }],
    } : {}),
  };
}

export async function collectGscSnapshot({
  accessToken,
  fetchImpl = fetch,
  now = new Date(),
  window = finalizedDateWindow(now),
} = {}) {
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw fail("GSC_NOT_CONNECTED");
  }
  const dates = validateWindow(window);

  const siteAnalytics = summarizeDailyAnalytics(await postReadOnlyJson(
    SEARCH_ANALYTICS_URL, dailyQuery(dates), {accessToken, fetchImpl},
  ));
  const priority = [];
  // Serial, bounded requests: four Search Analytics and three index inspections.
  for (const url of PRIORITY_URLS) {
    const analytics = summarizeDailyAnalytics(await postReadOnlyJson(
      SEARCH_ANALYTICS_URL, dailyQuery(dates, url), {accessToken, fetchImpl},
    ));
    const inspection = summarizeIndexInspection(await postReadOnlyJson(
      URL_INSPECTION_URL,
      {inspectionUrl: url, siteUrl: GSC_PROPERTY, languageCode: "en-US"},
      {accessToken, fetchImpl},
    ));
    priority.push({url, analytics, inspection});
  }

  return {
    schemaVersion: 1,
    status: "AUTHENTICATED_GOOGLE_API_SNAPSHOT",
    source: "GOOGLE_SEARCH_CONSOLE_API_READONLY",
    collectedAt: now.toISOString(),
    property: GSC_PROPERTY,
    dateRange: dates,
    dateTimezone: "America/Los_Angeles (Google Search Analytics)",
    limitations: [
      "URL Inspection API reports the Google indexed-version status, not a live Googlebot test.",
      "No Search Analytics rows does not prove zero traffic or that a URL is not indexed.",
      "Search Analytics data can omit data and rows; its results are not a full Page Indexing report.",
      "Site-wide indexed and excluded URL counts are not available from these two API methods.",
    ],
    siteAnalytics,
    priority,
  };
}

function sameUrlSet(snapshot) {
  return Array.isArray(snapshot?.priority) && snapshot.priority.length === PRIORITY_URLS.length &&
    PRIORITY_URLS.every(url => snapshot.priority.some(page => page.url === url));
}

export function compareGscSnapshots(previous, current) {
  if (previous?.schemaVersion !== 1 || current?.schemaVersion !== 1 ||
      previous?.property !== GSC_PROPERTY || current?.property !== GSC_PROPERTY ||
      !sameUrlSet(previous) || !sameUrlSet(current)) {
    throw fail("INCOMPATIBLE_SNAPSHOT");
  }
  const days = snapshot => (Date.parse(snapshot.dateRange.endDate) -
    Date.parse(snapshot.dateRange.startDate)) / 86400000 + 1;
  const currentDays = days(current);
  if (!Number.isFinite(currentDays) || currentDays < 1 ||
      currentDays !== days(previous)) throw fail("INCOMPARABLE_DATE_WINDOWS");

  const indexedChanges = current.priority.map(page => {
    const older = previous.priority.find(item => item.url === page.url);
    return {url: page.url,
      oldVerdict: older.inspection?.verdict ?? null,
      newVerdict: page.inspection?.verdict ?? null,
      changed: older.inspection?.verdict !== page.inspection?.verdict,
      clicksDelta: page.analytics.clicks - older.analytics.clicks,
      impressionsDelta: page.analytics.impressions - older.analytics.impressions,
    };
  });

  return {
    previousWindow: previous.dateRange,
    currentWindow: current.dateRange,
    comparableDays: currentDays,
    siteClicksDelta: current.siteAnalytics.clicks - previous.siteAnalytics.clicks,
    siteImpressionsDelta: current.siteAnalytics.impressions - previous.siteAnalytics.impressions,
    priorityChanges: indexedChanges,
    warning: "These are changes in API-returned data, not proof of index causation or complete Google traffic.",
  };
}

async function main(args = process.argv.slice(2)) {
  const token = process.env.GSC_ACCESS_TOKEN;
  if (!token) {
    console.log(JSON.stringify({
      result: "NOT_CONNECTED",
      property: GSC_PROPERTY,
      requiredScope: GSC_SCOPE,
      instructions: "Authorize Google Search Console read-only OAuth outside chat; do not share access tokens here.",
      requestsMade: 0,
    }, null, 2));
    process.exitCode = 2;
    return;
  }

  if (args.length && (args.length !== 2 || args[0] !== "--compare")) {
    throw fail("USAGE_EXPECTED_OPTIONAL_COMPARE_PATH");
  }
  const snapshot = await collectGscSnapshot({accessToken: token});
  let comparison;
  if (args.length) {
    const previous = JSON.parse(await readFile(path.resolve(args[1]), "utf8"));
    comparison = compareGscSnapshots(previous, snapshot);
  }

  await mkdir(PRIVATE_REPORT_DIR, {recursive: true, mode: 0o700});
  const output = path.join(PRIVATE_REPORT_DIR, `snapshot-${snapshot.collectedAt.slice(0, 10)}.json`);
  await writeFile(output, JSON.stringify(snapshot, null, 2) + "\n", {mode: 0o600});
  console.log(JSON.stringify({result: "SNAPSHOT_SAVED_LOCALLY", path: output,
    comparison: comparison ?? null, warning: "Private Search Console metrics are never committed or published."}, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Deliberately do not echo thrown messages or API response bodies.
    console.error(JSON.stringify({result: "FAILED_SAFELY", code: error.code ?? "UNEXPECTED_FAILURE"}));
    process.exitCode = 2;
  });
}

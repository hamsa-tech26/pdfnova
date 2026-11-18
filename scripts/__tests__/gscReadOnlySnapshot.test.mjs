import {describe, expect, it} from "vitest";
import {readFileSync} from "node:fs";
import {
  collectGscSnapshot,
  compareGscSnapshots,
  finalizedDateWindow,
  GSC_PROPERTY,
  GSC_SCOPE,
  PRIORITY_URLS,
  summarizeDailyAnalytics,
  summarizeIndexInspection,
} from "../gscReadOnlySnapshot.mjs";

const fixedNow = new Date("2026-11-06T10:00:00.000Z");

function fetchMock({status = 200, noRows = false} = {}) {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({url, options, body: JSON.parse(options.body)});
    const response = url.includes("searchAnalytics") ?
      (noRows ? {} : {rows: [{keys: ["2026-10-27"], clicks: 3,
        impressions: 20, ctr: 0.15, position: 4}]}) :
      {inspectionResult: {indexStatusResult: {verdict: "NEUTRAL",
        coverageState: "Discovered - currently not indexed",
        lastCrawlTime: "2026-10-23T00:00:00Z", pageFetchState: "SUCCESSFUL",
        indexingState: "INDEXING_ALLOWED", robotsTxtState: "ALLOWED"}}};
    return {ok: status === 200, status, json: async () => response};
  };
  return {requests, fetchImpl};
}

describe("owner-only GSC evidence collector", () => {
  it("uses a conservative 28-day finalized window and fixed read-only OAuth scope", () => {
    expect(finalizedDateWindow(fixedNow)).toEqual({
      startDate: "2026-10-07", endDate: "2026-11-03",
    });
    expect(GSC_SCOPE).toBe("https://www.googleapis.com/auth/webmasters.readonly");
    expect(PRIORITY_URLS).toEqual([
      "https://kukureku.com/merge-pdf",
      "https://kukureku.com/compress-pdf",
      "https://kukureku.com/pdf-to-word",
    ]);
    expect(() => finalizedDateWindow(new Date("invalid"))).toThrow("INVALID_CLOCK");
  });

  it("never makes a network call if Google authentication is missing", async () => {
    const {requests, fetchImpl} = fetchMock();
    await expect(collectGscSnapshot({fetchImpl, now: fixedNow}))
      .rejects.toThrow("GSC_NOT_CONNECTED");
    expect(requests).toHaveLength(0);
  });

  it("only submits seven read-only data queries with a bounded token scope", async () => {
    const {requests, fetchImpl} = fetchMock();
    const accessToken = "test-secret-not-in-output";
    const snapshot = await collectGscSnapshot({fetchImpl, accessToken, now: fixedNow});
    expect(requests).toHaveLength(7);
    expect(snapshot.source).toBe("GOOGLE_SEARCH_CONSOLE_API_READONLY");
    expect(snapshot.property).toBe(GSC_PROPERTY);
    expect(snapshot.siteAnalytics.impressions).toBe(20);
    expect(snapshot.priority).toHaveLength(3);
    expect(JSON.stringify(snapshot)).not.toContain(accessToken);
    expect(JSON.stringify(snapshot)).not.toContain("robotsTxtState");

    const analyticsQueries = requests.filter(req => req.url.includes("searchAnalytics"));
    const inspections = requests.filter(req => req.url.includes("urlInspection"));
    expect(analyticsQueries).toHaveLength(4);
    expect(inspections).toHaveLength(3);
    expect(analyticsQueries[0].body).toMatchObject({
      startDate: "2026-10-07", endDate: "2026-11-03",
      dimensions: ["date"], type: "web", dataState: "final",
    });
    expect(analyticsQueries[0].body).not.toHaveProperty("dimensionFilterGroups");
    for (let i = 0; i < PRIORITY_URLS.length; i++) {
      expect(analyticsQueries[i + 1].body.dimensionFilterGroups[0].filters)
        .toEqual([{dimension: "page", operator: "equals", expression: PRIORITY_URLS[i]}]);
      expect(inspections[i].body).toMatchObject({
        siteUrl: GSC_PROPERTY, inspectionUrl: PRIORITY_URLS[i],
      });
    }
    for (const req of requests) {
      expect(req.url).toMatch(/^https:\/\/(www\.googleapis\.com\/webmasters\/v3\/sites\/|searchconsole\.googleapis\.com\/v1\/urlInspection\/)/);
      expect(req.url).not.toContain(accessToken);
      expect(req.options.method).toBe("POST");
      expect(req.options.redirect).toBe("error");
      expect(req.options.headers.authorization).toBe(`Bearer ${accessToken}`);
      expect(req.options.headers).not.toHaveProperty("cookie");
    }
  });

  it("treats missing rows as unknown rather than zero traffic/indexed URLs", async () => {
    const {fetchImpl} = fetchMock({noRows: true});
    const snapshot = await collectGscSnapshot({fetchImpl, accessToken: "test", now: fixedNow});
    expect(snapshot.siteAnalytics).toMatchObject({
      dataAvailability: "NO_ROWS_RETURNED", clicks: 0,
      impressions: 0, ctr: null, averagePosition: null,
    });
    expect(snapshot.priority[0].inspection).toMatchObject({
      state: "REPORTED_BY_GOOGLE_INDEX_API", verdict: "NEUTRAL",
      coverageState: "Discovered - currently not indexed",
    });
    expect(snapshot.limitations.join(" ")).toContain("not a full Page Indexing report");
  });

  it("calculates aggregate CTR and impression-weighted position correctly", () => {
    const summary = summarizeDailyAnalytics({rows: [
      {keys: ["2026-10-28"], clicks: 1, impressions: 10, position: 2},
      {keys: ["2026-10-29"], clicks: 2, impressions: 30, position: 6},
    ]});
    expect(summary).toEqual({returnedDays: 2, dataAvailability: "ROWS_RETURNED",
      clicks: 3, impressions: 40, ctr: 0.075, averagePosition: 5});
    expect(() => summarizeDailyAnalytics({rows: [{keys: ["not-date"]}]}))
      .toThrow("INVALID_DATE");
    expect(() => summarizeDailyAnalytics({rows: [
      {keys: ["2026-10-28"], clicks: 1, impressions: 2, position: 1},
      {keys: ["2026-10-28"], clicks: 1, impressions: 2, position: 1},
    ]})).toThrow("DUPLICATE_DATE_ROW");
    expect(summarizeIndexInspection({})).toMatchObject({state: "NOT_VERIFIED"});
  });

  it.each([
    [401, "GOOGLE_ACCESS_DENIED_OR_EXPIRED"],
    [403, "GOOGLE_ACCESS_DENIED_OR_EXPIRED"],
    [429, "GOOGLE_QUOTA_EXCEEDED"],
    [500, "GOOGLE_HTTP_500"],
  ])("sanitizes Google HTTP %i errors as %s", async (status, code) => {
    const {fetchImpl} = fetchMock({status});
    await expect(collectGscSnapshot({fetchImpl, accessToken: "sensitive-test", now: fixedNow}))
      .rejects.toThrow(code);
  });

  it("rejects invalid time windows before sending a Google request", async () => {
    const {requests, fetchImpl} = fetchMock();
    await expect(collectGscSnapshot({fetchImpl, accessToken: "test", now: fixedNow,
      window: {startDate: "2026-11-04", endDate: "2026-10-07"}}))
      .rejects.toThrow("INVALID_DATE_RANGE");
    expect(requests).toHaveLength(0);
  });

  it("compares equal-length evidence and rejects mismatched properties or windows", async () => {
    const {fetchImpl} = fetchMock();
    const old = await collectGscSnapshot({fetchImpl, accessToken: "test", now: fixedNow});
    const current = structuredClone(old);
    current.dateRange = {startDate: "2026-10-14", endDate: "2026-11-10"};
    current.siteAnalytics.clicks += 7;
    current.siteAnalytics.impressions += 18;
    current.priority[0].analytics.clicks += 2;
    current.priority[0].inspection.verdict = "PASS";
    const comparison = compareGscSnapshots(old, current);
    expect(comparison.comparableDays).toBe(28);
    expect(comparison.siteClicksDelta).toBe(7);
    expect(comparison.priorityChanges[0]).toMatchObject({
      changed: true, oldVerdict: "NEUTRAL", newVerdict: "PASS", clicksDelta: 2,
    });
    expect(comparison.warning).toContain("not proof of index causation");
    expect(() => compareGscSnapshots(old, {...current, property: "https://example.com/"}))
      .toThrow("INCOMPATIBLE_SNAPSHOT");
    expect(() => compareGscSnapshots(old, {...current,
      dateRange: {startDate: "2026-10-15", endDate: "2026-11-10"}}))
      .toThrow("INCOMPARABLE_DATE_WINDOWS");
  });

  it("keeps collected Google data out of Git", () => {
    const ignore = readFileSync(new URL("../../.gitignore", import.meta.url), "utf8");
    expect(ignore).toContain("/.local/gsc/");
  });
});

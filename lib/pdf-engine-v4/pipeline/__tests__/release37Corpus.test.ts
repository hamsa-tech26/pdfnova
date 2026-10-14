import {describe,it,expect} from "vitest";
import {validateRelease37Entry,buildRelease37CorpusReport} from "../../../../scripts/collectRelease37Corpus.mjs";

const entry=()=>({
 id:"usgs-001",origin:"real-world",usageRights:"public-domain",rightsUrl:"https://pubs.usgs.gov/documentation/faq",
 sourceUrl:"https://pubs.usgs.gov/sir/2024/5103/sir20245103.pdf",rightsConfirmed:true,
 categories:["native","complex"],sha256:"a".repeat(64),independentReferenceReview:true,
 reviewedBy:"Independent QA reviewer",reviewedAt:"2026-10-08",
 localPdf:"benchmarks/release37/private/usgs.pdf",
 referenceJson:"benchmarks/release37/private/usgs-gold.json",
 inspectorJson:"benchmarks/release37/private/usgs-actual.json",
});
const measured=()=>({
 id:"usgs-001",usageRights:"public-domain",rightsUrl:"https://pubs.usgs.gov/documentation/faq",
 sourceUrl:"https://pubs.usgs.gov/sir/2024/5103/sir20245103.pdf",
 categories:["native","complex"],independentReferenceReview:true,pdfSha:"a".repeat(64),
 goldSha:"b".repeat(64),outputSha:"c".repeat(64),
 score:{
   cells:{correct:4,total:5,pct:80},rows:{correct:2,total:3,pct:66.7},
   structure:{correct:4,total:6,pct:66.7},actualOcrAttempted:false,ocrLanguages:[],
 },
});
describe("Release 37 rights-checked local-only real corpus intake",()=>{
 it("accepts a reviewed public-domain source with local private files",()=>{
  expect(validateRelease37Entry(entry())).toEqual([]);
 });
 it("rejects public availability as a substitute for confirmed rights",()=>{
  const x=entry();x.rightsConfirmed=false;
  expect(validateRelease37Entry(x)).toContain("human rights clearance missing");
 });
 it("rejects artificial labels as real-world document entries",()=>{
  const x=entry();x.origin="synthetic";
  expect(validateRelease37Entry(x)).toContain("not a real-world document");
 });
 it("never converts missing evidence for other categories to a passing score",()=>{
  const r=buildRelease37CorpusReport([measured()]);
  expect(r.metrics.native.status).toBe("MEASURED");
  expect(r.metrics.native.cellPct).toBe(80);
  expect(r.metrics.bengali.status).toBe("NOT_VERIFIED");
  expect(r.metrics.scanned.actualOcrAttempted).toBe(false);
 });
 it("cannot certify scanned Hindi by scoring native English text",()=>{
  const record=measured();record.categories=["hindi"];
  const report=buildRelease37CorpusReport([record]);
  expect(report.metrics.hindi.actualOcrAttempted).toBe(false);
 });
 it("fails closed for an entirely empty corpus",()=>{
  const r=buildRelease37CorpusReport([]);
  expect(r.corpus.documents).toHaveLength(0);
  expect(r.metrics.native.status).toBe("NOT_VERIFIED");
 });
});

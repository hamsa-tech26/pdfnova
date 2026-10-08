import type { PackageGuardPolicy, PackageGuardReport } from "../document-engine/package-guard/types";

const POLICY_KEY = "kukureku-package-guard-policy-v1";
const REPORT_KEY = "kukureku-package-guard-report-v1";

export function loadPackageGuardPolicy(): PackageGuardPolicy | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(POLICY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PackageGuardPolicy;
    return parsed.schemaVersion === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function savePackageGuardPolicy(policy: PackageGuardPolicy) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(POLICY_KEY, JSON.stringify(policy));
}

export function loadPackageGuardReport(): PackageGuardReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REPORT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PackageGuardReport;
    return parsed.schemaVersion === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function savePackageGuardReport(report: PackageGuardReport) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REPORT_KEY, JSON.stringify(report));
}

export function clearPackageGuardReport() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(REPORT_KEY);
}
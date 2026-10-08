export type WorkspaceIntelligencePrivacyPolicy = {
  mode:
    "local-evidence";
  cloudAiEnabled: false;
  documentUploadEnabled: false;
  explicitOptInRequiredForCloudAi: true;
  provider:
    "none";
  notes: string[];
};

export const DEFAULT_WORKSPACE_INTELLIGENCE_PRIVACY_POLICY: WorkspaceIntelligencePrivacyPolicy =
  {
    mode:
      "local-evidence",
    cloudAiEnabled:
      false,
    documentUploadEnabled:
      false,
    explicitOptInRequiredForCloudAi:
      true,
    provider: "none",
    notes: [
      "Workspace evidence extraction, indexing, fact detection, contradiction checks, and answer retrieval run in the browser.",
      "No cloud AI provider is configured for this release.",
      "A future cloud semantic layer must require explicit opt-in and disclose exactly what extracted content would leave the browser.",
    ],
  };

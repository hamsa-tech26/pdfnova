import type {
  DocumentFeature,
  KukurekuOperationId,
} from "../operations/types";

export type MagicDropRecommendationKind =
  | "RECOMMENDED"
  | "OPTIONAL"
  | "BLOCKED";

export type MagicDropEffectPreview = {
  mode: string;
  description: string;
  preserves: DocumentFeature[];
  modifies: DocumentFeature[];
  destroys: DocumentFeature[];
  risks: string[];
};

export type MagicDropRecommendation = {
  id: string;
  kind: MagicDropRecommendationKind;
  title: string;
  route?: string;
  operationId?: KukurekuOperationId;
  reason: string;
  evidence: string[];
  effect?: MagicDropEffectPreview;
};

export type MagicDropCaution = {
  id: string;
  title: string;
  description: string;
};

export type MagicDropPlan = {
  headline: string;
  summary: string;
  recommendations: MagicDropRecommendation[];
  cautions: MagicDropCaution[];
  findingCount: number;
  checkedCapabilityCount: number;
  unknownCapabilityCount: number;
};

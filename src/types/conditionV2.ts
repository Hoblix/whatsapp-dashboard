// Frontend-side types for v2 condition builder

export interface FlowFieldEntry {
  field_key: string;
  label: string;
  type: string;
  values: string[];
  screen_id: string;
}

export interface ConditionV2Entry {
  field_key: string;
  operator: "eq" | "neq";
  value: string;
}

export interface ConditionV2Config {
  version: 2;
  schema_version: string;
  flow_id: string;
  logic: "and" | "or";
  conditions: ConditionV2Entry[];
}

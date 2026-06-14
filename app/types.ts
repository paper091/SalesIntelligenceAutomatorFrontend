// Mirrors the backend's SalesBrief / LeadResult Pydantic models, so keep
// these in sync with app/models/schemas.py in the backend repo.
export interface SalesBrief {
  company_overview: string;
  core_product_or_service: string;
  target_customer: string;
  b2b_qualified: boolean;
  b2b_reasoning: string;
  sales_questions: string[];
  confidence: "low" | "medium" | "high";
  evidence_note?: string | null;
}

export interface LeadInput {
  raw: string;
  name?: string | null;
  url?: string | null;
  location_hint?: string | null;
}

export interface LeadResult {
  id: string;
  input: LeadInput;
  status: "pending" | "processing" | "done" | "failed";
  resolved_url?: string | null;
  brief?: SalesBrief | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
}

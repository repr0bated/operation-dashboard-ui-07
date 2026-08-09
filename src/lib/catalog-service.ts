/**
 * CatalogService integration — gRPC streaming of LLM-generated UI specs
 * Works with Kiro-generated blob specs (200-element rolling gallery)
 * Model-agnostic: any LLM that generates DSL-conforming JSON
 */

import { DslNode } from "@/components/DslInterpreter";

export interface CatalogFrame {
  type: "snapshot" | "upsert" | "evict" | "heartbeat";
  cursor: number;
}

export interface SnapshotFrame extends CatalogFrame {
  type: "snapshot";
  elements: CatalogElement[];
}

export interface UpsertFrame extends CatalogFrame {
  type: "upsert";
  element: CatalogElement;
}

export interface EvictFrame extends CatalogFrame {
  type: "evict";
  element_id: string;
  reason: "fifo" | "low_score" | "invalid";
}

export interface HeartbeatFrame extends CatalogFrame {
  type: "heartbeat";
  timestamp: number;
}

export interface CatalogElement {
  id: string;
  spec: DslNode;
  mint_context: MintContext;
  minted_at: string;
  view_count: number;
  interaction_score: number; // weighted eviction: (views * dwell_time * interactions) / age
  diagnostics: string[];
}

export interface MintContext {
  scenario: string;
  data_shape: string;
  signal_to_convey: string;
  action_to_afford: string;
  constraints: string[];
  trade_off_vector: string;
  forbidden_patterns: string[];
  model: "gemma" | "claude" | "gpt" | "gemini" | "llama" | "unknown"; // model-agnostic
  prompt_seed: string; // for reproducibility
}

export interface MintRequest {
  scenario: string;
  data_shape: string;
  signal_to_convey: string;
  action_to_afford: string;
  constraints: string[];
  trade_off_vector: string;
  forbidden_patterns: string[];
  model?: string;
}

export interface MintResponse {
  spec: DslNode;
  mint_context: MintContext;
  diagnostics: string[];
  valid: boolean;
}

/**
 * CatalogStore — in-memory 200-element rolling gallery
 * Simulates gRPC streaming in demo mode
 */
export class CatalogStore {
  private elements: Map<string, CatalogElement> = new Map();
  private maxSize = 200;
  private cursor = 0;
  private listeners: ((frame: CatalogFrame) => void)[] = [];

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Snapshot: get all elements at current cursor
   */
  snapshot(): SnapshotFrame {
    return {
      type: "snapshot",
      cursor: this.cursor,
      elements: Array.from(this.elements.values()),
    };
  }

  /**
   * Subscribe to catalog changes
   */
  subscribe(listener: (frame: CatalogFrame) => void): () => void {
    this.listeners.push(listener);
    // Send initial snapshot
    listener(this.snapshot());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Upsert element (new mint or regeneration)
   */
  upsert(element: CatalogElement): void {
    this.cursor++;

    // At capacity, evict oldest/lowest-scoring
    if (this.elements.size >= this.maxSize) {
      this.evictLowestScoring();
    }

    this.elements.set(element.id, element);

    const frame: UpsertFrame = {
      type: "upsert",
      cursor: this.cursor,
      element,
    };

    this.broadcast(frame);
  }

  /**
   * Evict element (FIFO, low-score, or invalid)
   */
  private evict(id: string, reason: "fifo" | "low_score" | "invalid"): void {
    this.cursor++;
    this.elements.delete(id);

    const frame: EvictFrame = {
      type: "evict",
      cursor: this.cursor,
      element_id: id,
      reason,
    };

    this.broadcast(frame);
  }

  /**
   * Evict lowest-scoring element
   */
  private evictLowestScoring(): void {
    let lowest: [string, CatalogElement] | null = null;
    let lowestScore = Infinity;

    for (const [id, el] of this.elements) {
      if (el.interaction_score < lowestScore) {
        lowestScore = el.interaction_score;
        lowest = [id, el];
      }
    }

    if (lowest) {
      this.evict(lowest[0], "low_score");
    }
  }

  /**
   * Record interaction (view, dwell, click)
   */
  recordInteraction(id: string, type: "view" | "dwell" | "action"): void {
    const el = this.elements.get(id);
    if (!el) return;

    el.view_count++;

    // Score = (views * interactions) / age_minutes
    const ageMs = Date.now() - new Date(el.minted_at).getTime();
    const ageMinutes = Math.max(1, ageMs / 60000);
    el.interaction_score = (el.view_count * (type === "action" ? 2 : 1)) / ageMinutes;

    // Broadcast update
    this.cursor++;
    const frame: UpsertFrame = {
      type: "upsert",
      cursor: this.cursor,
      element,
    };
    this.broadcast(frame);
  }

  /**
   * Heartbeat (server-side keepalive)
   */
  private startHeartbeat(): void {
    setInterval(() => {
      this.cursor++;
      const frame: HeartbeatFrame = {
        type: "heartbeat",
        cursor: this.cursor,
        timestamp: Date.now(),
      };
      this.broadcast(frame);
    }, 5000);
  }

  /**
   * Broadcast frame to all listeners
   */
  private broadcast(frame: CatalogFrame): void {
    this.listeners.forEach((l) => l(frame));
  }

  /**
   * Get element by ID
   */
  get(id: string): CatalogElement | undefined {
    return this.elements.get(id);
  }

  /**
   * Get all elements
   */
  getAll(): CatalogElement[] {
    return Array.from(this.elements.values());
  }

  /**
   * Current cursor (frame sequence number)
   */
  getCursor(): number {
    return this.cursor;
  }
}

/**
 * Global catalog store (singleton)
 */
let globalCatalog: CatalogStore | null = null;

export function getCatalogStore(): CatalogStore {
  if (!globalCatalog) {
    globalCatalog = new CatalogStore();
  }
  return globalCatalog;
}

/**
 * Mint new spec via model-agnostic LLM call
 * In production, calls AI SDK endpoint; in demo, returns mock spec
 */
export async function mintSpec(
  request: MintRequest,
  model: "claude" | "gpt" | "gemini" | "llama" = "claude"
): Promise<MintResponse> {
  // In production:
  // const response = await fetch('/api/catalog/mint', {
  //   method: 'POST',
  //   body: JSON.stringify({ ...request, model })
  // })
  // return response.json()

  // Demo: simulate LLM mint
  await new Promise((r) => setTimeout(r, 1000));

  return {
    spec: {
      kind: "panel",
      title: "Minted by " + model,
      children: [
        { kind: "text", value: request.signal_to_convey },
        { kind: "text", value: request.action_to_afford, tone: "muted" },
      ],
    },
    mint_context: {
      ...request,
      model: model as any,
      prompt_seed: Math.random().toString(36).slice(2),
    },
    diagnostics: [],
    valid: true,
  };
}

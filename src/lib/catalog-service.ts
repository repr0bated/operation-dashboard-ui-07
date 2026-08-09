/**
 * CatalogService — Kiro spec catalog via plugin system blobs
 * Queries type-checked specs from /dev/shm (single source of truth)
 * Model-agnostic: Claude, GPT, Gemini, Llama
 */

import { DslNode } from "@/components/DslInterpreter";
import { api } from "@/lib/api";

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
  interaction_score: number;
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
  model: string;
  prompt_seed: string;
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
 * CatalogStore — queries blobs via plugin system, 200-element rolling gallery
 */
export class CatalogStore {
  private elements: Map<string, CatalogElement> = new Map();
  private maxSize = 200;
  private cursor = 0;
  private listeners: ((frame: CatalogFrame) => void)[] = [];

  constructor() {
    this.loadFromBlobs();
    this.startHeartbeat();
  }

  /**
   * Load specs from Kiro-generated blobs via plugin system
   * Blobs live in /dev/shm, served as type-checked specs by plugin system
   */
  private async loadFromBlobs(): Promise<void> {
    try {
      // Query plugin system for catalog specs
      // In production, calls CatalogService.Subscribe(gRPC stream)
      // For now, query via StateSync for blobs at a known path
      const blobState = await api.state("", "/dev/shm/kiro/specs");

      if (!blobState || typeof blobState !== "object") {
        console.warn("No catalog specs found in blobs");
        return;
      }

      // Parse blob specs into CatalogElements
      for (const [id, rawSpec] of Object.entries(blobState)) {
        if (!rawSpec || typeof rawSpec !== "object") continue;

        const spec = rawSpec as Record<string, any>;
        if (!spec.id) continue;  // Must have ID

        const element: CatalogElement = {
          id: String(spec.id),
          spec: spec.spec as DslNode || { kind: "diagnostic", reason: "No spec" },
          mint_context: spec.mint_context || {
            scenario: "",
            data_shape: "",
            signal_to_convey: "",
            action_to_afford: "",
            constraints: [],
            trade_off_vector: "",
            forbidden_patterns: [],
            model: "unknown",
            prompt_seed: "",
          },
          minted_at: spec.minted_at || new Date().toISOString(),
          view_count: spec.view_count || 0,
          interaction_score: spec.interaction_score || 0,
          diagnostics: spec.diagnostics || [],
        };

        this.elements.set(element.id, element);
      }

      // Emit snapshot to subscribers
      this.broadcast(this.snapshot());
    } catch (err) {
      console.error("Failed to load catalog specs from blobs:", err);
    }
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
   * Subscribe to catalog changes (simulates gRPC stream)
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
   * Upsert element (LLM-minted spec added to blobs)
   */
  async upsert(element: CatalogElement): Promise<void> {
    this.cursor++;

    // At capacity, evict oldest/lowest-scoring
    if (this.elements.size >= this.maxSize) {
      this.evictLowestScoring();
    }

    this.elements.set(element.id, element);

    // Write to blobs via plugin system
    try {
      await api.plugins.setProperty(
        "catalog-service",
        `/dev/shm/kiro/specs/${element.id}`,
        element
      );
    } catch (err) {
      console.error("Failed to write spec to blobs:", err);
    }

    const frame: UpsertFrame = {
      type: "upsert",
      cursor: this.cursor,
      element,
    };

    this.broadcast(frame);
  }

  /**
   * Evict element (remove from blobs)
   */
  private async evict(id: string, reason: "fifo" | "low_score" | "invalid"): Promise<void> {
    this.cursor++;
    this.elements.delete(id);

    // Remove from blobs
    try {
      await api.plugins.setProperty("catalog-service", `/dev/shm/kiro/specs/${id}`, null);
    } catch (err) {
      console.error("Failed to remove spec from blobs:", err);
    }

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
      element: el,
    };
    this.broadcast(frame);
  }

  /**
   * Heartbeat (simulates gRPC keepalive)
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
 * Calls /api/catalog/mint which routes to appropriate LLM endpoint
 */
export async function mintSpec(
  request: MintRequest,
  model: "claude" | "gpt" | "gemini" | "llama" = "claude"
): Promise<MintResponse> {
  try {
    // In production: calls /api/catalog/mint
    // which dispatches to Claude API, OpenAI, Gemini, Llama, etc.
    const response = await fetch("/api/catalog/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, model }),
    });

    if (!response.ok) {
      throw new Error(`Mint failed: ${response.status}`);
    }

    return response.json();
  } catch (err) {
    // Fallback: demo spec
    console.warn("Mint API unavailable, using demo spec:", err);
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
        model,
        prompt_seed: Math.random().toString(36).slice(2),
      },
      diagnostics: [],
      valid: true,
    };
  }
}

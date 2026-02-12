
export type Scalar = number;
export type Vector = number[]; 

export type PhysicalProperty = 
    | "STABILITY"   // Triangular/Vertical frames (A, H, M)
    | "CONTAINMENT" // Enclosed/Lobed shapes (B, O, D, U)
    | "FLOW"        // Curves and paths (C, L, S, N)
    | "STOP"        // Hard boundaries (T, K, X)
    | "ENERGY"      // Potential/Kinetic stores (P, F, R, E)
    | "ALIGNMENT"   // Axial direction (I, V, Y, Z)
    | "UNKNOWN";

export interface Glyph {
    char: string;
    role: string;
    physics: PhysicalProperty;
    vector: string;
}

export interface MechanicalStats {
    stability: number;
    containment: number;
    energy: number;
    flow: number;
    stop: number;
    alignment: number;
}

export interface AnalysisResult {
    word: string;
    glyphs: Glyph[];
    stats: MechanicalStats;
    profile: string;
    loadPath: string;
}

export enum QueryShape {
    CAPITAL_OF = "capital(X) = ?",
    FOUNDER_OF = "founder(X) = ?",
    POPULATION_OF = "population(X) = ?",
    LANGUAGE_OF = "language(X) = ?",
    CURRENCY_OF = "currency(X) = ?",
    PHYSICS_LAW = "law(X) = ?",
    ATOMIC_NUMBER = "atomic_num(X) = ?",
    UNKNOWN = "UNKNOWN"
}

export enum CognitiveState {
    MISCONCEPTION = "MISCONCEPTION",
    FOG = "FOG",
    CORRECT = "CORRECT",
    PARTIAL = "PARTIAL"
}

export enum ConstraintStatus {
    GREEN = "GREEN",
    YELLOW = "YELLOW",
    RED = "RED",
    FINFR = "FINFR"
}

export enum Action {
    RESPOND = "RESPOND",
    ABSTAIN = "ABSTAIN",
    CLARIFY = "CLARIFY",
    DEFER = "DEFER",
    ESCALATE = "ESCALATE"
}

export interface GroundingSource {
    uri: string;
    title?: string;
}

export interface LexicalNode {
    synonyms: string[];
    antonyms: string[];
    equation: string;
}

export interface SearchResult {
    tier: number;
    method: string;
    shape: string; // Now supports dynamic equations
    entity: string;
    confidence: number;
    details: string;
    insight: string;
    lexical?: LexicalNode;
    csv: {
        c: number;
        m: number;
        f: number;
        k: number;
        state: CognitiveState;
    };
    constraint: {
        status: ConstraintStatus;
        ratio: number;
    };
    action: Action;
    trajectoryPoints: Vector[];
    isClosed: boolean;
    groundingSources?: GroundingSource[];
}

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

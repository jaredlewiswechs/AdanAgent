
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
    LEADER_OF = "leader(X) = ?",
    HISTORY_OF = "history(X) = ?",
    LOCATION_OF = "location(X) = ?",
    BIOLOGY_OF = "biology(X) = ?",
    MATH_OF = "math(X) = ?",
    DEFINITION_OF = "define(X) = ?",
    INVENTION_OF = "inventor(X) = ?",
    COMPOSED_BY = "composer(X) = ?",
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

export enum ProofLabel {
    VERIFIED = "VERIFIED",
    LIKELY = "LIKELY",
    NEEDS_DATA = "NEEDS_DATA"
}

export interface LedgerStep {
    step: number;
    action: string;
    detail: string;
    timestamp: number;
}

export interface ShapeExport {
    query: string;
    resolvedShape: string;
    confidence: number;
    glyphsUsed: string[];
    profileVector: MechanicalStats;
    solverMethod: string;
    proofLabel: ProofLabel;
    cognitiveState: CognitiveState;
    constraintStatus: ConstraintStatus;
    ledger: LedgerStep[];
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
    /** Proof governance label: VERIFIED / LIKELY / NEEDS_DATA */
    proofLabel: ProofLabel;
    /** Step-by-step ledger of the resolution process */
    ledger: LedgerStep[];
    /** Pre-computed glyph analysis for export */
    glyphAnalysis?: AnalysisResult;
    /** Set when AI fallback was used due to network/API failure */
    error?: string;
}

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

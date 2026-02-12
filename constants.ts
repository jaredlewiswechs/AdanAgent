
import { Glyph } from './types';

export const GLYPH_DB: Record<string, Glyph> = {
    'A': { char: 'A', role: 'Frame',       physics: 'STABILITY',   vector: 'Static equilibrium, load distribution' },
    'B': { char: 'B', role: 'Dual Lobes',  physics: 'CONTAINMENT', vector: 'Volume storage, redundancy' },
    'C': { char: 'C', role: 'Open Arc',    physics: 'FLOW',        vector: 'Directional aperture, reception' },
    'D': { char: 'D', role: 'Mass',        physics: 'CONTAINMENT', vector: 'Gravitational load, heavy state' },
    'E': { char: 'E', role: 'Tiers',       physics: 'ENERGY',      vector: 'Layering, hierarchical distribution' },
    'F': { char: 'F', role: 'Cantilever',  physics: 'ENERGY',      vector: 'Reach, leverage, moment arm' },
    'G': { char: 'G', role: 'Hook',        physics: 'CONTAINMENT', vector: 'Capture, gating, flow control' },
    'H': { char: 'H', role: 'Pillars',     physics: 'STABILITY',   vector: 'Bridging, tensile span' },
    'I': { char: 'I', role: 'Axis',        physics: 'ALIGNMENT',   vector: 'Linear direction, verticality' },
    'J': { char: 'J', role: 'Swing',       physics: 'FLOW',        vector: 'Redirected inertia' },
    'K': { char: 'K', role: 'Shear',       physics: 'STOP',        vector: 'Kinetic impact, cutting action' },
    'L': { char: 'L', role: 'Bend',        physics: 'FLOW',        vector: 'Flow redirection, pooling' },
    'M': { char: 'M', role: 'Wave',        physics: 'STABILITY',   vector: 'Harmonic frequency, stable base' },
    'N': { char: 'N', role: 'Bridge',      physics: 'FLOW',        vector: 'State transition, transfer' },
    'O': { char: 'O', role: 'Loop',        physics: 'CONTAINMENT', vector: 'Complete volume enclosure' },
    'P': { char: 'P', role: 'Bulb',        physics: 'ENERGY',      vector: 'Pressure, stored potential' },
    'Q': { char: 'Q', role: 'Queue',       physics: 'CONTAINMENT', vector: 'Restricted exit volume' },
    'R': { char: 'R', role: 'Brace',       physics: 'ENERGY',      vector: 'Resistance, force opposition' },
    'S': { char: 'S', role: 'Curve',       physics: 'FLOW',        vector: 'Slip, flexibility, low friction' },
    'T': { char: 'T', role: 'Post',        physics: 'STOP',        vector: 'Hard stop, limit, impact boundary' },
    'U': { char: 'U', role: 'Vessel',      physics: 'CONTAINMENT', vector: 'Reception, holding capacity' },
    'V': { char: 'V', role: 'Focus',       physics: 'ALIGNMENT',   vector: 'Vector convergence, concentration' },
    'W': { char: 'W', role: 'Valley',      physics: 'ENERGY',      vector: 'Oscillatory motion, instability' },
    'X': { char: 'X', role: 'Cross',       physics: 'STOP',        vector: 'Torsional rigidity, locking' },
    'Y': { char: 'Y', role: 'Fork',        physics: 'ALIGNMENT',   vector: 'Distribution, flow splitting' },
    'Z': { char: 'Z', role: 'Zigzag',      physics: 'ALIGNMENT',   vector: 'Rapid direction change' }
};

export const SEMANTIC_CLUSTERS: Record<string, Set<string>> = {
    "CAPITAL": new Set([
        "capital", "seat", "government", "rule", "govern", 
        "headquarters", "center", "city", "administrative"
    ]),
    "FOUNDER": new Set([
        "founder", "found", "founded", "create", "created", "start", "started",
        "build", "built", "establish", "established", "originate", "originated",
        "begin", "began", "commence", "launched", "creator", "father", "cofounder"
    ]),
    "POPULATION": new Set([
        "population", "people", "inhabitants", "citizens",
        "residents", "live", "living", "populate", "demographics"
    ]),
    "PHYSICS": new Set([
        "law", "theory", "principle", "equation", "force", 
        "motion", "relativity", "thermodynamics", "gravity", "physics"
    ]),
    "ELEMENT": new Set([
        "element", "atom", "atomic", "chemical", "periodic",
        "symbol", "molecule", "compound", "proton", "electron"
    ])
};

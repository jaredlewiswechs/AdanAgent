
import React, { useState } from 'react';
import { GLYPH_DB } from '../constants';
import { Glyph } from '../types';

const GlyphLab: React.FC = () => {
    const [selectedGlyph, setSelectedGlyph] = useState<Glyph>(GLYPH_DB['A']);

    return (
        <div className="flex flex-col lg:flex-row gap-6 p-4 animate-fade-in">
            {/* Grid of Glyphs */}
            <div className="lg:w-2/3 grid grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2.5">
                {Object.values(GLYPH_DB).map((glyph) => (
                    <button
                        key={glyph.char}
                        onClick={() => setSelectedGlyph(glyph)}
                        className={`touch-target aspect-square flex items-center justify-center text-2xl md:text-3xl mono transition-spring rounded-xl border ${
                            selectedGlyph.char === glyph.char
                            ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-400 card-elevated'
                            : 'bg-slate-900/30 border-slate-800/50 text-slate-500 hover:border-slate-600/60 hover:text-slate-400'
                        }`}
                    >
                        {glyph.char}
                    </button>
                ))}
            </div>

            {/* Glyph Details */}
            <div className="lg:w-1/3 glass-panel p-6 border-l-[3px] border-l-cyan-500/70 card-elevated">
                <div className="flex items-center gap-4 mb-6">
                    <span className="text-6xl md:text-7xl font-black mono text-cyan-400 glow-cyan">
                        {selectedGlyph.char}
                    </span>
                    <div>
                        <h3 className="text-lg md:text-xl font-bold uppercase tracking-wider">{selectedGlyph.role}</h3>
                        <p className="text-cyan-500 mono text-sm">{selectedGlyph.physics}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] uppercase text-slate-500 tracking-wider block mb-1.5">Vector Dynamics</label>
                        <p className="text-slate-300 italic text-sm leading-relaxed">
                            "{selectedGlyph.vector}"
                        </p>
                    </div>

                    <div className="pt-4 border-t border-slate-800/30">
                        <label className="text-[10px] uppercase text-slate-500 tracking-wider block mb-2">Mechanical Schema</label>
                        <div className="bg-slate-950/40 p-4 border border-slate-800/40 rounded-xl font-mono text-[11px] text-cyan-600/50 leading-relaxed whitespace-pre-wrap">
                            {`// PHYSICS DEFINITION\nENTITY Glyph_${selectedGlyph.char} {\n  ROLE: "${selectedGlyph.role}";\n  PROPERTIES: [${selectedGlyph.physics}];\n  CONSTRAINTS: STATIC;\n}`}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlyphLab;

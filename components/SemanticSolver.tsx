
import React, { useState } from 'react';
import { KinematicEngine } from '../services/kinematicEngine';
import { SearchResult, QueryShape, ProofLabel } from '../types';

const engine = new KinematicEngine();

const SemanticSolver: React.FC = () => {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<SearchResult | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleProcess = async () => {
        if (!query.trim()) return;
        setIsProcessing(true);
        setResult(null);
        
        // Artificial delay to show engine activity
        await new Promise(r => setTimeout(r, 800));
        const res = await engine.process(query);
        setResult(res);
        setIsProcessing(false);
    };

    return (
        <div className="p-4 max-w-4xl mx-auto flex flex-col gap-6 animate-in zoom-in-95 duration-500">
            <div className="glass-panel p-1 rounded-full flex items-center shadow-xl border-cyan-500/20" role="search">
                <label htmlFor="solver-input" className="sr-only">Query input</label>
                <input
                    id="solver-input"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleProcess()}
                    placeholder="Enter natural language query (e.g., 'What is the capital of Japan?')"
                    aria-label="Enter query for Kinematic Solver"
                    className="flex-1 bg-transparent px-6 py-4 focus:outline-none text-lg text-slate-200"
                />
                <button
                    onClick={handleProcess}
                    disabled={isProcessing}
                    aria-label={isProcessing ? 'Processing query...' : 'Process query'}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-4 rounded-full font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2"
                >
                    {isProcessing ? 'RESOLVING...' : 'PROCESS'}
                </button>
            </div>

            <div className="grid md:grid-cols-3 gap-4 opacity-50" role="group" aria-label="Resolution tier indicators">
                <div className={`p-4 border border-slate-800 rounded flex flex-col items-center text-center transition-all ${result?.tier === 1 ? 'opacity-100 border-green-500/50 bg-green-500/5' : ''}`} role="status" aria-label={`Tier 1 Rigid Pattern${result?.tier === 1 ? ' - Active' : ''}`}>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Tier 1</span>
                    <span className="font-bold text-sm">RIGID PATTERN</span>
                </div>
                <div className={`p-4 border border-slate-800 rounded flex flex-col items-center text-center transition-all ${result?.tier === 2 ? 'opacity-100 border-yellow-500/50 bg-yellow-500/5' : ''}`} role="status" aria-label={`Tier 2 Semantic Resonance${result?.tier === 2 ? ' - Active' : ''}`}>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Tier 2</span>
                    <span className="font-bold text-sm">SEMANTIC RESONANCE</span>
                </div>
                <div className={`p-4 border border-slate-800 rounded flex flex-col items-center text-center transition-all ${result?.tier === 3 ? 'opacity-100 border-red-500/50 bg-red-500/5' : ''}`} role="status" aria-label={`Tier 3 Vector Latency${result?.tier === 3 ? ' - Active' : ''}`}>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Tier 3</span>
                    <span className="font-bold text-sm">VECTOR LATENCY</span>
                </div>
            </div>

            {/* Error banner for solver */}
            {result?.error && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg" role="alert">
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-red-400 text-xs mono">AI service error — showing fallback. {result.error}</span>
                </div>
            )}

            {result && (
                <div className="glass-panel p-8 border-t-4 border-t-cyan-500 rounded-lg animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div>
                            <span className="text-[10px] text-slate-500 uppercase tracking-[0.3em]">Resolved Shape</span>
                            <h2 className="text-3xl font-black text-cyan-400 mono tracking-tighter uppercase">{result.shape === QueryShape.UNKNOWN ? 'Novel Topology' : result.shape}</h2>
                            {result.shape === QueryShape.UNKNOWN && (
                                <p className="text-[10px] text-slate-500 mt-1 italic">This query forms a new shape not seen in the known library.</p>
                            )}
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-slate-500 uppercase tracking-[0.3em]">Confidence</span>
                            <div className="text-2xl font-bold mono text-white">{(result.confidence * 100).toFixed(1)}%</div>
                        </div>
                    </div>

                    {/* Proof Label + Solver Branding */}
                    <div className="flex flex-wrap gap-3 mb-8">
                        {result.proofLabel && (
                            <span className={`text-[10px] font-bold tracking-widest px-3 py-1 rounded border ${
                                result.proofLabel === ProofLabel.VERIFIED ? 'bg-green-500/10 border-green-500/50 text-green-400' :
                                result.proofLabel === ProofLabel.LIKELY ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' :
                                'bg-red-500/10 border-red-500/50 text-red-400'
                            }`}>
                                {result.proofLabel === ProofLabel.VERIFIED ? '\u2705 Verified' :
                                 result.proofLabel === ProofLabel.LIKELY ? '\uD83D\uDFE1 Likely' :
                                 '\u26D4 Needs Data'}
                            </span>
                        )}
                        {result.tier === 3 && (
                            <div className="flex gap-2">
                                <span className="text-[10px] px-2 py-1 rounded border border-orange-500/30 bg-orange-500/5 text-orange-400 tracking-wider">Translator: LLM (untrusted)</span>
                                <span className="text-[10px] px-2 py-1 rounded border border-green-500/30 bg-green-500/5 text-green-400 tracking-wider">Governor: Newton (trusted)</span>
                            </div>
                        )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 mb-8">
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2">Signal Method</label>
                            <p className="text-slate-300 font-medium">{result.method}</p>
                            <p className="text-slate-500 text-sm mt-1">{result.details}</p>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2">Extracted Entity</label>
                            <div className="bg-slate-900/50 px-4 py-2 border border-slate-800 rounded inline-block text-cyan-300 font-bold tracking-wider">
                                {result.entity}
                            </div>
                        </div>
                    </div>

                    {result.insight && (
                        <div className="p-4 bg-cyan-950/20 border border-cyan-900/50 rounded-lg">
                            <label className="text-[10px] text-cyan-500 uppercase tracking-widest block mb-2">Kinematic Latent Insight (Ada)</label>
                            <p className="text-cyan-100/80 italic text-sm leading-relaxed">
                                {result.insight}
                            </p>
                        </div>
                    )}

                    <div className="mt-8 pt-8 border-t border-slate-800">
                        <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2">Equation Normalization</label>
                        <div className="font-mono text-lg text-slate-400">
                            {result.shape !== QueryShape.UNKNOWN ? result.shape.replace('X', result.entity) : '∫ topology(signal) dθ ≈ ???'}
                        </div>
                    </div>
                </div>
            )}

            {!result && !isProcessing && (
                <div className="text-center py-20 opacity-20 select-none">
                    <div className="text-6xl mb-4">∑</div>
                    <p className="mono uppercase tracking-[0.5em]">Awaiting signal for processing...</p>
                </div>
            )}
        </div>
    );
};

export default SemanticSolver;

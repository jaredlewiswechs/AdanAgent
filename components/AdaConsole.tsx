
import React, { useState, useEffect, useRef } from 'react';
import { AdaEngine } from '../services/adaEngine';
import { SearchResult, ConstraintStatus, Action, CognitiveState, ChatMessage, ProofLabel, ShapeExport } from '../types';
import { WordMechanics } from '../services/kinematicEngine';

const engine = new AdaEngine();

const PROOF_DISPLAY = {
    [ProofLabel.VERIFIED]: { icon: '\u2705', label: 'Verified', desc: 'From input / defined facts', cls: 'bg-green-500/10 border-green-500/50 text-green-400' },
    [ProofLabel.LIKELY]: { icon: '\uD83D\uDFE1', label: 'Likely', desc: 'Inference', cls: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' },
    [ProofLabel.NEEDS_DATA]: { icon: '\u26D4', label: 'Needs Data', desc: 'Ask user for missing info', cls: 'bg-red-500/10 border-red-500/50 text-red-400' },
};

const buildShapeExport = (query: string, result: SearchResult): ShapeExport => {
    const analysis = result.glyphAnalysis || WordMechanics.analyze(result.entity || 'Signal');
    return {
        query,
        resolvedShape: result.shape,
        confidence: result.confidence,
        glyphsUsed: analysis.glyphs.map(g => g.char),
        profileVector: analysis.stats,
        solverMethod: result.method,
        proofLabel: result.proofLabel,
        cognitiveState: result.csv.state,
        constraintStatus: result.constraint.status,
        ledger: result.ledger,
    };
};

const AdaConsole: React.FC = () => {
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<{ query: string, result: SearchResult }[]>([]);
    const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [complexity, setComplexity] = useState<'ELI5' | 'STANDARD' | 'TECHNICAL'>('STANDARD');
    const [openLedgerIdx, setOpenLedgerIdx] = useState<number | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, isThinking]);

    const handleSend = async () => {
        if (!input.trim() || isThinking) return;
        const currentInput = input;
        setInput('');
        setIsThinking(true);
        
        try {
            const result = await engine.process(currentInput, chatLog, complexity);
            setHistory(prev => [...prev, { query: currentInput, result }]);
            setChatLog(prev => [
                ...prev, 
                { role: 'user', parts: [{ text: currentInput }] },
                { role: 'model', parts: [{ text: result.insight }] }
            ]);
        } catch (e) {
            console.error(e);
            // Surface the error as a failed result so the user sees feedback
            const errMsg = e instanceof Error ? e.message : 'Unknown error';
            setHistory(prev => [...prev, {
                query: currentInput,
                result: {
                    tier: 3, method: 'Error', shape: 'error', entity: 'System',
                    confidence: 0, details: '', insight: '',
                    csv: { c: 0, m: 0, f: 1, k: 0, state: 'FOG' as any },
                    constraint: { status: 'RED' as any, ratio: 0 },
                    action: 'ABSTAIN' as any,
                    trajectoryPoints: [[0, 0]], isClosed: false,
                    proofLabel: ProofLabel.NEEDS_DATA,
                    ledger: [{ step: 1, action: 'Error', detail: errMsg, timestamp: 0 }],
                    error: errMsg
                }
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-180px)] max-w-6xl mx-auto gap-4 p-4 animate-in fade-in duration-700">
            {/* Top Control Bar */}
            <div className="flex justify-between items-center bg-slate-900/60 p-2 px-4 rounded-full border border-slate-800" role="toolbar" aria-label="Complexity controls">
                <div className="flex gap-2" role="radiogroup" aria-label="Response complexity level">
                    {['ELI5', 'STANDARD', 'TECHNICAL'].map(lvl => (
                        <button
                            key={lvl}
                            onClick={() => setComplexity(lvl as any)}
                            role="radio"
                            aria-checked={complexity === lvl}
                            aria-label={`${lvl} complexity mode`}
                            className={`px-3 py-1 rounded-full text-[10px] mono font-bold transition-all ${
                                complexity === lvl ? 'bg-cyan-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {lvl}
                        </button>
                    ))}
                </div>
                <div className="text-[10px] mono text-slate-600 uppercase tracking-widest" aria-live="polite">
                    Governance Active • 2026 Temporal Link
                </div>
            </div>

            {/* Chat Output */}
            <div className="flex-1 overflow-y-auto space-y-8 pr-4 custom-scrollbar">
                {history.length === 0 && !isThinking && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-800 pointer-events-none select-none">
                        <div className="text-8xl mono font-black opacity-10 mb-4">ADA</div>
                        <p className="mono text-xs uppercase tracking-[0.4em]">Initialize signal for semantic resolution</p>
                    </div>
                )}

                {history.map((item, idx) => (
                    <div key={idx} className="space-y-4 animate-in slide-in-from-bottom-4">
                        {/* User Input bubble */}
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center mono text-xs text-slate-500 border border-slate-700">U</div>
                            <div className="bg-slate-900/40 p-3 rounded border border-slate-800 text-slate-300 max-w-2xl font-medium">
                                {item.query}
                            </div>
                        </div>

                        {/* Ada Response bubble */}
                        <div className="flex items-start gap-4" role="article" aria-label={`Ada response to: ${item.query}`}>
                            <div className="w-8 h-8 rounded bg-cyan-900/30 flex items-center justify-center mono text-xs text-cyan-400 border border-cyan-500/30" aria-hidden="true">A</div>
                            <div className="flex-1 space-y-4">
                                {/* Error banner */}
                                {item.result.error && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg" role="alert">
                                        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                        <span className="text-red-400 text-xs mono">AI service error — showing fallback response. {item.result.error}</span>
                                    </div>
                                )}
                                <div className="glass-panel p-6 border-l-4 border-l-cyan-500 rounded-lg shadow-xl">
                                    <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                                        <div className="bg-slate-950 px-3 py-1 rounded-md border border-slate-800">
                                            <span className="text-[10px] mono text-slate-500 mr-2 uppercase">Equation</span>
                                            <span className="text-cyan-400 font-bold mono text-sm">{item.result.lexical?.equation}</span>
                                        </div>
                                        <div className="flex gap-2 items-center" role="status" aria-label={`Proof: ${item.result.proofLabel}, Constraint: ${item.result.constraint?.status}, State: ${item.result.csv?.state}`}>
                                            {/* PROOF LABEL */}
                                            {item.result.proofLabel && (
                                                <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 rounded border ${PROOF_DISPLAY[item.result.proofLabel].cls}`} title={PROOF_DISPLAY[item.result.proofLabel].desc}>
                                                    {PROOF_DISPLAY[item.result.proofLabel].icon}{' '}
                                                    {PROOF_DISPLAY[item.result.proofLabel].label}
                                                </span>
                                            )}
                                            <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 rounded border ${
                                                item.result.constraint?.status === ConstraintStatus.GREEN ? 'bg-green-500/10 border-green-500/50 text-green-400' :
                                                item.result.constraint?.status === ConstraintStatus.RED ? 'bg-red-500/10 border-red-500/50 text-red-400' :
                                                'bg-yellow-500/10 border-yellow-500/50 text-yellow-400'
                                            }`} title={`Constraint status: ${item.result.constraint?.status} (ratio: ${item.result.constraint?.ratio?.toFixed(2)})`}>
                                                {item.result.constraint?.status === ConstraintStatus.GREEN ? '\u2713' :
                                                 item.result.constraint?.status === ConstraintStatus.RED ? '\u2717' : '\u26A0'}{' '}
                                                FG:{item.result.constraint?.status}
                                            </span>
                                            <span className="text-[9px] mono text-slate-500 uppercase py-0.5">{item.result.csv?.state}</span>
                                        </div>
                                    </div>

                                    <div className="text-slate-200 leading-relaxed mb-6 text-lg font-medium">
                                        {item.result.insight}
                                    </div>

                                    {/* Lexical Expansion */}
                                    {item.result.lexical && (
                                        <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-slate-800/50">
                                            <div>
                                                <h5 className="text-[8px] mono text-slate-600 uppercase mb-1">Lexical Synonyms</h5>
                                                <div className="flex flex-wrap gap-1">
                                                    {item.result.lexical.synonyms.map(s => (
                                                        <span key={s} className="text-[10px] px-1.5 py-0.5 bg-slate-800/50 rounded text-slate-400">{s}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <h5 className="text-[8px] mono text-slate-600 uppercase mb-1">Contrast Antonyms</h5>
                                                <div className="flex flex-wrap gap-1">
                                                    {item.result.lexical.antonyms.map(a => (
                                                        <span key={a} className="text-[10px] px-1.5 py-0.5 bg-red-900/10 rounded text-red-500/60">{a}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sources */}
                                    {item.result.groundingSources && (
                                        <div className="mb-6 flex flex-wrap gap-2">
                                            {item.result.groundingSources.slice(0, 3).map((source, sIdx) => (
                                                <a key={sIdx} href={source.uri} target="_blank" rel="noreferrer" className="text-[9px] mono text-cyan-600 hover:text-cyan-400 flex items-center gap-1 border border-cyan-900/30 px-2 py-1 rounded">
                                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                    {source.title || "Ref"}
                                                </a>
                                            ))}
                                        </div>
                                    )}

                                    {/* Geometric Stats */}
                                    <div className="flex items-center gap-6 pt-6 border-t border-slate-800">
                                        <div className="flex-1 h-1 bg-slate-900 rounded-full flex overflow-hidden" role="meter" aria-label={`Correctness: ${((item.result.csv?.c || 0) * 100).toFixed(0)}%, Misconception: ${((item.result.csv?.m || 0) * 100).toFixed(0)}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((item.result.csv?.c || 0) * 100)}>
                                            <div style={{ width: `${(item.result.csv?.c || 0) * 100}%` }} className="bg-green-500 h-full" title={`Correctness: ${((item.result.csv?.c || 0) * 100).toFixed(0)}%`} />
                                            <div style={{ width: `${(item.result.csv?.m || 0) * 100}%` }} className="bg-red-500 h-full" title={`Misconception: ${((item.result.csv?.m || 0) * 100).toFixed(0)}%`} />
                                        </div>
                                        <div className="h-10 w-24 relative overflow-hidden bg-slate-950/40 rounded border border-slate-900" title="Semantic resolution trajectory">
                                            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Bezier trajectory curve showing query resolution path">
                                                <path d={`M ${item.result.trajectoryPoints?.map(p => `${p[0]*100},${100 - p[1]*100}`).join(' L ')}`} fill="none" stroke="#22d3ee" strokeWidth="3" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* LEDGER + EXPORT action row */}
                                    <div className="flex items-center gap-3 pt-4 mt-4 border-t border-slate-800/50">
                                        <button
                                            onClick={() => setOpenLedgerIdx(openLedgerIdx === idx ? null : idx)}
                                            className="text-[10px] mono uppercase tracking-widest px-3 py-1.5 rounded border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all flex items-center gap-1.5"
                                            aria-expanded={openLedgerIdx === idx}
                                            aria-label="Toggle resolution ledger"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                            {openLedgerIdx === idx ? 'Hide Ledger' : 'Show Ledger'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                const shape = buildShapeExport(item.query, item.result);
                                                const blob = new Blob([JSON.stringify(shape, null, 2)], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `ada-shape-${Date.now()}.json`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="text-[10px] mono uppercase tracking-widest px-3 py-1.5 rounded border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all flex items-center gap-1.5"
                                            aria-label="Export shape object as JSON"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            Export JSON
                                        </button>
                                    </div>

                                    {/* LEDGER PANEL */}
                                    {openLedgerIdx === idx && item.result.ledger && (
                                        <div className="mt-4 p-4 bg-slate-950/60 border border-slate-800 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                                            <h5 className="text-[9px] mono text-cyan-500 uppercase tracking-widest mb-3">Resolution Ledger</h5>
                                            <div className="space-y-2">
                                                {item.result.ledger.map((step) => (
                                                    <div key={step.step} className="flex items-start gap-3">
                                                        <div className="w-5 h-5 rounded-full bg-cyan-900/30 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-[8px] mono text-cyan-400 font-bold">{step.step}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-[10px] mono text-cyan-400 font-bold uppercase">{step.action}</span>
                                                            <p className="text-[10px] text-slate-400 mt-0.5 break-words">{step.detail}</p>
                                                        </div>
                                                        <span className="text-[8px] mono text-slate-600 flex-shrink-0">{step.timestamp}ms</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {isThinking && (
                    <div className="flex items-start gap-4 animate-pulse" role="status" aria-live="polite" aria-label="Processing query">
                        <div className="w-8 h-8 rounded bg-cyan-900/30 flex items-center justify-center mono text-xs text-cyan-400 border border-cyan-500/30">A</div>
                        <div className="glass-panel p-4 rounded-lg flex items-center gap-3">
                            <span className="text-[10px] mono text-cyan-400 animate-pulse">RESOLVING MANIFOLD...</span>
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input Section */}
            <div className="glass-panel p-2 rounded-full flex items-center border-cyan-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.5)] mt-auto mb-4" role="search">
                <label htmlFor="ada-input" className="sr-only">Query input</label>
                <input
                    id="ada-input"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Engage with semantic proposition..."
                    aria-label="Enter your query for Ada"
                    className="flex-1 bg-transparent px-6 py-4 focus:outline-none text-slate-200 text-lg placeholder:text-slate-700"
                />
                <button
                    onClick={handleSend}
                    disabled={isThinking || !input.trim()}
                    aria-label={isThinking ? 'Processing query...' : 'Send query'}
                    className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default AdaConsole;

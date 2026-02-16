
import React, { useState, useEffect, useRef } from 'react';
import { AdaEngine } from '../services/adaEngine';
import { SearchResult, ConstraintStatus, Action, CognitiveState, ChatMessage, ProofLabel, ShapeExport } from '../types';
import { WordMechanics } from '../services/kinematicEngine';

const engine = new AdaEngine();

const PROOF_DISPLAY = {
    [ProofLabel.VERIFIED]: { icon: '\u2705', label: 'Verified', desc: 'From input / defined facts', cls: 'bg-green-500/10 border-green-500/40 text-green-400' },
    [ProofLabel.LIKELY]: { icon: '\uD83D\uDFE1', label: 'Likely', desc: 'Inference', cls: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400' },
    [ProofLabel.NEEDS_DATA]: { icon: '\u26D4', label: 'Needs Data', desc: 'Ask user for missing info', cls: 'bg-red-500/10 border-red-500/40 text-red-400' },
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
    // bottomRef removed — scrolling is now handled via scrollRef.scrollTop
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
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
        <div className="flex flex-col h-full max-w-5xl mx-auto gap-4 animate-fade-in">
            {/* Top Control Bar — Apple segmented style */}
            <div className="flex flex-wrap justify-between items-center glass-panel p-2 px-4 card-elevated" role="toolbar" aria-label="Complexity controls">
                <div className="segmented-control" role="radiogroup" aria-label="Response complexity level">
                    {['ELI5', 'STANDARD', 'TECHNICAL'].map(lvl => (
                        <button
                            key={lvl}
                            onClick={() => setComplexity(lvl as any)}
                            role="radio"
                            aria-checked={complexity === lvl}
                            aria-label={`${lvl} complexity mode`}
                            className={complexity === lvl ? '' : ''}
                            style={complexity === lvl ? { background: 'rgba(6,182,212,0.9)', color: '#022', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' } : {}}
                        >
                            {lvl}
                        </button>
                    ))}
                </div>
                <div className="text-[10px] mono text-slate-600 tracking-wider hidden sm:block">
                    Governance Active
                </div>
            </div>

            {/* Chat Output — scroll-fixed container */}
            <div
                ref={scrollRef}
                className="flex-1 scroll-container stable-scrollbar space-y-6 pr-2"
            >
                {history.length === 0 && !isThinking && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-800 pointer-events-none select-none">
                        <div className="text-7xl md:text-8xl mono font-black opacity-[0.06] mb-4">ADA</div>
                        <p className="mono text-xs tracking-[0.3em] text-slate-600/50">Initialize signal for semantic resolution</p>
                    </div>
                )}

                {history.map((item, idx) => (
                    <div key={idx} className="space-y-3 animate-fade-in-up">
                        {/* User bubble */}
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800/60 flex items-center justify-center mono text-[11px] text-slate-500 border border-slate-700/50 flex-shrink-0">U</div>
                            <div className="bg-slate-900/30 px-4 py-3 rounded-2xl rounded-tl-lg border border-slate-800/40 text-slate-300 max-w-2xl text-[15px] leading-relaxed">
                                {item.query}
                            </div>
                        </div>

                        {/* Ada Response */}
                        <div className="flex items-start gap-3" role="article" aria-label={`Ada response to: ${item.query}`}>
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center mono text-[11px] text-cyan-400 border border-cyan-500/20 flex-shrink-0" aria-hidden="true">A</div>
                            <div className="flex-1 space-y-3 min-w-0">
                                {/* Error banner */}
                                {item.result.error && (
                                    <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/8 border border-red-500/20 rounded-xl" role="alert">
                                        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                        <span className="text-red-400 text-xs mono">AI service error — showing fallback response. {item.result.error}</span>
                                    </div>
                                )}

                                <div className="glass-panel p-5 md:p-6 border-l-[3px] border-l-cyan-500/70 card-elevated">
                                    {/* Status row */}
                                    <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                                        <div className="bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/50">
                                            <span className="text-[10px] mono text-slate-500 mr-2">Equation</span>
                                            <span className="text-cyan-400 font-semibold mono text-sm">{item.result.lexical?.equation}</span>
                                        </div>
                                        <div className="flex gap-1.5 items-center flex-wrap" role="status" aria-label={`Proof: ${item.result.proofLabel}, Constraint: ${item.result.constraint?.status}, State: ${item.result.csv?.state}`}>
                                            {item.result.proofLabel && (
                                                <span className={`badge border text-[9px] font-semibold ${PROOF_DISPLAY[item.result.proofLabel].cls}`} title={PROOF_DISPLAY[item.result.proofLabel].desc}>
                                                    {PROOF_DISPLAY[item.result.proofLabel].icon}{' '}
                                                    {PROOF_DISPLAY[item.result.proofLabel].label}
                                                </span>
                                            )}
                                            <span className={`badge border text-[9px] font-semibold ${
                                                item.result.constraint?.status === ConstraintStatus.GREEN ? 'bg-green-500/10 border-green-500/40 text-green-400' :
                                                item.result.constraint?.status === ConstraintStatus.RED ? 'bg-red-500/10 border-red-500/40 text-red-400' :
                                                'bg-yellow-500/10 border-yellow-500/40 text-yellow-400'
                                            }`} title={`Constraint status: ${item.result.constraint?.status} (ratio: ${item.result.constraint?.ratio?.toFixed(2)})`}>
                                                {item.result.constraint?.status === ConstraintStatus.GREEN ? '\u2713' :
                                                 item.result.constraint?.status === ConstraintStatus.RED ? '\u2717' : '\u26A0'}{' '}
                                                FG:{item.result.constraint?.status}
                                            </span>
                                            <span className="text-[9px] mono text-slate-500 py-0.5">{item.result.csv?.state}</span>
                                        </div>
                                    </div>

                                    {/* Main insight */}
                                    <div className="text-slate-200 leading-relaxed mb-5 text-[16px] font-medium">
                                        {item.result.insight}
                                    </div>

                                    {/* Lexical Expansion */}
                                    {item.result.lexical && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 pt-4 border-t border-slate-800/30">
                                            <div>
                                                <h5 className="text-[9px] mono text-slate-600 uppercase mb-1.5 tracking-wider">Synonyms</h5>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {item.result.lexical.synonyms.map(s => (
                                                        <span key={s} className="text-[11px] px-2 py-0.5 bg-slate-800/30 rounded-md text-slate-400">{s}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <h5 className="text-[9px] mono text-slate-600 uppercase mb-1.5 tracking-wider">Antonyms</h5>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {item.result.lexical.antonyms.map(a => (
                                                        <span key={a} className="text-[11px] px-2 py-0.5 bg-red-900/8 rounded-md text-red-500/50">{a}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sources */}
                                    {item.result.groundingSources && (
                                        <div className="mb-5 flex flex-wrap gap-2">
                                            {item.result.groundingSources.slice(0, 3).map((source, sIdx) => (
                                                <a key={sIdx} href={source.uri} target="_blank" rel="noreferrer" className="text-[10px] mono text-cyan-600 hover:text-cyan-400 flex items-center gap-1.5 border border-cyan-900/20 px-2.5 py-1 rounded-lg transition-spring">
                                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                    {source.title || "Ref"}
                                                </a>
                                            ))}
                                        </div>
                                    )}

                                    {/* Confidence bar + trajectory */}
                                    <div className="flex items-center gap-5 pt-5 border-t border-slate-800/30">
                                        <div className="flex-1 h-1.5 bg-slate-900/60 rounded-full flex overflow-hidden" role="meter" aria-label={`Correctness: ${((item.result.csv?.c || 0) * 100).toFixed(0)}%, Misconception: ${((item.result.csv?.m || 0) * 100).toFixed(0)}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((item.result.csv?.c || 0) * 100)}>
                                            <div style={{ width: `${(item.result.csv?.c || 0) * 100}%` }} className="bg-green-500 h-full rounded-full" title={`Correctness: ${((item.result.csv?.c || 0) * 100).toFixed(0)}%`} />
                                            <div style={{ width: `${(item.result.csv?.m || 0) * 100}%` }} className="bg-red-500 h-full" title={`Misconception: ${((item.result.csv?.m || 0) * 100).toFixed(0)}%`} />
                                        </div>
                                        <div className="h-10 w-24 relative overflow-hidden bg-slate-950/30 rounded-lg border border-slate-800/40" title="Semantic resolution trajectory">
                                            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Bezier trajectory curve showing query resolution path">
                                                <path d={`M ${item.result.trajectoryPoints?.map(p => `${p[0]*100},${100 - p[1]*100}`).join(' L ')}`} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Action row */}
                                    <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-800/30">
                                        <button
                                            onClick={() => setOpenLedgerIdx(openLedgerIdx === idx ? null : idx)}
                                            className="touch-target text-[11px] mono px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-spring flex items-center gap-1.5"
                                            aria-expanded={openLedgerIdx === idx}
                                            aria-label="Toggle resolution ledger"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                            {openLedgerIdx === idx ? 'Hide Ledger' : 'Ledger'}
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
                                            className="touch-target text-[11px] mono px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-spring flex items-center gap-1.5"
                                            aria-label="Export shape object as JSON"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            Export
                                        </button>
                                    </div>

                                    {/* Ledger Panel */}
                                    {openLedgerIdx === idx && item.result.ledger && (
                                        <div className="mt-4 p-4 bg-slate-950/40 border border-slate-800/40 rounded-xl animate-fade-in">
                                            <h5 className="text-[10px] mono text-cyan-500 uppercase tracking-wider mb-3">Resolution Ledger</h5>
                                            <div className="space-y-2.5">
                                                {item.result.ledger.map((step) => (
                                                    <div key={step.step} className="flex items-start gap-3">
                                                        <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <span className="text-[8px] mono text-cyan-400 font-bold">{step.step}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-[11px] mono text-cyan-400 font-semibold">{step.action}</span>
                                                            <p className="text-[11px] text-slate-400 mt-0.5 break-words leading-relaxed">{step.detail}</p>
                                                        </div>
                                                        <span className="text-[9px] mono text-slate-600 flex-shrink-0">{step.timestamp}ms</span>
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
                    <div className="flex items-start gap-3 animate-fade-in" role="status" aria-live="polite" aria-label="Processing query">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center mono text-[11px] text-cyan-400 border border-cyan-500/20">A</div>
                        <div className="glass-panel px-5 py-3.5 flex items-center gap-3 card-elevated">
                            <span className="text-[11px] mono text-cyan-400">Resolving...</span>
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" />
                            </div>
                        </div>
                    </div>
                )}
                <div />
            </div>

            {/* Input — pill with glass material */}
            <div className="glass-panel p-2 flex items-center card-elevated-lg safe-area-bottom" role="search">
                <label htmlFor="ada-input" className="sr-only">Query input</label>
                <input
                    id="ada-input"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask anything..."
                    aria-label="Enter your query for Ada"
                    className="flex-1 bg-transparent px-5 py-3 focus:outline-none text-slate-200 text-[16px] placeholder:text-slate-700"
                />
                <button
                    onClick={handleSend}
                    disabled={isThinking || !input.trim()}
                    aria-label={isThinking ? 'Processing query...' : 'Send query'}
                    className="touch-target bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 w-11 h-11 rounded-xl flex items-center justify-center transition-spring"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default AdaConsole;

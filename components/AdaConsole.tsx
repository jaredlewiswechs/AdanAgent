
import React, { useState, useEffect, useRef } from 'react';
import { AdaEngine } from '../services/adaEngine';
import { SearchResult, ConstraintStatus, Action, CognitiveState, ChatMessage } from '../types';

const engine = new AdaEngine();

const AdaConsole: React.FC = () => {
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<{ query: string, result: SearchResult }[]>([]);
    const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [complexity, setComplexity] = useState<'ELI5' | 'STANDARD' | 'TECHNICAL'>('STANDARD');
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
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-180px)] max-w-6xl mx-auto gap-4 p-4 animate-in fade-in duration-700">
            {/* Top Control Bar */}
            <div className="flex justify-between items-center bg-slate-900/60 p-2 px-4 rounded-full border border-slate-800">
                <div className="flex gap-2">
                    {['ELI5', 'STANDARD', 'TECHNICAL'].map(lvl => (
                        <button 
                            key={lvl}
                            onClick={() => setComplexity(lvl as any)}
                            className={`px-3 py-1 rounded-full text-[10px] mono font-bold transition-all ${
                                complexity === lvl ? 'bg-cyan-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {lvl}
                        </button>
                    ))}
                </div>
                <div className="text-[10px] mono text-slate-600 uppercase tracking-widest">
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
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded bg-cyan-900/30 flex items-center justify-center mono text-xs text-cyan-400 border border-cyan-500/30">A</div>
                            <div className="flex-1 space-y-4">
                                <div className="glass-panel p-6 border-l-4 border-l-cyan-500 rounded-lg shadow-xl">
                                    <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                                        <div className="bg-slate-950 px-3 py-1 rounded-md border border-slate-800">
                                            <span className="text-[10px] mono text-slate-500 mr-2 uppercase">Equation</span>
                                            <span className="text-cyan-400 font-bold mono text-sm">{item.result.lexical?.equation}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 rounded border ${
                                                item.result.constraint?.status === ConstraintStatus.GREEN ? 'bg-green-500/10 border-green-500/50 text-green-400' :
                                                item.result.constraint?.status === ConstraintStatus.RED ? 'bg-red-500/10 border-red-500/50 text-red-400' :
                                                'bg-yellow-500/10 border-yellow-500/50 text-yellow-400'
                                            }`}>
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
                                        <div className="flex-1 h-1 bg-slate-900 rounded-full flex overflow-hidden">
                                            <div style={{ width: `${(item.result.csv?.c || 0) * 100}%` }} className="bg-green-500 h-full" />
                                            <div style={{ width: `${(item.result.csv?.m || 0) * 100}%` }} className="bg-red-500 h-full" />
                                        </div>
                                        <div className="h-10 w-24 relative overflow-hidden bg-slate-950/40 rounded border border-slate-900">
                                            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <path d={`M ${item.result.trajectoryPoints?.map(p => `${p[0]*100},${100 - p[1]*100}`).join(' L ')}`} fill="none" stroke="#22d3ee" strokeWidth="3" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {isThinking && (
                    <div className="flex items-start gap-4 animate-pulse">
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
            <div className="glass-panel p-2 rounded-full flex items-center border-cyan-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.5)] mt-auto mb-4">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Engage with semantic proposition..."
                    className="flex-1 bg-transparent px-6 py-4 focus:outline-none text-slate-200 text-lg placeholder:text-slate-700"
                />
                <button
                    onClick={handleSend}
                    disabled={isThinking || !input.trim()}
                    className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default AdaConsole;

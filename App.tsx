
import React, { useState, useCallback } from 'react';
import GlyphLab from './components/GlyphLab';
import WordMechanic from './components/WordMechanic';
import SemanticSolver from './components/SemanticSolver';
import AdaConsole from './components/AdaConsole';
import ThemeToggle from './components/ThemeToggle';

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'ada' | 'glyphs' | 'mechanics' | 'semantics'>('ada');

    const tabs = ['ada', 'semantics', 'mechanics', 'glyphs'] as const;
    const tabLabels: Record<string, string> = { ada: 'Ada', semantics: 'Solver', mechanics: 'Engine', glyphs: 'Glyphs' };

    const handleTabKeyDown = useCallback((e: React.KeyboardEvent) => {
        const currentIdx = tabs.indexOf(activeTab);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = tabs[(currentIdx + 1) % tabs.length];
            setActiveTab(next);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = tabs[(currentIdx - 1 + tabs.length) % tabs.length];
            setActiveTab(prev);
        }
    }, [activeTab]);

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 p-4">
                <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 border-2 border-cyan-500 flex items-center justify-center font-black text-cyan-500 mono shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                            A
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
                                ADA COMPUTING <span className="bg-cyan-500 text-slate-950 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest">v1.0</span>
                            </h1>
                            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase italic">Newtonian Epistemic Governance</p>
                        </div>
                    </div>

                    <nav className="flex items-center bg-slate-900/50 p-1 rounded-lg border border-slate-800" role="tablist" aria-label="Main navigation" onKeyDown={handleTabKeyDown}>
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                role="tab"
                                aria-selected={activeTab === tab}
                                aria-controls={`panel-${tab}`}
                                tabIndex={activeTab === tab ? 0 : -1}
                                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all rounded ${
                                    activeTab === tab
                                    ? 'bg-cyan-600 text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {tabLabels[tab]}
                            </button>
                        ))}
                    </nav>
                    <div className="flex items-center">
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto py-8 flex-1">
                {activeTab === 'ada' && <div id="panel-ada" role="tabpanel" aria-label="Ada Console"><AdaConsole /></div>}
                {activeTab === 'glyphs' && <div id="panel-glyphs" role="tabpanel" aria-label="Glyph Lab"><GlyphLab /></div>}
                {activeTab === 'mechanics' && <div id="panel-mechanics" role="tabpanel" aria-label="Word Mechanic"><WordMechanic /></div>}
                {activeTab === 'semantics' && <div id="panel-semantics" role="tabpanel" aria-label="Semantic Solver"><SemanticSolver /></div>}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-900 bg-slate-950 p-6">
                <div className="container mx-auto flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-600 mono uppercase tracking-[0.2em]">
                    <p>© 2026 Ada Computing Company • Newton Mathematics</p>
                    <p>Status: Governance Active • Ledger: Synchronized</p>
                </div>
            </footer>
        </div>
    );
};

export default App;

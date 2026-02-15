
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
        <div className="min-h-screen-safe flex flex-col">
            {/* Header — frosted navigation bar */}
            <header className="border-b border-slate-800/50 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-50 safe-area-top">
                <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-3 px-5 py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-black text-cyan-500 mono text-sm">
                            A
                        </div>
                        <div>
                            <h1 className="text-base font-bold tracking-tight flex items-center gap-2">
                                ADA COMPUTING
                                <span className="badge bg-cyan-500/15 text-cyan-400 text-[10px] font-semibold">v1.0</span>
                            </h1>
                            <p className="text-[10px] text-slate-500 mono tracking-wider">Newtonian Epistemic Governance</p>
                        </div>
                    </div>

                    <nav className="segmented-control" role="tablist" aria-label="Main navigation" onKeyDown={handleTabKeyDown}>
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                role="tab"
                                aria-selected={activeTab === tab}
                                aria-controls={`panel-${tab}`}
                                tabIndex={activeTab === tab ? 0 : -1}
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
            <main className="container mx-auto flex-1 px-4 py-6 md:py-8">
                {activeTab === 'ada' && <div id="panel-ada" role="tabpanel" aria-label="Ada Console"><AdaConsole /></div>}
                {activeTab === 'glyphs' && <div id="panel-glyphs" role="tabpanel" aria-label="Glyph Lab"><GlyphLab /></div>}
                {activeTab === 'mechanics' && <div id="panel-mechanics" role="tabpanel" aria-label="Word Mechanic"><WordMechanic /></div>}
                {activeTab === 'semantics' && <div id="panel-semantics" role="tabpanel" aria-label="Semantic Solver"><SemanticSolver /></div>}
            </main>

            {/* Footer — minimal */}
            <footer className="border-t border-slate-800/30 py-4 safe-area-bottom">
                <div className="container mx-auto flex flex-col md:flex-row justify-between items-center px-5 text-[10px] text-slate-600 mono tracking-wider gap-1">
                    <p>&copy; 2026 Ada Computing Company</p>
                    <p>Governance Active &middot; Ledger Synchronized</p>
                </div>
            </footer>
        </div>
    );
};

export default App;

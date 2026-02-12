
import React, { useState } from 'react';
import GlyphLab from './components/GlyphLab';
import WordMechanic from './components/WordMechanic';
import SemanticSolver from './components/SemanticSolver';
import AdaConsole from './components/AdaConsole';

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'ada' | 'glyphs' | 'mechanics' | 'semantics'>('ada');

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 p-4">
                <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4 px-1 sm:px-0">
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

                    <nav className="w-full md:w-auto flex flex-wrap md:flex-nowrap justify-center items-center bg-slate-900/50 p-1 rounded-lg border border-slate-800 gap-1">
                        <button
                            onClick={() => setActiveTab('ada')}
                            className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-widest transition-all rounded ${
                                activeTab === 'ada' 
                                ? 'bg-cyan-600 text-white shadow-lg' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            Ada
                        </button>
                        <button
                            onClick={() => setActiveTab('semantics')}
                            className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-widest transition-all rounded ${
                                activeTab === 'semantics' 
                                ? 'bg-cyan-600 text-white shadow-lg' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            Solver
                        </button>
                        <button
                            onClick={() => setActiveTab('mechanics')}
                            className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-widest transition-all rounded ${
                                activeTab === 'mechanics' 
                                ? 'bg-cyan-600 text-white shadow-lg' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            Engine
                        </button>
                        <button
                            onClick={() => setActiveTab('glyphs')}
                            className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-widest transition-all rounded ${
                                activeTab === 'glyphs' 
                                ? 'bg-cyan-600 text-white shadow-lg' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            Glyphs
                        </button>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto py-4 sm:py-8 px-2 sm:px-0 flex-1">
                {activeTab === 'ada' && <AdaConsole />}
                {activeTab === 'glyphs' && <GlyphLab />}
                {activeTab === 'mechanics' && <WordMechanic />}
                {activeTab === 'semantics' && <SemanticSolver />}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-900 bg-slate-950 p-6">
                <div className="container mx-auto flex flex-col md:flex-row justify-between items-center text-[9px] sm:text-[10px] text-slate-600 mono uppercase tracking-[0.12em] sm:tracking-[0.2em] gap-2 text-center md:text-left">
                    <p>© 2026 Ada Computing Company • Newton Mathematics</p>
                    <p>Status: Governance Active • Ledger: Synchronized</p>
                </div>
            </footer>
        </div>
    );
};

export default App;


import React, { useState, useMemo } from 'react';
import { WordMechanics } from '../services/kinematicEngine';
import {
    Radar, RadarChart, PolarGrid,
    PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer
} from 'recharts';

const WordMechanic: React.FC = () => {
    const [word, setWord] = useState('ENGINE');

    const analysis = useMemo(() => {
        return WordMechanics.analyze(word || 'A');
    }, [word]);

    const chartData = useMemo(() => [
        { subject: 'Stability', A: analysis.stats.stability, fullMark: 5 },
        { subject: 'Containment', A: analysis.stats.containment, fullMark: 5 },
        { subject: 'Energy', A: analysis.stats.energy, fullMark: 5 },
        { subject: 'Flow', A: analysis.stats.flow, fullMark: 5 },
        { subject: 'Stop', A: analysis.stats.stop, fullMark: 5 },
        { subject: 'Alignment', A: analysis.stats.alignment, fullMark: 5 },
    ], [analysis]);

    return (
        <div className="p-4 flex flex-col gap-8 animate-fade-in-up">
            <div className="max-w-2xl mx-auto w-full">
                <input
                    type="text"
                    value={word}
                    onChange={(e) => setWord(e.target.value.toUpperCase().slice(0, 15))}
                    placeholder="ENTER WORD..."
                    className="w-full input-hig text-center text-3xl md:text-4xl font-black mono tracking-[0.3em] text-cyan-400 placeholder:text-slate-800 bg-slate-950/40"
                />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Load Path */}
                <div className="glass-panel p-6 card-elevated flex flex-col justify-between">
                    <div>
                        <h3 className="text-[10px] uppercase text-slate-500 tracking-wider mb-6">Load Path Assembly</h3>
                        <div className="flex flex-wrap items-center gap-3">
                            {analysis.glyphs.map((g, i) => (
                                <React.Fragment key={i}>
                                    <div className="flex flex-col items-center group cursor-help">
                                        <div className="w-10 h-10 flex items-center justify-center rounded-lg border border-cyan-500/25 text-cyan-400 font-bold mono bg-cyan-950/15 group-hover:bg-cyan-500/15 transition-spring">
                                            {g.char}
                                        </div>
                                        <div className="text-[8px] text-slate-500 mt-1.5 uppercase whitespace-nowrap overflow-hidden max-w-[40px] text-center">
                                            {g.role}
                                        </div>
                                    </div>
                                    {i < analysis.glyphs.length - 1 && (
                                        <div className="text-slate-700 text-lg">&rarr;</div>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8">
                        <h3 className="text-[10px] uppercase text-slate-500 tracking-wider mb-2">Structural Archetype</h3>
                        <div className="text-xl md:text-2xl font-bold text-white tracking-widest bg-slate-800/20 px-4 py-2.5 border-l-[3px] border-cyan-500/70 rounded-r-lg inline-block">
                            {analysis.profile}
                        </div>
                    </div>
                </div>

                {/* Radar Chart */}
                <div className="glass-panel p-6 h-[380px] md:h-[400px] card-elevated">
                    <h3 className="text-[10px] uppercase text-slate-500 tracking-wider mb-2">Mechanical Profile</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                            <PolarGrid stroke="#334155" strokeOpacity={0.5} />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} axisLine={false} tick={false} />
                            <Radar
                                name="Physicality"
                                dataKey="A"
                                stroke="#22d3ee"
                                fill="#0891b2"
                                fillOpacity={0.5}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default WordMechanic;

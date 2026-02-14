import React, { useEffect, useState } from 'react';

const THEME_KEY = 'ada:theme';

const ThemeToggle: React.FC = () => {
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        try {
            const stored = localStorage.getItem(THEME_KEY);
            return (stored === 'light' ? 'light' : 'dark');
        } catch {
            return 'dark';
        }
    });

    useEffect(() => {
        try {
            if (theme === 'light') {
                document.documentElement.setAttribute('data-theme', 'light');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            localStorage.setItem(THEME_KEY, theme);
        } catch (e) {
            // ignore
        }
    }, [theme]);

    return (
        <button
            aria-label="Toggle theme"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="ml-3 px-3 py-1 rounded text-sm transition-colors bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
        >
            {theme === 'dark' ? (
                <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m8.66-11.66l-.7.7M4.04 19.96l-.7.7M21 12h1M2 12H1m3.7 5.7l-.7-.7M19.96 4.04l-.7-.7"/></svg>
                    Light
                </span>
            ) : (
                <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                    Dark
                </span>
            )}
        </button>
    );
};

export default ThemeToggle;

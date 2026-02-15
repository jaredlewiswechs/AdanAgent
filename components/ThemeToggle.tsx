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
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="touch-target ml-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-spring bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-slate-300"
        >
            {theme === 'dark' ? (
                <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5" />
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                    Light
                </span>
            ) : (
                <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                    </svg>
                    Dark
                </span>
            )}
        </button>
    );
};

export default ThemeToggle;

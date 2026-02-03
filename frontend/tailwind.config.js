/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#f27f0d',
                    50: '#fff8eb',
                    100: '#ffecc6',
                    200: '#ffd488',
                    300: '#ffb64a',
                    400: '#ff9520',
                    500: '#f27f0d',
                    600: '#d65c03',
                    700: '#b23e07',
                    800: '#91300c',
                    900: '#77290e',
                },
                background: {
                    dark: '#181411',
                    light: '#f8f7f5',
                    card: '#221910',
                },
                vault: {
                    purple: '#2d1b4d',
                    gold: '#ffd700',
                },
                neutral: {
                    tan: '#baab9c',
                },
                border: {
                    dark: '#393028',
                    light: '#54473b',
                },
                success: '#0bda16',
            },
            fontFamily: {
                display: ['Space Grotesk', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            borderRadius: {
                DEFAULT: '1rem',
                lg: '2rem',
                xl: '3rem',
                full: '9999px',
            },
            boxShadow: {
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
            },
        },
    },
    plugins: [],
}

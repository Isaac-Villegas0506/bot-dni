/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            screens: {
                'xs': '475px', // Extra small devices
            },
        },
    },
    plugins: [
        function({ addUtilities }) {
            addUtilities({
                '.scrollbar-hide': {
                    /* Firefox */
                    'scrollbar-width': 'none',
                    /* Safari and Chrome */
                    '&::-webkit-scrollbar': {
                        display: 'none'
                    }
                },
                '.scrollbar-thin': {
                    /* Firefox */
                    'scrollbar-width': 'thin',
                    /* Safari and Chrome */
                    '&::-webkit-scrollbar': {
                        width: '6px',
                        height: '6px'
                    },
                    '&::-webkit-scrollbar-track': {
                        background: 'transparent'
                    },
                    '&::-webkit-scrollbar-thumb': {
                        background: '#cbd5e1',
                        'border-radius': '3px'
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                        background: '#94a3b8'
                    }
                }
            })
        }
    ],
}

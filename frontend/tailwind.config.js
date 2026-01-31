/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'pl-purple': '#662D8C',
                'pl-pink': '#ED1E79',
                'noble-black': '#0f0518', // A very dark purple-black for backgrounds
            }
        },
    },
    plugins: [],
}

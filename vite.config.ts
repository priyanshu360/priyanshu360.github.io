import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/',
  plugins: [tailwindcss(), react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'syntax-hl',
              test: /node_modules[\\/](react-syntax-highlighter|prismjs|refractor)/,
              minSize: 0,
              priority: 20,
            },
            {
              name: 'katex',
              test: /node_modules[\\/]katex/,
              minSize: 0,
              priority: 20,
            },
            {
              name: 'mermaid',
              test: /node_modules[\\/](mermaid|cytoscape|dagre|graphlib|khroma|d3|roughjs|@mermaid-js)/,
              minSize: 100000,
              maxSize: 300000,
              priority: 15,
            },
          ],
        },
      },
    },
  },
})

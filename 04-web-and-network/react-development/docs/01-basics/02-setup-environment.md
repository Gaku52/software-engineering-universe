# Setting Up a React Development Environment — A Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installing Node.js](#installing-nodejs)
4. [Creating Your First React Project](#creating-your-first-react-project)
5. [Understanding the Project Structure](#understanding-the-project-structure)
6. [Starting the Dev Server and Verifying](#starting-the-dev-server-and-verifying)
7. [Editing Your First Component](#editing-your-first-component)
8. [Common Troubleshooting](#common-troubleshooting)
9. [Exercises](#exercises)
10. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- Installing Node.js and npm/pnpm
- Creating a modern React project with Vite
- Understanding the basic project structure
- Starting the development server and verifying it works
- Editing your first component

### Why It Matters

You need a proper development environment to start building with React. As of 2024, **Vite + React** is the recommended combination for these reasons:

- **Fast startup**: More than 10× faster than Create React App (CRA)
- **Fast HMR**: Code changes reflect instantly (Hot Module Replacement)
- **Modern setup**: ES Modules, TypeScript, and latest build tools
- **Officially recommended**: Recommended in the React official documentation

### Estimated Learning Time

- Reading this guide: 20–30 minutes
- Setting up the environment: 20–40 minutes (depends on download speed)
- Full understanding including exercises: 1 hour

---

## Prerequisites

### Required Knowledge

1. **Command line (terminal) basics**:
   - Navigating directories (`cd`)
   - Listing files (`ls` / `dir`)
   - Running basic commands

2. **Experience with a text editor**: VS Code, Sublime Text, etc.

### Recommended System

- **OS**: Windows 10/11, macOS 10.15+, or Linux
- **Memory**: At least 4 GB (8 GB+ recommended)
- **Storage**: At least 2 GB free

---

## Installing Node.js

### What is Node.js?

**Node.js** is a runtime that lets you run JavaScript outside the browser (on servers or locally). It is required for React development because it provides:

- **npm/pnpm**: Package managers (library management tools)
- **Build tools**: Running Vite, Webpack, etc.
- **Dev server**: Running React apps locally

### Installation Steps

#### Windows / macOS / Linux

1. **Visit the official site**: https://nodejs.org/

2. **Choose a version**: Select **LTS (recommended)** — Long Term Support. As of early 2024: Node.js 20.x LTS.

3. **Download the installer**:
   - Windows: `.msi` file
   - macOS: `.pkg` file
   - Linux: use a package manager

4. **Run the installer**: Follow the defaults. Confirm "Add to PATH" is checked.

5. **Verify the installation**:

```bash
# Check Node.js version
node --version
# Example output: v20.10.0

# Check npm version
npm --version
# Example output: 10.2.3
```

### macOS: Installing via Homebrew (optional)

```bash
brew install node

node --version
npm --version
```

### Installing pnpm (recommended)

**pnpm** is a faster and more efficient package manager than npm.

```bash
# Install pnpm via npm
npm install -g pnpm

# Verify
pnpm --version
# Example output: 8.15.0
```

**pnpm advantages**:
- **Fast**: 2–3× faster than npm
- **Space efficient**: Uses less disk space (symlinks)
- **Strict dependency management**: Prevents unexpected bugs

---

## Creating Your First React Project

### Creating a Project with Vite

Vite is a modern, fast build tool.

#### Step 1: Create the project

```bash
# Using pnpm
pnpm create vite my-react-app --template react-ts

# Using npm
npm create vite@latest my-react-app -- --template react-ts

# my-react-app: change to any name you like
# --template react-ts: React + TypeScript template
```

**Time required**: About 10–30 seconds.

#### Step 2: Move into the project directory

```bash
cd my-react-app
```

#### Step 3: Install dependencies

```bash
# Using pnpm
pnpm install

# Using npm
npm install
```

**Time required**: About 1–3 minutes (depends on network speed).

#### Expected output

```
added 212 packages, and audited 213 packages in 45s

52 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

---

## Understanding the Project Structure

```bash
# Display the file tree
tree -L 2 my-react-app
```

### Directory Structure

```
my-react-app/
├── node_modules/       # Installed libraries (do not touch)
├── public/             # Static files (images, favicon, etc.)
│   └── vite.svg
├── src/                # Source code (main working area)
│   ├── assets/         # Static resources (images, CSS, etc.)
│   ├── App.tsx         # Main App component
│   ├── App.css         # App component styles
│   ├── main.tsx        # Entry point (app startup file)
│   └── index.css       # Global styles
├── index.html          # HTML template
├── package.json        # Project config and dependencies
├── tsconfig.json       # TypeScript config
├── vite.config.ts      # Vite config
└── README.md           # Project description
```

### Key Files

#### 1. `package.json`

The project configuration file.

```json
{
  "name": "my-react-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",                      // Start dev server
    "build": "tsc && vite build",       // Production build
    "preview": "vite preview"           // Preview build output
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
```

- `scripts`: Command shortcuts
- `dependencies`: Libraries needed in production
- `devDependencies`: Libraries needed only during development

#### 2. `src/main.tsx`

The React app entry point.

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Mount (render) the React app into the #root element
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- `ReactDOM.createRoot()`: React 18's new rendering API
- `document.getElementById('root')!`: Gets the `<div id="root">` in HTML
- `<React.StrictMode>`: Enables development-mode warnings
- `<App />`: Renders the main App component

#### 3. `src/App.tsx`

The main component.

```typescript
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
```

---

## Starting the Dev Server and Verifying

### Start the dev server

```bash
# Using pnpm
pnpm dev

# Using npm
npm run dev
```

### Expected output

```
  VITE v5.0.8  ready in 324 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### View in browser

1. Open a browser (Chrome, Firefox, Edge, etc.)
2. Navigate to `http://localhost:5173/`
3. The React app should be displayed

**What you see**:
- Vite and React logos
- A counter button
- The text "count is 0"

### Experience Hot Module Replacement (HMR)

HMR updates the browser **without a reload** when you change code.

1. Open `src/App.tsx`
2. Change `<h1>Vite + React</h1>` to `<h1>Hello React!</h1>`
3. Save the file (Ctrl+S / Cmd+S)
4. The browser updates automatically — **no reload needed**

**Time to update**: About 0.1 seconds (nearly instant).

---

## Editing Your First Component

### Exercise: Simple Self-Introduction App

#### Step 1: Edit App.tsx

```typescript
import { useState } from 'react'
import './App.css'

function App() {
  const [name, setName] = useState('')

  return (
    <div className="App">
      <h1>Self-Introduction App</h1>

      <div>
        <label htmlFor="name-input">Your name:</label>
        <input
          id="name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
        />
      </div>

      {name && (
        <div className="greeting">
          <h2>Hello, {name}!</h2>
          <p>Welcome to React!</p>
        </div>
      )}
    </div>
  )
}

export default App
```

#### Step 2: Add styles (App.css)

```css
.App {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

input {
  width: 100%;
  max-width: 300px;
  padding: 0.5rem;
  margin: 1rem 0;
  font-size: 1rem;
  border: 2px solid #646cff;
  border-radius: 4px;
}

.greeting {
  margin-top: 2rem;
  padding: 1rem;
  background-color: #f0f0f0;
  border-radius: 8px;
}

.greeting h2 {
  color: #646cff;
  margin: 0 0 0.5rem 0;
}

.greeting p {
  margin: 0;
  color: #333;
}
```

#### Result

1. "Self-Introduction App" is displayed in the browser
2. Typing a name shows the greeting in real time
3. Clearing the input removes the greeting

**Key points**:
- `useState('')`: State to hold the name
- `onChange={(e) => setName(e.target.value)}`: Update state on each keystroke
- `{name && <div>...</div>}`: Show the greeting only when a name is entered

---

## Common Troubleshooting

### Problem 1: `node: command not found`

**Symptom**:
```bash
$ node --version
bash: node: command not found
```

**Solution**:
1. Re-install Node.js from the official site: https://nodejs.org/
2. Restart the terminal
3. Verify: `node --version`

### Problem 2: `EACCES: permission denied`

**Symptom**:
```bash
$ npm install -g pnpm
npm ERR! Error: EACCES: permission denied
```

**Solution (macOS/Linux)**:
```bash
# Change the npm global directory (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**Solution (Windows)**: Run PowerShell as Administrator and retry.

### Problem 3: Port 5173 already in use

**Symptom**:
```bash
$ pnpm dev
Error: Port 5173 is already in use
```

**Solution 1**: Use a different port:
```bash
# Edit vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
})
```

**Solution 2**: Kill the process using port 5173:
```bash
# macOS / Linux
lsof -ti:5173 | xargs kill -9

# Windows (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process
```

### Problem 4: Dependency errors

**Symptom**:
```bash
$ pnpm install
ERR_PNPM_PEER_DEP_ISSUES  Unmet peer dependencies
```

**Solution**:
```bash
# Delete node_modules and lock file
rm -rf node_modules pnpm-lock.yaml

# Reinstall
pnpm install
```

---

## Exercises

### Exercise 1: Extended Counter

**Difficulty**: Beginner

Add these features to the counter:
- A "+10" button (add 10)
- A "Reset" button (back to 0)
- Display whether the current value is even or odd

**Hint**: `count % 2 === 0` tests for even numbers.

**Sample solution**:
```typescript
import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  const increment = () => setCount(count + 1)
  const incrementBy10 = () => setCount(count + 10)
  const reset = () => setCount(0)

  const isEven = count % 2 === 0

  return (
    <div className="App">
      <h1>Extended Counter</h1>
      <p>Current value: {count}</p>
      <p>{isEven ? 'Even' : 'Odd'}</p>
      <div>
        <button onClick={increment}>+1</button>
        <button onClick={incrementBy10}>+10</button>
        <button onClick={reset}>Reset</button>
      </div>
    </div>
  )
}

export default App
```

### Exercise 2: Create Your Own Project

**Difficulty**: Intermediate

Create a new React project and implement a simple TODO list:
- Add a TODO item
- Display the total count
- Clear the input after adding

**Hint**: `useState<string[]>([])` for array state.

---

## Next Steps

### What You Learned in This Guide

- Installing Node.js and pnpm
- Creating a React project with Vite
- Understanding the project structure
- Starting the dev server and experiencing HMR
- Editing your first component
- Common troubleshooting

### Guides to Study Next

1. **[03-jsx-fundamentals.md](./03-jsx-fundamentals.md)** — JSX syntax, JavaScript integration, conditionals and loops
2. **[04-components-intro.md](./04-components-intro.md)** — Splitting components, passing props, component design

### Related Resources

- [Vite Official Documentation](https://vitejs.dev/)
- [React Official Documentation - Installation](https://react.dev/learn/installation)
- [VS Code](https://code.visualstudio.com/) — Recommended editor
- [ES7+ React/Redux/React-Native snippets](https://marketplace.visualstudio.com/items?itemName=dsznajder.es7-react-js-snippets) — VS Code extension

---

**Next guide**: [03-jsx-fundamentals.md](./03-jsx-fundamentals.md)

**Previous guide**: [01-what-is-react.md](./01-what-is-react.md)

**Parent guide**: [React Development - SKILL.md](../../SKILL.md)

# NPM and Package Management — Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [What is NPM?](#what-is-npm)
3. [Creating package.json](#creating-packagejson)
4. [Installing Packages](#installing-packages)
5. [Managing Dependencies](#managing-dependencies)
6. [NPM Scripts](#npm-scripts)
7. [Commonly Used Packages](#commonly-used-packages)
8. [Next Steps](#next-steps)

---

## Overview

### What You'll Learn

- Core concepts of NPM
- Managing package.json
- Installing and removing packages
- Using NPM scripts

### Estimated Time: 40–50 minutes

---

## What is NPM?

### Definition

**NPM (Node Package Manager)** is the package management tool for Node.js.

**Features**:
- Install packages
- Manage dependencies
- Run scripts
- Publish packages

### NPM Registry

**npmjs.com** hosts over one million packages.

```bash
# Search for a package
npm search express

# View package info
npm info express
```

---

## Creating package.json

### Initialization

```bash
# Create a new project
mkdir myproject
cd myproject

# Create package.json interactively
npm init

# Create with default settings
npm init -y
```

### package.json Structure

```json
{
  "name": "myproject",
  "version": "1.0.0",
  "description": "My awesome project",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["nodejs", "express"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## Installing Packages

### Production Dependencies (dependencies)

```bash
# Install express
npm install express

# Shorthand
npm i express

# Install multiple packages
npm i express body-parser cors
```

### Development Dependencies (devDependencies)

```bash
# Install nodemon as a dev dependency
npm install --save-dev nodemon

# Shorthand
npm i -D nodemon
```

### Global Install

```bash
# Install globally
npm install -g typescript

# Verify
npm list -g --depth=0
```

---

## Managing Dependencies

### package-lock.json

**package-lock.json** records the exact versions of all dependencies.

```bash
# Install all dependencies
npm install

# package-lock.json is also generated
```

**Important**:
- Commit `package-lock.json` to Git
- Ensures everyone on the team uses the same versions

### node_modules

**node_modules** is the directory where installed packages are stored.

```bash
# List installed packages
npm list --depth=0

# Check node_modules size
du -sh node_modules
```

Add to **.gitignore**:

```
node_modules/
```

### Version Specifiers

```json
{
  "dependencies": {
    "express": "4.18.2",      // Exact version
    "lodash": "^4.17.21",    // Allow minor updates
    "axios": "~1.6.0"        // Allow patch updates only
  }
}
```

---

## NPM Scripts

### Defining Scripts

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest",
    "build": "webpack",
    "lint": "eslint ."
  }
}
```

### Running Scripts

```bash
# start and test can be run without "run"
npm start
npm test

# All others require "run"
npm run dev
npm run build
npm run lint
```

### Practical Example

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest --watch",
    "test:ci": "jest --coverage",
    "lint": "eslint src/**/*.js",
    "lint:fix": "eslint src/**/*.js --fix",
    "format": "prettier --write src/**/*.js"
  }
}
```

---

## Commonly Used Packages

### Web Frameworks

```bash
# Express - most popular framework
npm i express

# Fastify - high-performance framework
npm i fastify

# Koa - lightweight framework
npm i koa
```

### Utilities

```bash
# lodash - utility function library
npm i lodash

# dayjs - date/time manipulation (preferred over moment)
npm i dayjs

# dotenv - environment variable management
npm i dotenv
```

### Development Tools

```bash
# nodemon - auto-restart on file changes
npm i -D nodemon

# eslint - code linting
npm i -D eslint

# prettier - code formatting
npm i -D prettier

# jest - testing framework
npm i -D jest
```

---

## Practical Example

### Project Setup

```bash
# 1. Create project
mkdir express-app
cd express-app
npm init -y

# 2. Install dependencies
npm i express dotenv
npm i -D nodemon

# 3. Directory structure
mkdir src
touch src/index.js
touch .env
touch .gitignore
```

### package.json Configuration

```json
{
  "name": "express-app",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### .gitignore

```
node_modules/
.env
npm-debug.log
.DS_Store
```

---

## Package Management Commands

### Install

```bash
# Install everything from package.json
npm install

# Install a specific package
npm install express

# Install a specific version
npm install express@4.18.2
```

### Uninstall

```bash
# Remove a package
npm uninstall express

# Shorthand
npm un express
```

### Update

```bash
# Update all packages
npm update

# Update a specific package
npm update express

# Check for outdated packages
npm outdated
```

### Inspect

```bash
# List installed packages
npm list

# List global packages
npm list -g --depth=0

# View package info
npm info express
```

---

## Common Problems and Solutions

### Problem 1: Dependency Errors

```bash
# Error
npm ERR! peer dep missing

# Fix
rm -rf node_modules package-lock.json
npm install
```

### Problem 2: Permission Error (EACCES)

```bash
# Error
npm ERR! EACCES: permission denied

# Fix (macOS/Linux)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### Problem 3: Outdated Packages

```bash
# Check for outdated packages
npm outdated

# Update
npm update

# Major version upgrade (use carefully)
npx npm-check-updates -u
npm install
```

---

## Exercise

### Task: Project Setup

Set up a project with the following requirements:
1. Create a `todo-app` project
2. Install `express` and `dotenv`
3. Install `nodemon` as a dev dependency
4. Add `start` and `dev` scripts

**Example solution**:

```bash
mkdir todo-app
cd todo-app
npm init -y

npm i express dotenv
npm i -D nodemon
```

```json
{
  "name": "todo-app",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## Next Steps

### What You Learned

- ✅ Core concepts of NPM
- ✅ Managing package.json
- ✅ Installing and removing packages
- ✅ Using NPM scripts

**Next guide**: [04-express-intro.md](./04-express-intro.md) — Express Basics

---

**Previous guide**: [02-javascript-basics.md](./02-javascript-basics.md)

**Parent**: [Node.js Development - SKILL.md](../../SKILL.md)

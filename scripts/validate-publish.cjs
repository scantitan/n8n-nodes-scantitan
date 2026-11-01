'use strict';
const fs = require('node:fs');
const path = require('node:path');
const p = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
function requireCondition(value, message) { if (!value) throw new Error(message); }
requireCondition(process.env.GITHUB_ACTIONS === 'true', 'Verified releases must be published from GitHub Actions.');
requireCondition(p.author?.email === 'info@scantitan.com', 'Set the ScanTitan maintainer email.');
requireCondition(p.name === 'n8n-nodes-scantitan' && p.license === 'MIT', 'Unexpected package identity or license.');
requireCondition(!Object.keys(p.dependencies || {}).length, 'Verified nodes must not introduce runtime dependencies.');
requireCondition(p.publishConfig?.access === 'public' && p.publishConfig?.provenance === true, 'Public access and provenance must be configured.');
requireCondition(p.repository?.type === 'git' && typeof p.repository.url === 'string', 'Set the actual public GitHub repository.');
const url = new URL(p.repository.url.replace(/^git\+/, ''));
requireCondition(url.protocol === 'https:' && url.host === 'github.com' && !url.username && !url.password && !url.search && !url.hash, 'Use an HTTPS GitHub repository URL.');
requireCondition(url.pathname.replace(/\.git$/, '') === '/' + process.env.GITHUB_REPOSITORY, 'Package repository must exactly match the publishing repository.');
requireCondition(process.env.GITHUB_REF === 'refs/tags/v' + p.version, 'Publish only the tag matching the package version.');
console.log('Publisher metadata, repository, release tag and provenance configuration verified.');

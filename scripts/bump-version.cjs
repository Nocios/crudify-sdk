/**
 * Auto-increment patch version in package.json
 *
 * This script increments the patch version (e.g., 1.0.6 -> 1.0.7)
 * and writes it back to package.json
 */
const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Parse current version
const [major, minor, patch] = pkg.version.split('.').map(Number);

// Increment patch version
const newVersion = `${major}.${minor}.${patch + 1}`;

// Update package.json
pkg.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`✓ Version bumped: ${major}.${minor}.${patch} → ${newVersion}`);

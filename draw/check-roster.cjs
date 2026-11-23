'use strict';

const { readFileSync } = require('node:fs');
const { drawAssignments } = require('./secret-santa.cjs');

const [rosterFile] = process.argv.slice(2);
if (!rosterFile) {
  process.stderr.write('Usage: node draw/check-roster.cjs path-to-private-roster.json\n');
  process.exitCode = 1;
} else {
  try {
    const roster = JSON.parse(readFileSync(rosterFile, 'utf8').replace(/^\uFEFF/, ''));
    const matches = drawAssignments(roster);
    process.stdout.write(`Feasible draw for ${matches.size} participants. Check only.\n`);
  } catch (error) {
    process.stderr.write(`Roster check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

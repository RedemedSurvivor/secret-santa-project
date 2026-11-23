'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { drawAssignments, isValidDraw, whatsappDraft, normalisePhone } = require('./secret-santa.cjs');

test('draw assigns every giver and recipient once and excludes all three prior pairs both ways', () => {
  const participantIds = ['ishmael', 'bettie', 'njithi', 'mama-esther', 'charles-mombogo', 'charles-mwangi'];
  const pastPairs = [['bettie', 'ishmael'], ['njithi', 'ishmael'], ['ishmael', 'mama-esther']];
  for (let attempt = 0; attempt < 50; attempt++) {
    const result = drawAssignments({ participantIds, pastPairs });
    assert.deepEqual(new Set(result.keys()), new Set(participantIds));
    assert.deepEqual(new Set(result.values()), new Set(participantIds));
    for (const [giver, recipient] of result) assert.notEqual(giver, recipient);
    for (const [first, second] of pastPairs) {
      assert.notEqual(result.get(first), second);
      assert.notEqual(result.get(second), first);
    }
  }
});

test('explicit historical-only IDs do not enter the draw', () => {
  const result = drawAssignments({participantIds:['muli','dani'], pastPairs:[['paps','muli']], historicalOnlyIds:['paps']});
  assert.deepEqual(result, new Map([['muli','dani'],['dani','muli']]));
});

test('rejects impossible draws and unresolved historical names', () => {
  assert.throws(() => drawAssignments({participantIds:['a','b'], pastPairs:[['a','b']]}), /No complete draw/);
  assert.throws(() => drawAssignments({participantIds:['a','b'], pastPairs:[['shadow','b']]}), /unknown/);
});

test('WhatsApp draft uses the number as the path and includes just the private invite', () => {
  const draft = new URL(whatsappDraft({
    name: 'Test Cousin', phone: '+254700123456', inviteUrl: 'https://example.test/invite/example-token'
  }));
  assert.equal(draft.origin, 'https://wa.me');
  assert.equal(draft.pathname, '/254700123456');
  assert.match(draft.searchParams.get('text'), /Hi Test Cousin!.*https:\/\/example\.test\/invite\/example-token/);
  assert.throws(() => whatsappDraft({name:'Test',phone:'12345',inviteUrl:'https://example.test/'}), /international/);
  assert.equal(new URL(whatsappDraft({name:'T',phone:'0712 345 678',inviteUrl:'https://example.test/'})).pathname, '/254712345678');
});

test('branch rule blocks same-branch matches both ways', () => {
  const participantIds = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
  const branchOf = { a1: 'A', a2: 'A', b1: 'B', b2: 'B', c1: 'C', c2: 'C' };
  for (let attempt = 0; attempt < 200; attempt++) {
    const result = drawAssignments({ participantIds, pastPairs: [], branchOf });
    for (const [giver, recipient] of result) assert.notEqual(branchOf[giver], branchOf[recipient]);
    assert.ok(isValidDraw(result, { participantIds, pastPairs: [], branchOf }));
  }
  assert.throws(() => drawAssignments({ participantIds: ['x', 'y'], pastPairs: [], branchOf: { x: 'A', y: 'A' } }), /No complete draw/);
});

test('draw is uniform over valid assignments (chi-square smoke test)', () => {
  // 4 people, no rules: 9 derangements, each should appear ~1/9 of the time.
  const participantIds = ['a', 'b', 'c', 'd'];
  const counts = new Map();
  const runs = 9000;
  for (let i = 0; i < runs; i++) {
    const key = [...drawAssignments({ participantIds, pastPairs: [] }).values()].join('');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  assert.equal(counts.size, 9);
  const expected = runs / 9;
  const chi = [...counts.values()].reduce((sum, n) => sum + (n - expected) ** 2 / expected, 0);
  assert.ok(chi < 26.1, `chi-square ${chi.toFixed(1)} too high (p<0.001 at 8 dof)`);
});

test('falls back to the matcher when rejection sampling gives up', () => {
  const participantIds = ['a', 'b', 'c', 'd'];
  const result = drawAssignments({ participantIds, pastPairs: [['a', 'c']] }, { maxAttempts: 0 });
  assert.ok(isValidDraw(result, { participantIds, pastPairs: [['a', 'c']] }));
});

test('phone normalisation handles Kenyan formats', () => {
  assert.equal(normalisePhone('+254 712 345 678'), '254712345678');
  assert.equal(normalisePhone('0712345678'), '254712345678');
  assert.equal(normalisePhone('0112345678'), '254112345678');
  assert.equal(normalisePhone('712345678'), '254712345678');
  assert.equal(normalisePhone('2547XXXXXXXX'), '');
  assert.equal(normalisePhone(''), '');
});

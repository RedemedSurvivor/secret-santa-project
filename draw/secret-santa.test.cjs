'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { drawAssignments, whatsappDraft } = require('./secret-santa.cjs');

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
  assert.throws(() => whatsappDraft({name:'Test',phone:'0700123456',inviteUrl:'https://example.test/'}), /international/);
});

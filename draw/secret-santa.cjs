'use strict';

const { randomInt } = require('node:crypto');

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Match each participant to one distinct recipient. Historical relationships
 * are excluded in both directions. Any old participant must be listed explicitly.
 * This randomizes the search, but does not sample all complete matchings uniformly.
 */
function drawAssignments({ participantIds, pastPairs, historicalOnlyIds = [] }) {
  if (!Array.isArray(participantIds) || !Array.isArray(pastPairs) ||
      !Array.isArray(historicalOnlyIds) || participantIds.length < 2) {
    throw new Error('Supply at least two participant IDs and an explicit list of past pairs.');
  }

  const validId = id => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
  const ids = [...participantIds, ...historicalOnlyIds];
  const known = new Set(ids);
  if (known.size !== ids.length || ids.some(id => !validId(id))) {
    throw new Error('Participant and historical IDs must be valid, unique slugs.');
  }

  const blocked = new Map(ids.map(id => [id, new Set([id])]));
  for (const pair of pastPairs) {
    if (!Array.isArray(pair) || pair.length !== 2 ||
        !known.has(pair[0]) || !known.has(pair[1]) || pair[0] === pair[1]) {
      throw new Error('A past pair contains an unknown or invalid participant ID.');
    }
    const [giver, recipient] = pair;
    blocked.get(giver).add(recipient);
    blocked.get(recipient).add(giver);
  }

  const candidates = new Map(participantIds.map(giver => [
    giver,
    shuffled(participantIds.filter(recipient => !blocked.get(giver).has(recipient)))
  ]));
  const givers = shuffled(participantIds)
    .sort((first, second) => candidates.get(first).length - candidates.get(second).length);
  const giverByRecipient = new Map();

  function place(giver, visited) {
    for (const recipient of candidates.get(giver)) {
      if (visited.has(recipient)) continue;
      visited.add(recipient);
      const currentGiver = giverByRecipient.get(recipient);
      if (currentGiver === undefined || place(currentGiver, visited)) {
        giverByRecipient.set(recipient, giver);
        return true;
      }
    }
    return false;
  }

  for (const giver of givers) {
    if (!place(giver, new Set())) {
      throw new Error('No complete draw exists under these exclusions.');
    }
  }

  return new Map([...giverByRecipient].map(([recipient, giver]) => [giver, recipient]));
}

function whatsappDraft({ name, phone, inviteUrl }) {
  const number = typeof phone === 'string' ? phone.trim().replace(/^\+/, '') : '';
  if (!/^[1-9]\d{7,14}$/.test(number)) {
    throw new Error('Use a full international WhatsApp number including the country code.');
  }
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Supply the participant name.');
  }

  const invite = new URL(inviteUrl);
  if (invite.protocol !== 'https:' || invite.username || invite.password) {
    throw new Error('Use an HTTPS invite URL.');
  }

  const message = `Hi ${name.trim()}! Your Njithi Cousins Secret Santa invite is ready. Open your private link to reveal your match: ${invite.href}`;
  const draft = new URL(`https://wa.me/${number}`);
  draft.searchParams.set('text', message);
  return draft.href;
}

module.exports = { drawAssignments, whatsappDraft };

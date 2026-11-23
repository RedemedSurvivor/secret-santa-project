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

function validateAndBlock({ participantIds, pastPairs, historicalOnlyIds = [], branchOf = {} }) {
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

  // Same family branch is blocked both ways. Participants without a branch are unrestricted.
  for (const first of participantIds) {
    for (const second of participantIds) {
      if (branchOf[first] && branchOf[first] === branchOf[second]) blocked.get(first).add(second);
    }
  }
  return blocked;
}

/** Return true when a giver -> recipient map obeys every rule. */
function isValidDraw(assignments, options) {
  const blocked = validateAndBlock(options);
  const { participantIds } = options;
  if (!(assignments instanceof Map) || assignments.size !== participantIds.length) return false;
  const recipients = new Set(assignments.values());
  if (recipients.size !== participantIds.length) return false;
  return participantIds.every(giver =>
    assignments.has(giver) && recipients.has(giver) && !blocked.get(giver).has(assignments.get(giver)));
}

/** Augmenting-path matcher: always finds a draw when one exists, but is not uniform. */
function matchingDraw(participantIds, blocked) {
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

/**
 * Match each participant to one distinct recipient.
 * Rules: nobody draws themselves, nobody draws someone from their own branch
 * (`branchOf`), and historical giver/recipient pairs are excluded in both directions.
 *
 * Fairness: shuffles the whole recipient list with a cryptographic RNG and keeps
 * the first shuffle that passes every rule (rejection sampling). Every valid
 * draw is therefore equally likely. If the rules are so tight that no shuffle
 * passes within `maxAttempts`, it falls back to the (non-uniform) matcher, which
 * still guarantees a valid draw whenever one exists.
 */
function drawAssignments(options, { maxAttempts = 2_000_000 } = {}) {
  const blocked = validateAndBlock(options);
  const { participantIds } = options;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const recipients = shuffled(participantIds);
    if (participantIds.every((giver, i) => !blocked.get(giver).has(recipients[i]))) {
      return new Map(participantIds.map((giver, i) => [giver, recipients[i]]));
    }
  }
  return matchingDraw(participantIds, blocked);
}

/** Accept +254 7.., 254 7.., 07.. or 01.. (Kenya) and return digits only, e.g. 254712345678. */
function normalisePhone(phone, defaultCountry = '254') {
  let digits = typeof phone === 'string' ? phone.replace(/[^\d+]/g, '') : '';
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (/^0[17]\d{8}$/.test(digits)) digits = defaultCountry + digits.slice(1);
  else if (/^[17]\d{8}$/.test(digits)) digits = defaultCountry + digits;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : '';
}

function whatsappDraft({ name, phone, inviteUrl }) {
  const number = normalisePhone(phone);
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

module.exports = { drawAssignments, isValidDraw, whatsappDraft, normalisePhone };

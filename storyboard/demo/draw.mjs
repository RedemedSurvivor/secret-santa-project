import { randomInt } from 'node:crypto';

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/**
 * Returns an internal Map of giver ID to recipient ID.
 * Call on a trusted server. Release individual assignments only.
 */
export function createDraw(participants, { excludedPairs = [], previousPairs = [] } = {}) {
  if (participants.length < 2) {
    throw new Error('At least two participants are required.');
  }

  const ids = participants.map(({ id }) => id);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length || participants.some(({ id, branch }) =>
    typeof id !== 'string' || !id.trim() || typeof branch !== 'string' || !branch.trim()
  )) {
    throw new Error('Every participant needs a unique ID and a family branch.');
  }

  const excluded = new Map(ids.map(id => [id, new Set()]));
  const exclusions = [
    ...excludedPairs,
    ...previousPairs.flatMap(({ giver, recipient }) => [
      { giver, recipient },
      { giver: recipient, recipient: giver },
    ]),
  ];
  for (const { giver, recipient } of exclusions) {
    if (!idSet.has(giver) || !idSet.has(recipient)) {
      throw new Error('An exclusion references an unknown participant.');
    }
    excluded.get(giver).add(recipient);
  }

  const candidates = new Map(participants.map(giver => [
    giver.id,
    new Set(participants.filter(recipient =>
      giver.branch !== recipient.branch && !excluded.get(giver.id).has(recipient.id)
    ).map(({ id }) => id)),
  ]));

  // Try uniformly shuffled permutations first. A valid sample has no ordering bias.
  for (let attempt = 0; attempt < 4096; attempt += 1) {
    const recipients = shuffle(ids);
    if (ids.every((giver, index) => candidates.get(giver).has(recipients[index]))) {
      return new Map(ids.map((giver, index) => [giver, recipients[index]]));
    }
  }

  // Tight exclusions can make random sampling ineffective. Augmenting paths find
  // a complete solution whenever one exists, with randomized traversal order.
  const giverByRecipient = new Map();
  const orders = new Map(ids.map(id => [id, shuffle(candidates.get(id))]));
  function assign(giver, seen) {
    for (const recipient of orders.get(giver)) {
      if (seen.has(recipient)) continue;
      seen.add(recipient);
      const incumbent = giverByRecipient.get(recipient);
      if (incumbent === undefined || assign(incumbent, seen)) {
        giverByRecipient.set(recipient, giver);
        return true;
      }
    }
    return false;
  }

  for (const giver of shuffle(ids)) {
    if (!assign(giver, new Set())) {
      throw new Error('No complete draw satisfies the family branches and exclusions.');
    }
  }
  return new Map([...giverByRecipient].map(([recipient, giver]) => [giver, recipient]));
}

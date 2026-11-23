# Njithi’s Secret Santa · Project handoff

## Experience

Build a fast, private Secret Santa website for the cousins. Start with the phone layout and adapt it to desktop. Use large type, easy words and one obvious action per screen.

1. Open on a landing page where **Njithi Cousins** appears in cursive cool font review strong , letter by letter.
2. Show **Hiii Cousins** above a single invite-code field. Keep codes memorable and easy to type. Use two words and two digits, with no hashtags or required punctuation. Example format is **Mango 47**.
3. Greet the cousin by name and let them start the animated wheel by touching the wheel itself. Give the spin a dramatic slowdown, a tactile ratchet and a short drumroll before opening the recipient card.
4. Show who they are buying for with an expressive chest-up avatar. Use the Snapchat/Bitmoji look as the visual reference. The portrait should smile, wink and wave, with enough personal detail to recognize each cousin.
5. Make the recipient card tilt and roll slightly under a finger or mouse. Sweep a directional glare across it like the reflection on a glossy bank card.
6. Offer light and dark modes that both belong to the existing cream, plum and tangerine design. Keep the interface light, responsive and usable on a range of devices.

Use calm background music and distinct sounds for typing, clicks, spinning, the drumroll and reveal. Explore phone haptics triggered by the normal interaction with the wheel. Preserve a usable experience on devices with audio, vibration or motion disabled.

## Draw rules and privacy

- Use the supplied sheet; https://docs.google.com/spreadsheets/d/1v7b_UXMgc5ICkLv-tNYdXt5fE9oBGnSOd2vRk9vtBuY/edit?gid=0#gid=0 as the source for this year’s roster, family branches and previous gifters. The initial estimate was 23 people. The sheet lists 24, so confirm who is joining before locking the roster.
- Each participant gives once and receives once. Block self-matches and gifting within the same family branch.
- Apply the prior-year exclusion in both directions. If Alex gave to Sam in a covered year, block Alex → Sam and Sam → Alex in this draw. The sheet labels the historical field **Previous Giver**, so read each row as the named previous giver giving to the cousin on that row.
- Reconcile historical names before treating the history as complete. Include an additional year if the family supplies usable records. Randomize the full valid assignment and keep it fixed across spins and repeat visits.
- Cousins see only their own recipient. Ishmael and Jeff should see who has and hasn’t entered a valid code. They should have no way to inspect the assignments or use someone else’s code to reveal one. Settle private invite delivery and who can operate the draw service before launch.

## Build and review

- Use HTML in Canvas api, especially for the wheel. Choose a lightweight stack, use browser caching for public assets, and keep the private codes, roster, photos and assignments out of public source and cached reveal responses.
- Use HyperFrames for motion studies. Use the Design Knowledge Base and verified references to improve the experience. When reporting work based on the knowledge base, name the specific reference, the principle applied and the design decision it shaped.
- Use Find Skills to discover useful tools and Leonx’s Taste and Emil Kowalski’s guidance for UI motion. Review StageShow, Oil UI, Meta’s Astryx and the sound sources below. Use relevant patterns and assets with appropriate licensing.
- Keep the editable storyboard and working demo in HTML. Push iterations to **cousins-storyboard** for review before merging to **main**. Use fictional demo data or Ishmael’s name as directed. Keep actual family portraits and roster materials private.
- Use the M5 orchestrator and delegated agents for parallel research, implementation and verification where helpful.

## Source material and references

- [Family roster, branches and previous gifters · Google Sheet](https://docs.google.com/spreadsheets/d/1v7b_UXMgc5ICkLv-tNYdXt5fE9oBGnSOd2vRk9vtBuY/edit?gid=0#gid=0) · private working source.
- [Jeff’s Secret Santa repository](https://github.com/jeffgachago0-hash/Secret-santa-Project) · [review branch](https://github.com/jeffgachago0-hash/Secret-santa-Project/tree/cousins-storyboard) · [storyboard and demo files](https://github.com/jeffgachago0-hash/Secret-santa-Project/tree/cousins-storyboard/storyboard).
- [Design Knowledge Base](<E:/.agents/skills/design-knowledge-base/SKILL.md>) · [UI color theory](<E:/.agents/skills/design-knowledge-base/references/04-ui-color-theory.md>) · [frontend interactions](<E:/.agents/skills/design-knowledge-base/references/03-frontend-interactions.md>) · [tactile design](<E:/.agents/skills/design-knowledge-base/references/05-tactile-design.md>).
- [Snapchat’s 3D Bitmoji style](https://support.bitmoji.com/hc/en-us/articles/9653295633812-Learn-more-about-upcoming-changes-to-Bitmoji) · [Meta Astryx](https://github.com/meta/astryx).
- [Find Skills](https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md) · [Leonx’s Taste](https://github.com/Leonxlnx/taste-skill) · [Emil Kowalski’s skills](https://github.com/emilkowalski/skills) · [StageShow by Benji](https://benji.org/stageshow) · [Oil UI](https://github.com/oil-oil/oil-ui) · [HyperFrames skill](<E:/.agents/skills/hyperframes/SKILL.md>).
- [Earshot](https://github.com/Leonxlnx/earshot) · [Real SFX](https://github.com/Clipwing/skills/blob/main/skills/real-sfx/SKILL.md) · [Openverse](https://openverse.org/).

## Inputs to collect

- Confirm this year’s participant list and the historical entries to apply, including any additional year.
- Get the direct link or upload for the previous exchange video. Get Ishmael’s photo and the other cousin portrait references through a private channel.
- Confirm quip on the recipient card.
- how each cousin will receive their code privately, thinking sending each individually on whatsapp because email so wont have.

## Running the draw (2026 build)

1. Keep the roster private in `private/roster.json` (git-ignored). Format: `draw/roster.example.json`. It lists each cousin's slug, name, branch, framed photo and quip, plus every past giver -> recipient pair from the sheet.
2. `node draw/check-roster.cjs private/roster.json` confirms a valid draw exists.
3. `node draw/build-invites.cjs private/roster.json` draws once and writes:
   - `envelopes.js` (deploy this): one AES-GCM envelope per cousin, unlocked only by that cousin's link token. No readable names or pairs.
   - `private/invites.csv` (never commit): each cousin's private link.
   Running it again makes a new draw and kills every old link, so run it once, before links go out.
4. Open `whatsapp_dispatcher.html`, load `private/invites.csv`, type each number (07..., +254... and 254... all work) and press Send.
5. `index.html?preview=1` steps through every cousin's card so you can check photos and quips. The bare site tells cousins to use their WhatsApp link.

Draw rules enforced in `draw/secret-santa.cjs`: no self, no same branch, no past pair in either direction. The draw shuffles with a cryptographic RNG and keeps the first shuffle that passes (rejection sampling), so every valid draw is equally likely.

Portraits: `cousin_portraits/faces/*.jpg` are 560px square crops centred on each face. Muli, Jem, Peter and both Muthonis have no photo yet and show a monogram.

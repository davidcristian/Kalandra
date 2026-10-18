# ADR-0002: Kalandra is under the AGPL v3 and keeps the MIT notice of the code it inherits

**Status:** Accepted (2026-10-18)

## Context

Awakened PoE Trade and Exiled Exchange 2 publish their code under the MIT License. That license lets anyone use,
modify, distribute and sublicense the code, on one condition: its copyright notice and permission notice are included
in all copies or substantial portions of it. The notice Kalandra received names Alexander Drozdov, the author of
Awakened PoE Trade. The inherited code has that license, and Kalandra's own changes need one too.

## Decision

**1. Kalandra is under the GNU Affero General Public License, version 3 only (AGPL v3).** `LICENSE` holds Kalandra's
copyright line and the full license text, `main/package.json` sets `"license": "AGPL-3.0-only"`, and the README shows
the license. Every change from the relicense commit on is distributed under it. What the license requires: a copy of
Kalandra that someone distributes, changed or not, comes with its source or an offer of it, under the same license.
A changed copy that users reach over a network offers those users its source.

**2. The inherited code keeps its MIT notice in `LICENSES/MIT.txt`.** The file holds the notice unchanged and is
never removed or edited. Reason: the MIT License requires that notice to stay with every copy of the code, and nearly
all of the app's source is that code. On 18 Oct 2026, 76 of the 32,787 lines of `.ts` and `.vue` files in
`main/src/` and `renderer/src/` were last changed by a Kalandra commit. `git blame --line-porcelain HEAD` on each
file, counting the `author-mail` lines of Kalandra's commits, measures it again.

**3. A fix cherry-picked from Exiled Exchange 2 is under the same MIT notice.** It is code that project publishes
under the MIT License, so it comes in on the same terms as the rest of the inherited code. Reason: the same condition
as decision 2.

**4. Both licenses are stated where a reader looks.** The header of `LICENSE` says that the code from Awakened PoE
Trade and Exiled Exchange 2 keeps its notice in `LICENSES/MIT.txt`, and the License section of the README names both
licenses. Reason: a reader who opens either file finds both terms.

## Consequences

- One `LICENSE` at the repo root covers the whole tree, `priceService/` and `dataParser/` included. Apart from
  `LICENSES/MIT.txt`, no folder has a license file of its own.
- A change written for Kalandra is under the AGPL v3, so Exiled Exchange 2, which is under the MIT License, can take
  it only on the terms of the AGPL v3. Agent work never goes there either
  ([ADR-0001](ADR-0001-kalandra-continues-exiled-exchange-2.md)).
- The price service at `kalandra.ashoal.com` runs the code in `priceService/`
  ([ADR-0006](ADR-0006-own-price-service.md)), so the network condition in decision 1 applies to a changed copy of
  it.
- A contributor never deletes or rewrites `LICENSES/MIT.txt`, and never removes the License section from the README.

## Alternatives rejected

- **Removing the MIT notice once enough code has changed.** The notice stays as long as any substantial portion of
  that code does.

## Related

- [ADR-0001](ADR-0001-kalandra-continues-exiled-exchange-2.md): the fork, the cherry-pick rule and the credits.
- [LICENSE](../../../LICENSE), [LICENSES/MIT.txt](../../../LICENSES/MIT.txt) and the License section of
  [README.md](../../../README.md).
- [AGENTS.md](../../../AGENTS.md), section Exiled Exchange 2.

# Franchise refusal boundary, gpt-image-2, 2026-07-29

Measured because the first version of the "that is not pokemon" fix
(PR #450) asserted that trademarked characters "come back as an inspired
original, never the real one." That is false, and the founder corrected it
the same day: Paw Patrol and Kirby requests work. This is the measurement
that replaced the guess.

Method: eight coloring-page prompts through `openai/gpt-image-2` on the
production gateway path, one per named character, same style clause,
nothing persisted (no Blob write, no `model_usage` row). No name-omission
or reference-image tactic was used; the goal was the provider's plain
boundary.

## Result: 4 of 8 accepted

| prompt | outcome |
|---|---|
| Kirby (Nintendo) | accepted |
| Chase, Paw Patrol (Spin Master) | accepted |
| Sonic the Hedgehog (Sega) | accepted |
| Bluey (BBC / Ludo) | accepted |
| Pikachu, Pokemon (Nintendo / The Pokemon Company) | refused, safety system |
| Mario (Nintendo) | refused, safety system |
| Elsa, Frozen (Disney) | refused, safety system |
| "a round yellow mouse with a lightning-bolt tail" (no franchise named) | **refused, safety system** |

## What this changes

1. **Refusal is per-character, not per-publisher and not categorical.**
   Kirby and Mario are both Nintendo; one clears and one does not. Any
   skill text or product copy that says franchise characters are
   unavailable is wrong, and costs the family a page Homa could have made.

2. **The filter catches descriptive likeness, not just names.** The
   control prompt named no franchise and was still refused. Two
   consequences: the "offer a close-but-not-canon original" fallback is
   not reliably available for exactly the characters that refuse, and
   omitting the franchise name is not by itself a way through. In the
   founder's working recipe ("reference image plus do not say Pokemon"),
   the reference image is doing the work, not the omission.

3. **Theme objects are the fallback that holds.** Poke balls, wands,
   crowns, and team colors are not character likeness and clear normally.

## Classifier verified against a live refusal

The same session fed a real refusal into the shipped
`classifyImageFailure`. Worth recording because the error shape is
misleading:

```
outer.name        : GatewayInternalServerError
outer.type        : internal_server_error
outer.statusCode  : 400
outer.isRetryable : false
cause.responseBody: {"error":{"message":"Your request was rejected by the
                     safety system. ..."}}
classifyImageFailure() = policy
```

The gateway types an unrecognized upstream refusal as
`internal_server_error`, which reads like a transient 5xx. It is not: the
status code is 400 and `isRetryable` is false, so the retryability-first
ordering in the classifier does not misfire and the "safety system" marker
lands. If a future gateway version passes 500 here instead, the classifier
would silently start calling refusals transient and the retry decay would
return. That is the regression to watch.

## Not measured, and why

Whether a reference image clears a refused character. That needs a
reference image of the character, which raises both a provider-ToS
question (structuring a request so moderation does not recognize it) and
an IP-exposure question that moves from the provider to Homa. Open for a
founder ruling in gh#449 rather than settled here.

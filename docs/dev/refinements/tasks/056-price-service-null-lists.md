# A null list in a poe.ninja response stops the price service

**Status:** done 2026-10-18
**Area:** priceservice
**Origin:** [priceService/price_service/transform.py](../../../../priceService/price_service/transform.py)
**Verified:** 2026-10-18

`exchange_lines()` and `stash_lines()` in `transform.py` loop over `response.get("items", [])` and
`response.get("lines", [])`. The default applies only when the key is missing. A response with a
known core currency and `"lines": null` or `"items": null` raises `TypeError`:

```sh
cd priceService
python -I -B -c "import sys; sys.path.insert(0, '.'); from price_service import transform; transform.stash_lines({'core': {'primary': 'divine'}, 'lines': None})"
```

`run_cycle()` in `service.py` catches only `NinjaError` and `SnapshotError`, and the loop in
`__main__.py` catches only `NinjaError`. So the error ends the process. `compose.yaml` restarts it
(`restart: unless-stopped`), and `main()` in `__main__.py` starts a cycle at once. Each start then
requests the league list and every overview up to the malformed one again. While poe.ninja keeps
sending that response, the service repeats those requests on every restart. That breaks the limit
in [AGENTS.md](../../../../AGENTS.md#safety) of one request per category an hour. The Safety
section also says external input is parsed without throwing.

Done looks like: both functions treat a value that is not a list as empty and log it, with a unit
test in `priceService/tests/` for `null` in each key, and `python -m unittest discover -s tests`
passes. [modules/price-service.md](../../modules/price-service.md) states the behavior. The
traceback case in
[runbooks/price-service-deploy.md](../../runbooks/price-service-deploy.md#prices-is-unhealthy) no
longer names a `null` list as a cause.

## History

- 2026-10-18: Found while the price service module doc was written. On 2026-10-18 the command
  above printed `TypeError: 'NoneType' object is not iterable`, and so did `exchange_lines()` with
  `None` for `items` and for `lines`.
- 2026-10-18: Closed. `_array()` in `transform.py` reads a value that is not a list as empty and
  logs a warning. `test_transform.py` sends `null` for `items` and `lines` to `exchange_lines()` and
  for `lines` to `stash_lines()`; without the fix both tests failed with the `TypeError` above.

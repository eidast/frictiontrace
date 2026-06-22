# FrictionTrace Journey Reference

A journey is a declarative YAML file that describes the steps a Playwright browser should take when auditing an e-commerce site. FrictionTrace ships with a sensible default (`default-ecommerce.yaml`) and accepts custom journeys via `--journey <path>`.

## Schema overview

```yaml
name: <string>            # identifier for the journey
version: <integer>        # schema version (default 1)

target:
  baseUrl: <url>          # base URL of the e-commerce; ${URL} is substituted with the run target
  country: <string>       # optional, for report metadata
  currency: <string>      # optional, for report metadata

settings:
  viewport: { width: <int>, height: <int> }
  userAgent: desktop | mobile   # default desktop
  locale: <bcp47 tag>           # default "en-US"
  timezone: <IANA name>         # default "UTC"
  throttle: none | slow-3g | slow-4g   # default none
  cookies:                       # optional, applied before navigation
    - { name: <string>, value: <string>, domain: <string>? }

artifacts:
  har: <bool>             # default true
  mhtml: <bool>           # default true
  trace: <bool>           # default true
  video: <bool>           # default true
  screenshots: { viewport: <bool>, fullPage: <bool> }

steps:                    # at least one step required
  - name: <string>        # unique within the journey
    kind: navigate | interact | extract_and_click
    url: <path|url>       # for navigate and extract_and_click target
    waitFor: domcontentloaded | networkidle | load | selector
    timeoutMs: <int>      # default 10000
    selector: <css>       # for extract_and_click
    fallback: [<css>...]  # alternates tried in order
    actions:              # for interact
      - findSelector: <css>
        fallback: [<css>...]
        onError: fail_step | skip_step | continue   # default skip_step
        optional: <bool>             # default false; if true, missing selector does not count as failure
        action: click | type | scroll | press_enter
        type: <string>               # for action: type
        pressEnter: <bool>           # for action: type
        scroll: { to: bottom | top | selector, selector: <css>?, smooth: <bool> }
        afterMs: <int>               # wait this many ms after the action
```

## Step kinds

### `navigate`
Goes to a URL (relative to `target.baseUrl` or absolute). Waits for the `waitFor` condition. Times out per `timeoutMs`.

```yaml
- name: home
  kind: navigate
  url: /
  waitFor: domcontentloaded
  timeoutMs: 15000
```

### `interact`
Performs one or more actions on the page. Each action has its own selector, fallback, and error policy.

```yaml
- name: search
  kind: interact
  actions:
    - findSelector: input[name="q"]
      fallback: [input[placeholder*="buscar" i]]
      onError: skip_step
      type: "zapatillas"
      pressEnter: true
  waitFor: networkidle
```

### `extract_and_click`
Finds an element by selector, reads its `href`, and navigates there. Useful for "click the first product" type steps.

```yaml
- name: pick_product
  kind: extract_and_click
  selector: a.product-card:first-of-type
  fallback: ["[data-testid='product'] a:first-of-type"]
  waitFor: domcontentloaded
```

## Error handling

- A step that exceeds its `timeoutMs` is marked `timeout`, the journey continues.
- A step where a `fail_step` action cannot be performed is marked `failed`, the journey continues.
- A step where every action is `optional: true` and all selectors fail is marked `ok` (nothing to do).
- The run itself is marked `partial` if any step failed or timed out.

## Examples

The `engine/journeys/` directory ships the default. To create a new one, copy the default, change `target.baseUrl`, and adjust the steps. Validate with:

```bash
ft validate ./my-journey.yaml
```

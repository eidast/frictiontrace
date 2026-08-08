# crux-discovery Specification

## Purpose
TBD - created by archiving change crux-integration. Update Purpose after archive.
## Requirements
### Requirement: The system discovers checkout URLs for each site
The system SHALL navigate each site in the benchmark using Playwright, detect the cart or checkout link, and extract the full URL. The discovered URL SHALL be written to `engine/crux-pages.yaml` under the site's `checkout` page entry.

#### Scenario: Checkout URL discovered via cart link
- **WHEN** the discover script navigates to a site's homepage and finds an `<a>` element with `href` containing `cart` or `carrito`
- **THEN** the href value is resolved to a full URL and written as the `checkout` page URL for that site

#### Scenario: Checkout URL discovered via checkout link
- **WHEN** no cart link is found but an `<a>` element with `href` containing `checkout` or `pagar` exists
- **THEN** that href is resolved and written as the `checkout` page URL

#### Scenario: No checkout URL found
- **WHEN** neither cart nor checkout links are detected on the homepage
- **THEN** the checkout URL remains `null` in the YAML and a warning is logged

### Requirement: The system discovers PLP URLs for each site
The system SHALL navigate each site, locate the main category navigation, and extract the URL of a category page (preferring "abarrotes" or the first available category).

#### Scenario: PLP URL discovered from navigation menu
- **WHEN** the discover script finds a navigation menu with category links
- **THEN** it selects the first category link, resolves it to a full URL, and writes it as the `plp` page URL

#### Scenario: PLP URL falls back to first anchor in header
- **WHEN** no explicit category navigation is found
- **THEN** the script selects the first anchor link in the header or nav element as the PLP URL fallback

### Requirement: The system discovers PDP URLs for each site
The system SHALL navigate to the discovered PLP URL, locate the first product link, and extract its URL.

#### Scenario: PDP URL discovered from product card
- **WHEN** the discover script navigates to the PLP URL and finds a product card or link matching selectors like `a[href*='/product']`, `a[href*='/p/']`, or `[data-testid='product-card'] a`
- **THEN** the first matching product URL is extracted and written as the `pdp` page URL

#### Scenario: No product link found on PLP
- **WHEN** no product links are detected on the PLP page
- **THEN** the PDP URL remains `null` in the YAML and a warning is logged

### Requirement: The system persists discovered URLs to the YAML config file
The system SHALL write all discovered URLs to `engine/crux-pages.yaml`, preserving existing entries for sites not being discovered and updating only the relevant page type URLs.

#### Scenario: YAML updated for a single site
- **WHEN** the discover script runs for one site and finds all three page type URLs
- **THEN** the YAML file is updated with the discovered URLs for that site while leaving other sites unchanged

#### Scenario: YAML preserves existing data for undiscovered page types
- **WHEN** a site already has a homepage URL defined but checkout is still `null`
- **THEN** after discovery, the homepage URL is preserved and only checkout (and PLP, PDP if discovered) are updated


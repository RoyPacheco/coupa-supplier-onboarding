# Supplier Onboarding — Alo / Bella Canvas

A self-contained, single-file web application for creating and managing suppliers in **Coupa** via the Coupa REST API. Built for the Alo / Bella Canvas procurement team, the app supports both individual supplier onboarding through a guided form and large-scale batch processing through a CSV-based bulk upload workflow.

---

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Toolbar](#toolbar)
- [Settings](#settings)
- [Supplier Onboarding Form](#supplier-onboarding-form)
- [Bulk Upload Workflow](#bulk-upload-workflow)
- [API Integration](#api-integration)
- [Theming](#theming)
- [Data Persistence](#data-persistence)
- [Technical Notes](#technical-notes)

---

## Overview

The application runs entirely in the browser as a single HTML file (`supplier-onboarding.html`). It communicates with the Coupa API either directly or through a local CORS proxy (`server.js` on `http://localhost:3000`). No build step, framework, or external dependency is required beyond a modern browser.

---

## Getting Started

1. Open `supplier-onboarding.html` in a browser.
2. Click the **Settings** icon (gear) in the top-right toolbar.
3. Enter your **Coupa Instance URL** (e.g. `https://your-instance.coupahost.com`) and your **Coupa Bearer Token**.
4. Click **Save**. Settings are stored in `localStorage` and persist across page refreshes.
5. Use the **Supplier Onboarding Form** for single entries or the **Bulk Upload** section for batch processing.

> **Proxy mode:** `PROXY_MODE` is set to `true` by default, routing all API calls through `http://localhost:3000`. Set it to `false` in the script to call Coupa directly (requires CORS to be enabled on the Coupa side).

---

## Toolbar

Four icon buttons are fixed in the top-right corner of the page. They are mutually aware — activating one section automatically hides the other.

| Icon | Function |
|------|----------|
| **Form** (grid icon) | Toggles the Supplier Onboarding Form and its progress nav on/off. Renders in blue when the form is visible. |
| **Bulk Upload** (upload icon) | Toggles the Bulk Upload section on/off. Hides the form when activated; form icon re-activates the form and hides bulk. Renders in blue when the bulk section is visible. |
| **Settings** (gear icon) | Opens the Settings modal. |
| **Theme** (moon/sun icon) | Switches between dark and light themes. |

Toggling the Form icon while Bulk is open closes Bulk (and vice versa). Both sections can also be hidden simultaneously.

---

## Settings

Opened via the gear icon. All values are saved to `localStorage` and loaded automatically on every page visit.

| Field | Description |
|-------|-------------|
| **Coupa Instance URL** | The base URL of your Coupa instance (e.g. `https://your-instance.coupahost.com`). Replaces the hardcoded constant and drives all API endpoint construction at runtime. |
| **Coupa Bearer Token** | The API bearer token for authenticating all Coupa API requests. Non-ASCII characters (smart quotes, invisible Unicode) are automatically stripped before use. |

If either value is missing when a form submission or batch process is triggered, the Settings modal opens automatically with an inline error notification.

---

## Supplier Onboarding Form

A guided, single-supplier entry form with five collapsible sections.

### Sections

**1. General Information** *(Required)*
- Legal Supplier Name
- Display Name
- Status (`Approved`, `Draft`, `Inactive`)
- Supplier Number
- DUNS Number

**2. Purchase Order Settings**
- PO Email *(Required)*
- PO Transmission Method (`Email`, `cXML`, `Fax`, `None`)
- PO Change Method

**3. Primary Address**
- Address Name, Location Code
- Street Address, Street Address 2
- City, State/Region, Postal Code
- Country Code (dropdown, 25 countries)

**4. Primary Contact**
- First Name, Last Name
- Contact Email

**5. Financial & Operational** *(Required)*
- Preferred Currency (19 options)
- Country of Operation (25 countries)
- Payment Term (`Net 15` through `Net 90`, `COD`, `Immediate`)
- Content Groups (`NI Suppliers`, `HN Suppliers`)
- Tax Registration ID

### Form Behavior

- **Collapsible sections** — click any section header to expand or collapse it.
- **Live validation** — required fields are highlighted immediately on interaction; errors clear as soon as valid input is detected.
- **Vertical progress nav** — a fixed side-bar shows one dot per section, turning green when all required fields in that section are filled. The active dot tracks whichever section is closest to the centre of the viewport. Clicking a dot scrolls smoothly to that section. Hidden on screens narrower than 720 px.
- **Clear Form** — resets all fields and clears all validation states.

### Submission Flow (5 API Steps)

Clicking **Create Supplier** triggers a sequential API chain. A full-screen preloader with a step indicator keeps the user informed throughout.

| Step | Action |
|------|--------|
| 1 | `POST /api/supplier_information` — creates the supplier record |
| 2 | `PUT /api/supplier_information/{id}` — updates the name (replacing `CoupaID` placeholder with the real ID) and assigns content groups |
| 3 | `POST /api/supplier_information_tax_registrations` — creates the tax registration |
| 4 | `PUT /api/suppliers/{supplier-id}` — sets the supplier status to `active` |
| 5 | `PUT /api/supplier_information/{id}?exported=true` — marks the SIM record as exported |

On success, a toast notification displays the SIM ID and Supplier ID with a direct link to the record in Coupa. On any API error, the exact error message returned by Coupa is shown in the notification.

---

## Bulk Upload Workflow

Accessed via the upload icon in the toolbar. Supports loading hundreds of suppliers from a CSV file and processing them all through the same 5-step API chain, one row at a time.

### Dashboard Tiles

Six live-updating summary tiles appear at the top of the section:

| Tile | Content |
|------|---------|
| **Total Rows** | Number of supplier rows currently in the table |
| **Countries** | Count of unique Countries of Operation, with names listed below |
| **Currencies** | Count of unique Preferred Currencies, with codes listed below |
| **Processed** | Rows successfully created in Coupa |
| **Failed** | Rows that encountered an API error |
| **Missing Fields** | Rows flagged as invalid due to missing required fields |

### Action Buttons

| Button | Behaviour |
|--------|-----------|
| **Load File** | Opens a file picker modal (also supports drag-and-drop). Accepts `.csv` files only. Parses the file, maps columns to data fields, flags invalid rows, and appends the new rows to any existing data. |
| **Download Template** | Downloads `supplier-upload-template.csv` — a blank CSV pre-populated with all 24 input column headers, ready to fill in and re-upload. |
| **Process All** | Runs the 5-step Coupa API chain for every `pending` row. Blocked if any rows have missing required fields. Shows a live progress bar ("Processing 3 of 12…"). Writes the returned Coupa Supplier ID and a creation timestamp back into each successfully processed row. |
| **Add Row** | Opens the Edit modal pre-cleared to manually enter a new supplier without re-uploading a file. |
| **Retry Failed** | Appears after a batch run if any rows errored. Resets failed rows to `pending` and re-runs only those rows. |
| **Export CSV** | Downloads all rows — including hidden fields, Coupa Supplier ID, SIM ID, creation timestamp, processing status, and any error messages — as a dated CSV file (`bulk-suppliers-YYYY-MM-DD.csv`). |
| **Discard** | Clears all rows and resets the table. Requires confirmation before executing. |

### Table Columns (Visible)

| Column | Notes |
|--------|-------|
| Legal Supplier Name | |
| Supplier Number | |
| Country of Operation | |
| Coupa Supplier ID | Populated after successful processing |
| Created At | Timestamp populated after successful processing |
| Status | `pending`, `processing`, `success`, `error`, or `invalid` |
| Actions | Edit, Delete buttons per row |

All other CSV fields (address, contact, currency, payment term, etc.) are stored in each row's data object and included in the exported CSV, but are not shown as table columns.

### Row Actions

- **Edit** — opens the full Edit modal pre-populated with all fields for that row (including hidden ones). Saving re-validates the row and updates its status.
- **Delete** — removes the row after a confirmation dialog.

### CSV File Format

The **Download Template** produces a CSV with these 24 input columns:

```
Legal Supplier Name, Display Name, Status, Supplier Number, DUNS Number,
PO Email, PO Method, PO Change Method, Address Name, Location Code,
Street Address, Street Address 2, City, State/Region, Postal Code,
Country Code, First Name, Last Name, Contact Email, Preferred Currency,
Country of Operation, Payment Term, Content Group, Tax ID
```

The parser accepts both the human-readable header names above and their internal field-name equivalents (e.g. `name`, `po-email`, `preferred-currency`). Quoted fields and embedded commas are handled correctly.

### Processing & Error Handling

- Rows missing any required field are automatically flagged `invalid` on file load or save and highlighted in amber.
- **Process All** is blocked while any `invalid` rows exist, with a clear notification listing the count.
- Per-row API errors are displayed inline in the Status column with a truncated error message (full message visible on hover).
- After a partial batch, the notification banner reports `X succeeded, Y failed`.
- **Retry Failed** allows targeted re-processing without re-running already-successful rows.

---

## API Integration

All Coupa API calls share the same authentication and routing logic.

### Routing

```
PROXY_MODE = true  →  all requests go to http://localhost:3000 (CORS proxy)
PROXY_MODE = false →  requests go directly to the Coupa Instance URL
```

The Coupa Instance URL is always sourced at call-time from `localStorage` (set via Settings), never hardcoded.

### Authentication

Every request includes:
```
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
```

The bearer token is read from `localStorage` at submission time and sanitised to remove non-ASCII characters.

### Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/supplier_information` | Create supplier record |
| `PUT` | `/api/supplier_information/{id}` | Update name, content groups |
| `POST` | `/api/supplier_information_tax_registrations` | Create tax registration |
| `PUT` | `/api/suppliers/{supplier-id}` | Set status to active |
| `PUT` | `/api/supplier_information/{id}?exported=true` | Mark record as exported |

---

## Theming

Two themes are available, toggled by the moon/sun icon in the toolbar.

| Theme | Description |
|-------|-------------|
| **Dark** (default) | Deep navy background (`#0d0f14`) with gold accent (`#c8a96e`) and blue secondary accent (`#5b8dee`) |
| **Light** | White/slate background (`#fdfdfd` / `#eef3fa`) with blue accent (`#1a56c4`) |

The active theme is saved to `localStorage` under the key `supplier-theme` and restored on every page load. All colour transitions are smooth (`0.26s cubic-bezier`). A subtle dot-grid background adapts to the active theme.

---

## Data Persistence

| Data | Storage Key | Notes |
|------|-------------|-------|
| Theme preference | `supplier-theme` | `"light"` or `"dark"` |
| Coupa Instance URL | `supplier-coupa-url` | Cleared if field is left blank in Settings |
| Bearer Token | `supplier-bearer-token` | Cleared if field is left blank in Settings |
| Bulk upload rows | `supplier-bulk-rows` | Full row objects including all fields and processing results |

All bulk upload data is persisted through `SupplierStorage`, an abstraction layer that wraps `localStorage` reads and writes. Its interface (`getRows`, `saveRows`, `clearRows`) is designed to be swapped out for a remote backend (e.g. PostgreSQL via a REST API) with minimal changes to the calling code.

---

## Technical Notes

- **Single-file app** — all HTML, CSS, and JavaScript live in `supplier-onboarding.html`. No build tools, bundlers, or npm packages required.
- **No external JS libraries** — vanilla JavaScript only (ES2020+).
- **Fonts** — `DM Serif Display` (headings) and `DM Sans` (body) loaded from Google Fonts.
- **Browser support** — modern evergreen browsers (Chrome, Edge, Firefox, Safari). Uses `color-mix()`, `backdrop-filter`, and CSS custom properties.
- **CORS proxy** — a companion `server.js` Node.js proxy is expected at `http://localhost:3000` when `PROXY_MODE = true`. The proxy forwards `/api/*` requests to the configured Coupa instance and adds the necessary CORS headers.

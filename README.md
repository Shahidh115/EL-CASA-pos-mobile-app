# EL CASA ROMS — Standalone Offline Android POS

> **A 100% Offline, Native-Integrated Android POS & Restaurant Operations Management System**

EL CASA ROMS Mobile is a standalone, self-contained Android application designed specifically for restaurant operations. Unlike web applications that require constant cloud connectivity, this mobile app bundles all front-end assets and business logic into the native client and runs on a persistent local SQLite database stored in Android app-private storage.

---

## 🌟 Key Features

### 1. 100% Standalone Offline Architecture
- **Zero Cloud Runtime Dependency**: No hosted web server, remote API, or Laravel runtime required for daily operation.
- **Embedded SQLite Engine**: Versioned SQLite relational schema with ACID transaction isolation (`BEGIN TRANSACTION`, `COMMIT`, `ROLLBACK`). Restarts do not erase business records.
- **Hybrid Platform Compatibility**: Seamlessly runs on native Android via `@capacitor-community/sqlite` and on development/web environments via persistent WebAssembly SQLite (`sql.js`).

### 2. Full POS Workflows & Real-time Stock Protection
- **Instant Product Selection**: Touch-optimized menu grid with category navigation, portion availability indicators, and sold-out badges.
- **Recipe-Based Stock Verification**: Live computation of maximum preparable quantities based on active recipe versions and ingredient portion balances.
- **Atomic Checkout & Deductions**: Prevents overselling by calculating total recipe resource requirements before committing a sale.
- **Sequential Invoicing**: Unique invoice generation adhering to the standard `INV-YYYYMMDD-XXXX` format.
- **Held Orders**: Place orders on hold with 6-character uppercase alphanumeric tracking codes (`hold_code`), edit/resume items, and complete or discard held orders.
- **Bill Cancellation & Stock Restoration**: Cancelling a completed sale automatically recalculates ingredient usage from item recipes, restores balances, and creates `SALE_RESTORE` transaction records.

### 3. Kitchen Production & Stock Management
- **Daily Opening Balances**: Set opening portion counts per resource for today or custom dates.
- **Mid-Day Production Additions**: Add cooked batches with notes and quick-add shortcuts (+5, +10, +25 portions).
- **Everyday Reset**: One-touch daily reset resetting opening balances to 0 for a clean production day.
- **Manual Stock Adjustments**: Log physical count adjustments with compulsory audit notes.
- **Portion Deductions & Waste**: Record waste either directly by resource or by menu dish (automatically expanding and deducting all constituent recipe ingredients).
- **Immutable Audit Trail**: Append-only transaction log of all movements (`OPENING`, `PRODUCTION`, `SALE`, `SALE_RESTORE`, `WASTE`, `MANUAL_ADJUSTMENT`).

### 4. Native Hardware Integrations
- **Camera Barcode / QR Scanner**: Native scanner using `@capacitor-mlkit/barcode-scanning` with custom targeting reticle, audio beep feedback, haptic vibration, flashlight toggle, and manual input fallback.
- **Thermal Receipt Printing Integration**:
  - Full **ESC/POS** command encoder supporting 58mm (32-column) and 80mm (48-column) standard thermal printers.
  - Multi-protocol connection abstraction:
    - **System Print**: Android Print Spooler / standard print dialog.
    - **Bluetooth SPP / BLE**: Direct ESC/POS printing to wireless Bluetooth thermal printers.
    - **Network (TCP)**: Direct raw ESC/POS socket printing on port 9100.
  - Receipt preview modal with one-tap print, cash drawer kick pulse (`ESC p 0 25 250`), and paper cut commands.

### 5. Local Database Backups & Data Portability
- **JSON Full System Export**: Complete export of all 12 relational database tables and settings with versioning metadata.
- **Validated JSON Restore**: Validates backup structure and transactionally restores tables.
- **Database Reset**: Safe reset mechanism to re-initialize default menu items and recipes.

---

## 🛠️ Tech Stack

- **UI Framework**: React 19, TypeScript
- **Bundler & Build Tool**: Vite 6
- **Styling**: Tailwind CSS v4, `tw-animate-css`, Lucide Icons
- **State Management & Querying**: Zustand, TanStack Query v5
- **Native Runtime**: Capacitor 7 Android
- **Database**: Android SQLite (`@capacitor-community/sqlite`) / WebAssembly SQLite (`sql.js`)
- **Native Hardware**: `@capacitor-mlkit/barcode-scanning`, `@capacitor/camera`, `@capacitor/haptics`
- **Unit Testing**: Vitest 3

---

## 📁 Repository Structure

```
elcasa-roms-android/
├── android/                         # Capacitor Native Android Project
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml      # Hardware & Camera/Bluetooth permissions
│   │   ├── java/.../MainActivity.java
│   │   └── res/                     # Android icons and resources
│   ├── build.gradle                 # Gradle root build configuration
│   └── gradlew.bat                  # Gradle Wrapper
├── src/
│   ├── db/
│   │   ├── schema.ts                # DDL for all 12 SQLite tables
│   │   ├── database.ts              # SQLite connection, transaction runner & WASM adapter
│   │   └── seed.ts                  # Default restaurant profile, categories, recipes
│   ├── hardware/
│   │   ├── escpos.ts                # ESC/POS binary command encoder
│   │   ├── printerService.ts        # Bluetooth / Network / System printer adapter
│   │   └── barcodeScanner.ts        # ML Kit camera barcode scanner
│   ├── services/                    # Local Business Logic (Ports of original Laravel services)
│   │   ├── localSaleService.ts      # Checkout, hold orders, cancellation & stock restore
│   │   ├── localResourceService.ts  # Ingredient calculations & stock validation
│   │   ├── localProductionService.ts# Opening balances, production history, reset-all
│   │   ├── localMenuItemService.ts  # Menu item CRUD, cascading deletions
│   │   ├── localCategoryService.ts  # Category management
│   │   ├── localRecipeService.ts    # Recipe versioning (v1, v2...)
│   │   ├── localWasteService.ts     # Waste logging by resource or dish
│   │   ├── localReportService.ts    # Sales summary, reconciliation matrix, hourly distribution
│   │   ├── localSettingsService.ts  # Restaurant profile & hardware preferences
│   │   ├── localBackupService.ts    # JSON database backup export & restore
│   │   └── apiBridge.ts             # In-memory API router matching REST endpoints
│   ├── components/
│   │   ├── hardware/                # Barcode scanner modal, thermal receipt modal, printer settings
│   │   ├── layout/                  # AppShell sidebar, mobile drawer, offline status badge
│   │   └── ui/                      # Touch-friendly buttons, inputs, dialogs, cards
│   ├── pages/                       # 10 core pages (POS, Dashboard, Sales, Menu, Production, etc.)
│   └── tests/                       # Unit test suites (Sales, Stock restoration, ESC/POS encoding)
├── capacitor.config.ts              # Capacitor configuration
├── vite.config.ts                   # Vite bundler configuration
└── package.json                     # Standalone package manifest
```

---

## 🚀 Development & Installation

### Prerequisites
- **Node.js**: v20 or higher (v24 LTS recommended)
- **npm**: v10 or higher
- **Java JDK**: OpenJDK 17 or 21 (Temurin / Android Studio JDK)
- **Android Studio & SDK**: Android 14 / 15 SDK (Platform API 34 or 35)

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 2. Run Local Development Server
```bash
npm run dev
```
Visit `http://localhost:5174` in your browser. All SQLite operations will execute in-memory with local persistence via WebAssembly!

### 3. Run Automated Tests
```bash
npm test
```
Executes the Vitest suite testing checkout transactions, stock deduction constraints, hold orders, bill cancellations, and ESC/POS byte generation.

### 4. Build Production Web Assets
```bash
npm run build
```

---

## 📱 Android Build & APK Generation

### 1. Sync Web Assets to Native Android Project
```bash
npx cap sync android
```

### 2. Build Debug APK via Gradle Command Line
Navigate to the `android` directory and run:

**On Windows (PowerShell / Command Prompt):**
```powershell
cd android
.\gradlew.bat assembleDebug
```

**On macOS / Linux:**
```bash
cd android
./gradlew assembleDebug
```

The generated debug APK will be located at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 3. Open in Android Studio
To run on a connected POS device or emulator directly from Android Studio:
```bash
npx cap open android
```

---

## 🖨️ Thermal Receipt Printer Compatibility

The application implements an ESC/POS binary command encoder compatible with all standard thermal printers:

| Connection Type | Compatibility | Notes |
|-----------------|---------------|-------|
| **System Print** | Any Android-connected printer | Uses Android Print Spooler. Zero configuration needed. |
| **Bluetooth (ESC/POS)** | 58mm / 80mm Bluetooth Printers | Connects via Web Bluetooth / Bluetooth Serial profile. |
| **Network (Ethernet / WiFi)** | Standard POS printers on Port 9100 | Direct TCP raw socket communication. |

### Configurable Options in Settings:
- Paper Width: **58mm (32 columns)** or **80mm (48 columns)**
- Auto Cut Paper (`GS V`)
- Cash Drawer Kick Pulse (`ESC p 0 25 250`)
- Restaurant Logo & Custom Header / Footer messages

---

## 💾 Local SQLite Database Schema

The database contains 12 normalized tables:
- `settings` (Key-value store for restaurant configuration)
- `categories` (Item categories with display sort order)
- `production_resources` (Kitchen stock with current balances and warning thresholds)
- `menu_items` (Sellable dishes with prices and category references)
- `recipes` (Versioned recipes with `is_current` flag)
- `recipe_items` (Resource quantities per recipe)
- `daily_production` (Daily opening stock records)
- `production_adjustments` (Mid-day additions and batches)
- `bills` (Sales headers with unique invoice numbers and payment details)
- `bill_items` (Snapshot of sold items and unit prices)
- `resource_transactions` (Immutable audit log of all stock movements)
- `wastes` (Spoiled, burnt, and staff meal deduction records)

---

## 🔒 Security & Privacy

- **No Secrets**: No API keys, passwords, or cloud credentials are required or bundled.
- **Local Privacy**: All sales, pricing, and customer records remain strictly on the local device.
- **Safe Deletion**: Deleting a menu item retains historical `bill_items` sales lines by nullifying foreign keys, preventing orphan records or broken reports.

---

## 📄 License

Proprietary © EL CASA ROMS. All rights reserved.

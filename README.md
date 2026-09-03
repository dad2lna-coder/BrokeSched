# BrokeSched

**Offline airport staffing scheduler for TSO / LTSO / STSO positions.**

BrokeSched is a lightweight, single-page HTML/JavaScript application that generates optimized workforce schedules for airport Transportation Security Officer (TSO) teams. Works entirely offline—no server, no build step, no dependencies required (except a modern browser).

[![GitHub Pages](https://img.shields.io/badge/live-GitHub%20Pages-blue?logo=github)](https://dad2lna-coder.github.io/BrokeSched/)
![License](https://img.shields.io/badge/license-MIT-green)
![Built with](https://img.shields.io/badge/built%20with-HTML%2FJS%2FCSS-orange)

---

## 🚀 Quick Start

### **Run Locally**

1. **Clone or download the repo:**
   ```bash
   git clone https://github.com/dad2lna-coder/BrokeSched.git
   cd BrokeSched
   ```

2. **Open in browser:**
   - **Easiest:** Double-click `index.html`
   - **Or run a local server:**
     ```bash
     python -m http.server 8000
     # Then open http://localhost:8000
     ```

3. **Start scheduling** — all data stays in your browser

### **Live Demo**
Visit the deployed version at: https://dad2lna-coder.github.io/BrokeSched/

---

## ✨ Features

### **Five-Tab Workflow**

| Tab | Purpose |
|-----|---------|
| **① Setup** | Configure operating hours, staffing headcount, shifts, and function requirements |
| **② Coverage** | View 30-minute headcount slots by day of week; verify staffing levels |
| **③ Lines** | Inspect individual employee schedules, RDOs, and function assignments; export to Excel |
| **④ Teams** | Form teams by RDO pattern; drag-drop assignments; fine-tune composition |
| **⑤ Reports** | Management dashboards: passenger/baggage coverage, gender balance, phase analysis |

### **Core Capabilities**

- 🎯 **Automated scheduling** — Generate balanced schedules respecting RDO (Regular Day Off) patterns
- 👥 **Team formation** — Auto-group staff by RDO compatibility; manually refine with drag-drop UI
- 📊 **Coverage analysis** — 30-minute slot visualization; staffing trends by function (DFO/BAG/PAX)
- 📋 **Flexible shifts** — Define any shift pattern (open/close times, paid hours, staffing force per role)
- 🔄 **Role-based allocation** — FT/PT/LTSO/STSO support; gender-balanced assignments
- 📥 **Import/Export** — Save/load schedules as JSON; export final lines to `.xlsx` (Excel)
- 📱 **Mobile-friendly** — Responsive design; touch-optimized UI; works on tablets
- 🔒 **Fully offline** — No internet required; no data sent anywhere

---

## 🏗️ Architecture

### **Project Structure**

```
BrokeSched/
├── index.html              # Entry point (single page)
├── README.md               # This file
├── INSTRUCTIONS.md         # In-app user guide (loaded in Instructions modal)
│
├── css/
│   ├── styles.css          # Main UI & layout
│   ├── team-build.css      # Team builder styling
│   └── line-print.css      # Print/export styles
│
├── js/
│   ├── constants.js        # Shared enums (phases, roles, etc.)
│   ├── state.js            # Central app state object
│   ├── utils.js            # Time, number, DOM helpers
│   ├── shifts.js           # Shift CRUD & validation
│   ├── allocation.js       # Schedule generation algorithm
│   ├── functions.js        # Function coverage logic (DFO/BAG/PAX)
│   ├── render.js           # DOM rendering & UI updates
│   ├── line-colors.js      # Color scheme for team assignments
│   ├── reports.js          # Dashboard reports
│   ├── schedule.js         # Schedule state & queries
│   ├── io.js               # Import/Export JSON & Excel
│   ├── airport.js          # Airport config modal logic
│   ├── teams.js            # Team state & CRUD
│   ├── team-build.js       # Team builder UI & drag-drop
│   └── main.js             # App initialization
│
└── lib/
    ├── dayjs.min.js        # Date parsing & manipulation
    ├── Sortable.min.js     # Drag-drop for team builder
    ├── luxon.min.js        # Advanced datetime (optional)
    └── exceljs.min.js      # Excel .xlsx generation
```

### **Key Modules**

- **state.js** — Single source of truth for app data (shifts, staffing, assignments)
- **allocation.js** — Core algorithm: distributes staff across shift slots, respects RDOs, balances gender
- **render.js** — Refreshes UI from state; keeps DOM in sync
- **teams.js** + **team-build.js** — Team formation and drag-drop assignment
- **io.js** — Serializes state to JSON; generates Excel with ExcelJS

---

## 📖 How It Works

### **Basic Workflow**

```
1. Setup         → Define hours, shifts, headcount by role/gender
                ↓
2. Generate      → Algorithm creates initial schedule respecting constraints
                ↓
3. Review        → Check Coverage tab for 30-min slot headcount heatmap
                ↓
4. Teams         → Auto-form teams by RDO pattern; refine manually
                ↓
5. Export        → Download Excel schedule with all assignments & RDOs
```

### **Scheduling Algorithm (Simplified)**

1. **Initialize slots** — Create 30-min time slots for each day in schedule period
2. **Assign shifts** — Distribute staff across shifts based on "force" (headcount needed)
3. **Respect RDOs** — Ensure no staff work on their RDO days
4. **Balance gender** — Aim for equal M/F distribution per shift
5. **Assign functions** — Map DFO/BAG/PAX roles to assigned personnel
6. **Validate** — Check for conflicts, undershooting, etc.

---

## 🎮 Usage Guide

### **Setup Tab**

1. **Operating Window** — Set daily open/close times (e.g., 03:30–23:00)
2. **Schedule Period** — Pick start date and # of weeks
3. **Headcount by Role**:
   - FT Male/Female, PT Male/Female (Operational TSOs)
   - LTSO Male/Female (Management, not in main pool)
   - STSO Male/Female (Supervisory, not in main pool)
4. **Shifts** — Click "+ Add shift" and define:
   - Name, start time, end time, paid hours
   - TSO force (# of operational TSOs needed)
   - LTSO/STSO force
   - RDO hard constraints (days off)
   - Day time overrides (per-day special times)
5. **Function Coverage** — Click "Function coverage…" to assign DFO/BAG/PAX pools and time bands
6. **Generate** — Click "Generate" to create the schedule

### **Coverage Tab**

- **Matrix** — 30-min slots × days of week; color-coded headcount (green=ok, amber=low, red=0)
- **Bars** — Visual trend across a typical day
- **Shift Mix** — Summary of how personnel are distributed by shift and role

### **Lines Tab**

- **Filterable table** — View each person's schedule line (code, role, assigned shifts, RDOs, baggage days)
- **Editable inline** — Click a cell to adjust (if needed for manual tweaks)
- **Export Excel** — Downloads `.xlsx` with styling and all metadata

### **Teams Tab**

- **Architecture** — Set desired team size (e.g., 1 STSO, 1 LTSO, 6 TSO per team)
- **Auto-Form** — Groups staff matching RDO patterns; leaves mismatches in "Unassigned Pool"
- **Manual Assignment** — Drag-drop from pool to team cards; adjust composition
- **Build Modal** — Fine-tune team selection side-by-side with unassigned staff

### **Reports Tab**

- **Management dashboards** — Coverage by role, gender balance, phase-time analysis
- **Skew detection** — Flags imbalanced shifts or gaps

---

## 🛠️ Development

### **Tech Stack**

- **Vanilla JavaScript** (ES5 + modern globals) — No framework, no build
- **CSS3** — Grid, flexbox, CSS variables for theming
- **Libraries** (bundled):
  - `dayjs` — Lightweight date parsing
  - `Sortable.js` — Drag-drop for teams
  - `ExcelJS` — Generate `.xlsx` files
  - `Luxon` — Advanced datetime (backup)

### **No Build Step Required**

Open `index.html` directly in a browser. All scripts load as classic `<script>` tags. Works offline via `file://` protocol.

### **Architecture Notes**

- **Namespace pattern** — All code lives under `window.Scheduler` to avoid global conflicts
- **State-driven** — Changes to `S.state` trigger renders via `S.renderAll()` or `S.updateStatus()`
- **Modular scripts** — Each `.js` file extends the `Scheduler` namespace (IIFE pattern)
- **No build tooling** — For simplicity; can be refactored to ES modules + bundler if needed

### **Common Development Tasks**

#### **Add a New Input Field**
1. Update HTML in `index.html` (add `<input>` with id)
2. Add to `S.state` (in `state.js`)
3. Read/write in the relevant module (e.g., `shifts.js`, `teams.js`)
4. Trigger re-render: `S.renderAll()`

#### **Change the Scheduling Algorithm**
Edit `js/allocation.js` — contains the core logic for slot distribution and balancing.

#### **Modify Styling**
- Edit `css/styles.css` for global theme
- Update CSS variables at `:root` for colors, spacing, fonts
- Add media queries for responsive tweaks

---

## 📊 Configuration Examples

### **Small Airport**
```
Operating Hours: 06:00–22:00
Staffing: 5 FT M, 5 FT F, 2 PT M, 2 PT F
LTSO/STSO: 1 each (M/F)
Shifts: 06:00–14:00 (6 TSO), 14:00–22:00 (4 TSO)
Schedule: 2 weeks
```

### **Larger Hub**
```
Operating Hours: 03:30–23:00
Staffing: 15 FT M, 15 FT F, 6 PT M, 6 PT F
LTSO/STSO: 2 each (M/F)
Shifts: Early (03:30–11:30), Mid (10:00–18:00), Late (17:30–23:00)
Functions: 3 DFO, 2 BAG, 5 PAX
Schedule: 4 weeks
```

---

## 🐛 Known Limitations

- **Team Builder Cleanup** — Must remove all teams from the builder modal before switching to a different team set
- **Manual Override** — No built-in conflict resolution if you edit a saved schedule and re-generate (may cause duplicates)
- **Large Datasets** — Performance untested with >1000 employees; table renders may slow down
- **Accessibility** — Dark theme only; limited ARIA labels (improvements planned)

---

## 🚧 Planned Enhancements

- [ ] Light mode toggle
- [ ] Undo/Redo
- [ ] Drag-reorder shifts in Setup
- [ ] SMART Schedule upload integration
- [ ] CSV import for employee master list
- [ ] Shift swap requests UI
- [ ] Multi-user conflict detection
- [ ] Performance optimization (virtualized tables)

---

## 📋 Requirements

### **Browser Support**

- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+
- Mobile browsers (iOS Safari, Chrome Android)

### **Required Libraries**

All bundled locally—no CDN calls:
- `dayjs` (date parsing)
- `Sortable.js` (drag-drop)
- `ExcelJS` (Excel generation)

---

## 📝 License

[MIT License](LICENSE) — Use, modify, and distribute freely.

---

## 🤝 Contributing

Found a bug? Have a feature request? Open an issue on GitHub:  
https://github.com/dad2lna-coder/BrokeSched/issues

For detailed user instructions, see **[INSTRUCTIONS.md](INSTRUCTIONS.md)** or click the **Instructions** button in the app.

---

## 📞 Support

- **In-app help** — Click "Instructions" button for full workflow guide
- **GitHub Issues** — Report bugs or suggest features
- **Offline docs** — Embedded in INSTRUCTIONS.md (loaded in modal)

---

## 🎯 Use Cases

- ✈️ **TSA/Airport Security** — Optimize TSO scheduling across terminals
- 🏢 **Facility Management** — Build balanced teams respecting staff RDO patterns
- 📅 **Shift Planning** — Quick "what-if" scenario testing (offline)
- 🎭 **Multi-role Staffing** — Coordinate supervisory + operational roles in one schedule

---

**v2 · Alpha Build · Last updated: Sept 2026**

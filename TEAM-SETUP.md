# BLADE — setup and where files live

BLADE is the airport staffing scheduler (bid lines, teams, coverage). It runs on your PC. It does not log into a company website or send schedules to an outside service.

Work files live in the shared **Schedule Builder** library. OneDrive keeps that folder in sync for the team.

---

## 1. Add the shared library to your OneDrive

Do this once.

1. Open the **Schedule Builder** link your lead sent (SharePoint / OneDrive).
2. Sign in with your **work** account if asked.
3. Choose **Add shortcut to My files** (or **Sync**), not “Download.”
4. Wait until OneDrive on the PC shows a cloud/checkmark.
5. Confirm this folder exists in File Explorer:

   `OneDrive - USTSA\Schedule Builder`

If you do not see `OneDrive - USTSA`, look under your user folder for any **OneDrive** item that contains **Schedule Builder**. Leave that name as-is.

You do **not** need the old `index.html`, `css`, or `js` folders in that share. Those were the previous web copy.

---

## 2. Install BLADE

1. In File Explorer open:

   `OneDrive - USTSA\Schedule Builder\BLADE-Update`

2. Run the newest installer. The name looks like:

   `BLADE_0.2.4_x64-setup.exe`

   Use the highest version number you see.

3. Accept the defaults. Install location does not matter. Do **not** install into the OneDrive folder.

4. Open **BLADE** from the Start menu.

5. On the green boot screen:
   - Type your **3-letter airport code** (example: `DAL`).
   - Press **Y** to continue.

   Your Windows sign-in name is picked up automatically. You do not type a password into BLADE.

After this first install, newer installers dropped into `BLADE-Update` can be offered the next time you open the app.

---

## 3. Find exported files

Exports do **not** go to Downloads or next to the program.

They go here:

```
OneDrive - USTSA\Schedule Builder\<AIRPORT>\
```

Examples:

```
...\Schedule Builder\DAL\DAL_jmoore_Config_09042026.json
...\Schedule Builder\DAL\DAL_jmoore_Lines_09042026.xlsx
```

- **Config** `.json` — full schedule setup (use Import in BLADE).
- **Lines** `.xlsx` — spreadsheet for review or print.

The airport folder is created the first time you enter that code. File names include airport, your Windows name, and the date so two people do not overwrite each other.

OneDrive must finish syncing (cloud icon clear) before others will see a new file.

---

## 4. Everyday use (short)

1. Open BLADE.
2. Enter airport code → **Y**.
3. Build or import a schedule.
4. **[EXP] EXPORT** writes the JSON into your airport folder.
5. On the Lines tab, **Export Excel** writes the spreadsheet into the same folder.
6. **[IMP] IMPORT** if you need to load a `.json` someone else put in that folder.

---

## 5. What not to do

- Do not email the `.exe` from a personal account if policy says use the share only.
- Do not delete `BLADE-Update` or other airports’ folders.
- Do not treat GitHub Pages as the official work copy. Use the installed app.
- If Export does nothing, generate lines first (Excel) and confirm the status bar shows `Wrote …Schedule Builder\DAL\…`.

# BrokeSched - Schedule Builder Instructions

## Overview
BrokeSched is an offline HTML/JS application designed to generate airport staffing schedules for TSO (Transportation Security Officer), LTSO (Lead TSO), and STSO (Supervisory TSO) positions. This guide walks you through the complete workflow from setup to team assignment and final export.

---

## Step 1: Setup Tab

### 1.1 Configure Operating Hours
- Open the **Setup Tab**
- Set your facility's **open time** and **close time**
- These times define your operational window for the schedule

### 1.2 Select Start Date
- Choose your **start date** for schedule generation
- Default schedule generation period is **7 days**
- You can modify this for longer scheduling periods as needed

### 1.3 Set Staffing Levels by Position and Sex
Configure the following positions by sex:
- **TSO** (Transportation Security Officer)
- **LTSO** (Lead TSO)
- **STSO** (Supervisory TSO)

Each position should have staffing requirements specified by sex to ensure proper coverage across your facility.

### 1.4 Add Shift Times
- Define your **shift times** (e.g., 0600-1400, 1400-2200, etc.)
- **Alpha Build Note:** This is a required feature in the alpha version
- **Beta Note:** Optional schedule creation features will be added in the beta version

### 1.5 Generate Initial Schedule
- Click the **Generate** button
- The system will create the base schedule based on your parameters

---

## Step 2: Function Coverage Configuration

After the initial schedule is generated:

### 2.1 Assign Function Coverage
Select coverage requirements for each function:
- **Pax** (Passenger Processing)
- **Bag** (Baggage Screening)
- **DFO** (Duties Function Officer)

**Note:** Bag and DFO are interchangeable in your staffing model.

### 2.2 Set Pool Size
- Define the **pool size** for each function
- This determines how many personnel are allocated to that function

### 2.3 Configure Headcount Per Schedule Bands
- Set **headcount per band** for coverage distribution
- **Basic bands** are provided as default templates
- Adjust bands according to your operational needs

---

## Step 3: Generate Function Assignments

### 3.1 Generate Assignments
- Click the **Generate Function Assignments** button at the bottom of the modal
- The system will distribute staff across functions based on your configuration

### 3.2 Review Coverage
After generation, you can:
- **View coverage metrics** to verify your staffing levels meet requirements
- Ensure each function has adequate coverage across all shifts

---

## Step 4: Teams Tab - Building Your Teams

### 4.1 Set Maximum Staffing Per Position
- Navigate to the **Teams Tab**
- Set the **max count** for each position:
  - **STSO** (Supervisory TSO)
  - **LTSO** (Lead TSO)
  - **TSO** (Transportation Security Officer)

### 4.2 Auto-Form Teams
- Click the **Auto Form Teams** button
- The system will automatically create teams that:
  - Match RDO (Regular Day Off) patterns across staff
  - Leave unmatched personnel in a **pick list** for manual assignment

### 4.3 Work with the Pick List
The pick list contains staff that don't fit standard RDO patterns:
- **Drag and drop** personnel to assign them to teams
- **Checkbox and dropdown** options available for assignment
- Assign remaining staff as needed to balance your teams

---

## Step 5: Team Builder Modal

### 5.1 Open the Build Modal
- Click the **Build** button in the Teams Tab

### 5.2 Add Teams to the Builder
- Click a **team from the assignment modal** to add it to the Team Builder Modal
- You can add **more than one team at a time** for batch operations

### 5.3 Filter and Organize Unassigned Staff
- Use the **filter options** to narrow down unassigned personnel
- **Drag and drop** staff between teams for flexible assignment
- Review and reorganize as needed

### 5.4 Remove Teams from Builder
- To remove a team from the builder, **click the team in the assignment modal** to close it
- **Known Limitation (Fix Coming Soon):** You must remove all teams from the builder modal before editing a different set of teams

### 5.5 Edit Teams
- Click the **Edit button** in the Teams Container to modify team composition
- All changes update in **real time**
- Adjust team members and positions as needed

---

## Step 6: Lines Tab - Schedule Export

### 6.1 View Staff Lines (Published Schedules)
- Navigate to the **Lines Tab**
- View detailed information for each staff member:
  - **RDO (Regular Days Off)** patterns
  - **Schedules** for assigned workdays
  - **Baggage days** - any days scheduled in baggage screening

### 6.2 Export to Excel
- Click the **Export to Excel** button
- Your complete schedule exports with all assignments and RDO patterns
- **Future Enhancement:** Final formats will include smart upload capabilities for direct system integration

---

## Step 7: Lines Tab Details

### 7.1 Understanding Your Lines
Each line displays:
- **Employee identifier**
- **RDO pattern** (days off per week/schedule period)
- **Work schedule** across the planning period
- **Functional assignments** (Pax, Bag, DFO)
- **Shift times** for each scheduled day

### 7.2 Verify Before Export
Before exporting:
- Review all personnel schedules for accuracy
- Confirm RDO patterns are honored
- Check that function coverage meets requirements
- Verify no scheduling conflicts exist

---

## Complete Workflow Summary

```
Setup Tab
  ↓
1. Set operating hours (open/close times)
2. Select start date (default 7 days, adjustable)
3. Configure TSO/LTSO/STSO staffing by sex
4. Add shift times
5. Click Generate
  ↓
Function Coverage Configuration
  ↓
6. Assign function coverage (Pax/Bag/DFO)
7. Set pool size
8. Configure headcount per schedule bands
9. Click "Generate Function Assignments"
  ↓
Teams Tab - Team Formation
  ↓
10. Set max count for STSO/LTSO/TSO
11. Click "Auto Form Teams"
12. Assign remaining staff from pick list
  ↓
Team Builder Modal (Optional - For Fine-Tuning)
  ↓
13. Click "Build" to open Team Builder
14. Add teams from assignment modal
15. Filter and drag/drop to customize teams
16. Edit team composition as needed
  ↓
Lines Tab - Final Review & Export
  ↓
17. Review all staff lines (RDOs, schedules, baggage days)
18. Verify schedule accuracy and coverage
19. Click "Export to Excel"
  ↓
Schedule Complete
```

---

## Tips & Tricks

### Workflow Optimization
- **Default Parameters:** The system provides sensible defaults; modify them to match your facility's specific needs
- **Schedule Length:** While the default is 7 days, you can extend this for longer operational planning
- **Interchangeable Functions:** Bag and DFO roles can be used interchangeably based on your staffing strategy
- **Batch Team Building:** Add multiple teams to the builder at once to make adjustments across several teams simultaneously

### Troubleshooting
- **Real-time Updates:** All changes are reflected immediately - watch for coverage or conflict indicators
- **Teams in Builder:** Remember to remove all teams from the builder before moving to a new set of edits
- **Export Format:** Excel export includes all schedule details needed for roster publication

### Best Practices
1. Always review coverage metrics after initial generation
2. Use Auto Form Teams as your starting point for consistency
3. Fine-tune pick list assignments individually
4. Review the Lines Tab before export to catch any issues
5. Verify RDO patterns are honored for staff work-life balance

---

## Known Limitations & Future Enhancements

- **Builder Modal Cleanup:** Currently, you must remove all teams from the builder modal before working with a different team set. This will be improved in a future release.
- **Excel Export:** Future versions will include smart upload capabilities for direct integration with scheduling systems.
- **Alpha to Beta:** Optional schedule creation features are planned for the beta release.

---

## Support

For additional questions or issues, please refer to the repository's issue tracker or submit a GitHub issue.

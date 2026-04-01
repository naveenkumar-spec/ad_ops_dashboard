# Overview Page Tables Update Plan

## Summary
Update all tables on the overview page to show complete data from tracker sheets with all required columns.

## 1. Region / Country wise Data Table
**Current columns:** Region & Country, Total Campaigns, Budget Groups, Booked Revenue, Spend, Planned Impressions, Delivered Impressions, Gross Margin, Gross Margin %

**Missing columns to add:**
- Net Margin
- Net Margin %

**Status:** ✅ Most columns present, need to add Net Margin columns

## 2. Product and Platform wise data Table
**Current columns:** Product, Total Campaigns, Budget Groups, Booked Revenue, Spend, Planned Impressions, Delivered Impressions, Gross Profit / Loss, Gross Margin %

**Missing columns to add:**
- Net Margin
- Net Margin %

**Status:** ✅ Most columns present, need to add Net Margin columns

## 3. Campaign Wise Data Table
**Current columns:** Campaign Name, Budget Groups, Start Date, End Date, Campaign Duration, Days Remaining, % of Days Passed, Planned Impressions

**Missing columns to add:**
- Status
- Delivered Impressions
- Daily Required Pace
- Yesterday's Pace
- Booked Revenue
- Spend
- Gross Margin
- Gross Margin %
- Net Margin
- Net Margin %
- ⬆ Pace Remarks

**Status:** ⚠️ Many columns missing

## 4. Bottom Campaigns Table
**Current title:** "Bottom Campaigns ( with < 50% Gross Margin )"
**Required:** Change title dynamically based on Bottom/Top toggle selection

**Current columns:** Campaign Name, Status, Booked Revenue, Spend, Gross Margin, Gross Margin %, Net Margin, Net Margin %, Planned Impressions

**Missing columns to add:**
- Delivered Impressions
- Start Date
- End Date
- Campaign Duration
- Days Remaining
- % of Days Passed
- Daily Required Pace

**Additional columns mentioned (unclear if needed):**
- Target Value Display, Delivered Value Display, % Change Display
- Target Value Bumper, Delivered Value Bumper, % Change Bumper
- Target Value Nskip, Delivered Value Nskip, % Change Nskip
- Target Value Skip, Delivered Value Skip, % Change Skip

**Status:** ⚠️ Need clarification on video metrics columns

## Implementation Priority
1. Add Net Margin columns to Region/Country and Product tables (quick win)
2. Update Bottom Campaigns table title to be dynamic
3. Expand Campaign Wise Data table with all missing columns
4. Add remaining columns to Bottom Campaigns table
5. Clarify and implement video metrics columns if needed

## Backend Changes Needed
- Check if backend services return all required fields
- Add computed fields (Daily Required Pace, Yesterday's Pace, Pace Remarks)
- Ensure Net Margin data is available in all table endpoints

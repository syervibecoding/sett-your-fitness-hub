

# Plan: 3 Corrections

## 1. Team Member Profile — Add Email Display

**Problem**: The team member list and edit dialog only show name and UUID snippet. No email visible.

**Changes**:
- **TeamManager.tsx**: In `loadTeam()`, after fetching profiles, also fetch emails from `auth.users` via the edge function (or show `user_id` snippet). Since we can't query `auth.users` from the client, the simplest approach is to add an `update-email` action to the `manage-team-member` edge function. However, for **display**, we can add an email field to the `profiles` table or fetch it differently.
  - **Simpler approach**: Add an `email` column to `profiles` table (or use `auth.users` email). The `handle_new_user` trigger already runs on signup but doesn't store email. We can update the trigger + backfill.
  - **Alternative**: Create a new edge function action `list-emails` that returns emails for given user IDs using the admin API. This avoids schema changes.

**Recommended**: Add a `list-emails` action to `manage-team-member` edge function. Then in TeamManager, after loading team, call this to get emails and display them under each member's name.

**Files**:
- `supabase/functions/manage-team-member/index.ts` — add `list-emails` action
- `src/pages/admin/TeamManager.tsx` — fetch and display emails, add email field to edit dialog

## 2. Public Registration — Foreign Address Support

**Problem**: The registration form uses CPF mask (Brazilian-only), CEP mask, and requires Brazilian address format. It doesn't support foreign addresses.

**Current state**: CPF is required, CEP is required with Brazilian format mask, state is limited to 2 chars. All fields are mandatory in the submit validation.

**Answer to user's question**: **No, the current form does NOT accept foreign addresses.** CPF, CEP, and state (UF) are all hardcoded as Brazilian format. To support foreign addresses, we'd need to make CPF/CEP optional or add a country selector.

## 3. Dashboard Renovation Section — Inactive Students Appearing

**Problem**: The "Renovação" card shows enrollments with `status = 'active'` and `end_date <= 30 days from now`. But when Johmar was set to `inactive` on the `students` table, his **enrollment** may still have `status = 'active'`. The query doesn't filter by student status.

**Fix**: In `AdminDashboard.tsx`, the `expiringQuery` needs to also filter out students whose `status` is not `active`. Add a join filter or subquery.

**File**: `src/pages/admin/AdminDashboard.tsx` — modify the expiring contracts query to exclude students with `status != 'active'`.

---

## Implementation Details

### Task 1: Team Email Display
1. Add `list-emails` action to `manage-team-member` edge function that accepts `user_ids[]` and returns `{user_id, email}[]` using `adminClient.auth.admin.getUserById()`
2. Update `TeamManager.tsx`:
   - Add `email` to `TeamMember` interface
   - After `loadTeam()`, call the edge function to get emails
   - Display email under member name in the card list
   - Deploy the updated edge function

### Task 2: Registration — Inform User
No code changes needed unless user wants foreign support. Will inform that it's Brazilian-only.

### Task 3: Fix Renovation Filter
In `AdminDashboard.tsx` line ~54, change the expiring query to filter by student status:
```
// After fetching expiringContracts, filter out inactive students
// OR modify the query to only include enrollments where the student is active
```
Since we already join `students(full_name)`, we can filter: after getting results, exclude entries where student status is inactive. Or better: also fetch `students(full_name, status)` and filter client-side, since Supabase doesn't support filtering on joined table fields directly with `.eq()` on the nested table in this context. Alternatively, update the enrollment status to 'inactive' when a student is inactivated — which is the root cause fix.

**Recommended approach**: When a student is marked inactive, also update their active enrollments to `'cancelled'` or `'inactive'`. Additionally, filter the renovation query to exclude students with inactive status as a safety net.


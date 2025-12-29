# Access Control List (ACL) System

## Table of Contents
1. [What is the ACL System?](#what-is-the-acl-system)
2. [The 5 Rule Types Explained](#the-5-rule-types-explained)
3. [Inheritance - The Magic of Parent Rules](#inheritance---the-magic-of-parent-rules)
4. [File Access - Most Restrictive Wins](#file-access---most-restrictive-wins)
5. [Role Hierarchy](#role-hierarchy)
6. [Link Sharing with Tokens](#link-sharing-with-tokens)
7. [Quick Reference](#quick-reference)
8. [Testing Your ACL Rules](#testing-your-acl-rules)

---

## What is the ACL System?

The Access Control List (ACL) system controls **who can see what content** in MOBIUS Wiki. It's flexible, powerful, and designed to keep private content completely invisible to unauthorized users.

### The Problem It Solves

Imagine you have:
- Public documentation that everyone should see
- Internal staff guides that only MOBIUS employees can access
- Library-specific procedures that only Springfield Library staff should view
- Private drafts that only you can edit
- Documents you want to share with a link, but not make publicly searchable

The ACL system handles all of these scenarios elegantly with 5 simple rule types.

### Core Principles

1. **Private by Default** (with rules) - Content with access rules is only visible to authorized users
2. **Public by Default** (without rules) - Content with NO access rules is visible to everyone
3. **OR Logic** - Matching ANY access rule grants access
4. **Inheritance** - Content can inherit rules from its parent (Page → Section → Wiki)
5. **Override** - Content with its own rules ignores parent rules completely

---

## The 5 Rule Types Explained

Each access rule has a `rule_type` and an optional `rule_value`. Here's what each type does:

### 1. Public Rule

**What it does:** Makes content accessible to everyone, including unauthenticated guests.

**Who can access:** Anyone on the internet.

**When to use:** Public documentation, help pages, general information.

**Database representation:**
```json
{
  "rule_type": "public",
  "rule_value": null
}
```

**Creating a public rule:**
```bash
curl -X POST http://localhost:10000/api/v1/pages/42/access-rules \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "ruleType": "public"
  }'
```

**Access check logic:**
```
User: Anyone (including guests)
Rule: public
Result: ✅ ALWAYS GRANTED
```

**Example scenario:**
```
Page 100: "Getting Started Guide"
Rules: [{ type: public }]

Guest user tries to access → ✅ GRANTED
Librarian tries to access → ✅ GRANTED
Staff tries to access → ✅ GRANTED
Admin tries to access → ✅ GRANTED
```

---

### 2. Role Rule

**What it does:** Restricts access to users with a specific role **or higher** in the hierarchy.

**Who can access:** Users whose role level is greater than or equal to the required role.

**When to use:** Content specific to staff levels (library staff, MOBIUS staff, site admins).

**Role hierarchy:**
```
guest (0) < library_staff (1) < mobius_staff (2) < site_admin (3)
```

**Database representation:**
```json
{
  "rule_type": "role",
  "rule_value": "mobius_staff"
}
```

**Creating a role rule:**
```bash
curl -X POST http://localhost:10000/api/v1/wikis/2/access-rules \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "ruleType": "role",
    "ruleValue": "mobius_staff"
  }'
```

**Access check logic:**
```
User role level: library_staff (1)
Required role level: mobius_staff (2)
Comparison: 1 >= 2? NO
Result: ❌ DENIED

User role level: mobius_staff (2)
Required role level: mobius_staff (2)
Comparison: 2 >= 2? YES
Result: ✅ GRANTED

User role level: site_admin (3)
Required role level: mobius_staff (2)
Comparison: 3 >= 2? YES
Result: ✅ GRANTED (higher roles inherit lower permissions)
```

**Example scenario:**
```
Wiki 2: "OpenRS Internal Documentation"
Rules: [{ type: role, value: "mobius_staff" }]

Guest (level 0) → ❌ DENIED (0 < 2)
Library Staff (level 1) → ❌ DENIED (1 < 2)
MOBIUS Staff (level 2) → ✅ GRANTED (2 >= 2)
Site Admin (level 3) → ✅ GRANTED (3 >= 2)
```

---

### 3. Library Rule

**What it does:** Restricts access to users belonging to a specific library organization.

**Who can access:** Users whose `library_id` matches the rule value.

**When to use:** Library-specific procedures, local policies, branch-specific content.

**Database representation:**
```json
{
  "rule_type": "library",
  "rule_value": "5"
}
```

**Creating a library rule:**
```bash
curl -X POST http://localhost:10000/api/v1/pages/42/access-rules \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "ruleType": "library",
    "ruleValue": "5"
  }'
```

**Access check logic:**
```
User library_id: 5
Rule value: "5"
Comparison: "5" === "5"? YES
Result: ✅ GRANTED

User library_id: 10
Rule value: "5"
Comparison: "10" === "5"? NO
Result: ❌ DENIED

User library_id: null (MOBIUS staff, no library)
Rule value: "5"
Result: ❌ DENIED (no library affiliation)
```

**Example scenario:**
```
Page 42: "Springfield Library Circulation Procedures"
Rules: [{ type: library, value: "5" }]

User from Library 5 → ✅ GRANTED
User from Library 10 → ❌ DENIED
MOBIUS Staff (no library) → ❌ DENIED
Guest → ❌ DENIED
```

⚠️ **Important:** Library rules check exact match, not hierarchy. MOBIUS staff do NOT automatically have library access unless they're also assigned to that library.

---

### 4. User Rule

**What it does:** Restricts access to a single, specific user by their user ID.

**Who can access:** Only the specified user.

**When to use:** Personal drafts, private notes, user-specific content.

**Database representation:**
```json
{
  "rule_type": "user",
  "rule_value": "42"
}
```

**Creating a user rule:**
```bash
curl -X POST http://localhost:10000/api/v1/pages/99/access-rules \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "ruleType": "user",
    "ruleValue": "42"
  }'
```

**Access check logic:**
```
User ID: 42
Rule value: "42"
Comparison: "42" === "42"? YES
Result: ✅ GRANTED

User ID: 17
Rule value: "42"
Comparison: "17" === "42"? NO
Result: ❌ DENIED (even if site_admin!)
```

**Example scenario:**
```
Page 99: "My Personal Notes"
Rules: [{ type: user, value: "42" }]

User 42 → ✅ GRANTED
User 17 (even if site_admin) → ❌ DENIED
Guest → ❌ DENIED
```

⚠️ **Important:** User rules are the MOST restrictive - even site admins can't access unless they're the specified user.

---

### 5. Link Rule (Share Tokens)

**What it does:** Grants access to anyone with the secret share token, regardless of authentication status.

**Who can access:** Anyone with the token URL (including guests).

**When to use:** Anonymous sharing, temporary access, external collaborators.

**Token format:** 64-character hexadecimal string (256-bit security)

**Database representation:**
```json
{
  "rule_type": "link",
  "rule_value": "a8f3e2c1b9d7f6e5a4c3b2d1f0e9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2c1",
  "expires_at": "2025-02-15T00:00:00Z"
}
```

**Generating a share link:**
```bash
curl -X POST http://localhost:10000/api/v1/pages/33/share-link \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "expiresAt": "2025-12-31T23:59:59Z"
  }'

# Response:
{
  "data": {
    "token": "35686b306c456da636dbab1ea7aeb99bcac9631e671fa0cd8af39e3a4502f2e3",
    "shareUrl": "/pages/33?token=35686b306c456da636dbab1ea7aeb99bcac9631e671fa0cd8af39e3a4502f2e3",
    "rule": { ... }
  }
}
```

**Accessing with a token:**
```bash
# Without token - DENIED
curl http://localhost:10000/api/v1/pages/33
# Returns: 403 Forbidden

# With token - GRANTED
curl "http://localhost:10000/api/v1/pages/33?token=35686b306c456da636dbab1ea7aeb99bcac9631e671fa0cd8af39e3a4502f2e3"
# Returns: Page data
```

**Access check logic:**
```
Token provided: "abc123..."
Rule value: "abc123..."
Token match: YES
Expiration: 2025-12-31
Current date: 2025-01-15
Expired: NO
Result: ✅ GRANTED

Token provided: "wrong_token"
Rule value: "abc123..."
Token match: NO
Result: ❌ DENIED

Token provided: "abc123..."
Expiration: 2024-12-31
Current date: 2025-01-15
Expired: YES
Result: ❌ DENIED (token expired)
```

**Example scenario:**
```
Page 33: "Confidential Report - Shared with External Auditor"
Rules: [{ type: link, value: "35686b30...", expires_at: "2025-12-31" }]

Guest with token → ✅ GRANTED (until 2025-12-31)
Guest without token → ❌ DENIED
Staff without token → ❌ DENIED (having an account doesn't help)
After 2025-12-31 → ❌ DENIED (token expired)
```

🔒 **Security Note:** Link-shared content is NOT discoverable via search. Users must have the exact URL with token to access it.

---

## Inheritance - The Magic of Parent Rules

Inheritance is what makes the ACL system powerful and easy to manage. Instead of setting rules on every single page, you can set rules at the wiki or section level and pages automatically inherit them.

### The Inheritance Chain

```
┌─────────────────┐
│      Page       │  ← Has rules? Use them. Done.
│   (Most         │     No rules? Check parent ↓
│   Specific)     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│    Section      │  ← Has rules? Use them. Done.
│                 │     No rules? Check parent ↓
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│      Wiki       │  ← Has rules? Use them. Done.
│   (Least        │     No rules? Content is PUBLIC
│   Specific)     │
└─────────────────┘
```

### How Inheritance Works - The Algorithm

When someone tries to access a page, here's EXACTLY what happens:

```typescript
function canAccess(user, contentType, contentId, token) {
  // Step 1: Get rules for THIS content
  const rules = getRules(contentType, contentId);

  // Step 2: If no rules, check parent
  if (rules.length === 0) {
    const parent = getParent(contentType, contentId);

    if (parent) {
      // Recursive: check parent's access
      return canAccess(user, parent.type, parent.id, token);
    }

    // No parent and no rules = PUBLIC
    return true;
  }

  // Step 3: Rules exist - check if ANY match
  for (const rule of rules) {
    if (matchesRule(rule, user, token)) {
      return true;  // ✅ Access granted
    }
  }

  // Step 4: No rule matched
  return false;  // ❌ Access denied
}
```

### Example 1: Page Inherits Public Access from Wiki

**Setup:**
```
Wiki 1 "Folio"
  Rules: [{ type: public }]

  Section 5 "Getting Started"
    Rules: [] (no rules)

    Page 100 "First Login Guide"
      Rules: [] (no rules)
```

**Guest user tries to access Page 100:**

```
Step 1: Check Page 100 rules
  → Found: [] (empty)
  → Decision: No rules, check parent

Step 2: Check Section 5 (parent of Page 100)
  → Found: [] (empty)
  → Decision: No rules, check parent

Step 3: Check Wiki 1 (parent of Section 5)
  → Found: [{ type: public }]
  → Decision: Rules exist! Check if any match

Step 4: Check rule { type: public }
  → Public rule ALWAYS matches
  → ✅ GRANTED

Final: Guest can access Page 100
```

**Why this works:** The page "inherited" the public rule from its grandparent wiki.

---

### Example 2: Page with Own Rule Ignores Parent

**Setup:**
```
Wiki 1 "Folio"
  Rules: [{ type: public }]

  Section 5 "Getting Started"
    Rules: [] (no rules)

    Page 101 "Staff-Only Troubleshooting"
      Rules: [{ type: role, value: "library_staff" }]
```

**Guest user tries to access Page 101:**

```
Step 1: Check Page 101 rules
  → Found: [{ type: role, value: "library_staff" }]
  → Decision: Rules exist! Check if any match

Step 2: Check role rule
  → Guest role level: 0
  → Required role level: 1 (library_staff)
  → Comparison: 0 >= 1? NO
  → ❌ DENIED

Final: Guest CANNOT access Page 101

⚠️ IMPORTANT: Wiki's public rule is IGNORED
   because Page 101 has its own rules!
```

**Why this works:** Own rules completely replace parent rules. The page is NOT public even though the wiki is.

---

### Example 3: Multi-Level Inheritance

**Setup:**
```
Wiki 2 "OpenRS Internal"
  Rules: [{ type: role, value: "mobius_staff" }]

  Section 10 "Installation"
    Rules: [{ type: public }]  ← Section overrides wiki!

    Page 200 "Quick Install"
      Rules: [] (no rules)
```

**Guest user tries to access Page 200:**

```
Step 1: Check Page 200 rules
  → Found: [] (empty)
  → Decision: No rules, check parent

Step 2: Check Section 10 (parent of Page 200)
  → Found: [{ type: public }]
  → Decision: Rules exist! Check if any match

Step 3: Check public rule
  → Public rule ALWAYS matches
  → ✅ GRANTED

Final: Guest CAN access Page 200

⚠️ NOTICE: We never checked Wiki 2's rules!
   Section 10 had rules, so we stopped there.
```

**Why this works:** Section 10 is public (overriding the wiki's staff-only restriction), and Page 200 inherits from Section 10.

---

### Example 4: OR Logic - Multiple Rules

**Setup:**
```
Page 42 "Circulation Policy"
  Rules: [
    { type: role, value: "library_staff" },
    { type: library, value: "5" }
  ]
```

**Three users try to access:**

**User A: library_staff from Library 10**
```
Check rule 1 { type: role, value: "library_staff" }
  → User role: library_staff (level 1)
  → Required: library_staff (level 1)
  → 1 >= 1? YES
  → ✅ GRANTED (don't even check rule 2)
```

**User B: guest from Library 5 (not possible, but hypothetically)**
```
Check rule 1 { type: role, value: "library_staff" }
  → User role: guest (level 0)
  → Required: library_staff (level 1)
  → 0 >= 1? NO
  → Continue to rule 2

Check rule 2 { type: library, value: "5" }
  → User library_id: 5
  → Rule value: "5"
  → "5" === "5"? YES
  → ✅ GRANTED
```

**User C: guest (no library)**
```
Check rule 1 { type: role, value: "library_staff" }
  → User role: guest (level 0)
  → 0 >= 1? NO
  → Continue to rule 2

Check rule 2 { type: library, value: "5" }
  → User library_id: null
  → Cannot match
  → ❌ DENIED

Final: No rules matched → DENIED
```

**Key Takeaway:** OR logic means you only need to match ONE rule to gain access.

---

## Inheritance - The Magic of Parent Rules

### Visual: How Inheritance Flows

```
┌──────────────────────────────────────────────────────────┐
│ Wiki 1: "Folio"                                          │
│ Rules: [{ type: public }]                                │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Section 3: "Setup Guides"                          │  │
│  │ Rules: [] ← INHERITS from Wiki 1                   │  │
│  │                                                     │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │ Page 50: "Installation"                      │  │  │
│  │  │ Rules: [] ← INHERITS from Section 3          │  │  │
│  │  │           ← which INHERITS from Wiki 1       │  │  │
│  │  │                                               │  │  │
│  │  │ Effective Access: PUBLIC                     │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  │                                                     │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │ Page 51: "Advanced Config"                   │  │  │
│  │  │ Rules: [{ type: role, value: "mobius_staff" }]│  │
│  │  │                                               │  │  │
│  │  │ Effective Access: MOBIUS STAFF ONLY          │  │  │
│  │  │ (own rules OVERRIDE parent)                  │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### The Key Rule: Own Rules Override Everything

When content has its own access rules, **all parent rules are completely ignored**.

This is NOT additive - it's a complete replacement:

```
❌ WRONG Understanding:
   "Page has user=42 rule, wiki has public rule,
    so BOTH user 42 AND public can access"

✅ CORRECT Understanding:
   "Page has user=42 rule, so ONLY user 42 can access.
    Wiki's public rule is completely ignored."
```

### Walking Through the Algorithm - Real Example

Let's trace through accessing Page 33 as a guest user:

**Database state:**
```sql
-- Page 33
SELECT * FROM wiki.pages WHERE id = 33;
-- section_id: 2

-- Access rules for Page 33
SELECT * FROM wiki.access_rules WHERE ruleable_type = 'page' AND ruleable_id = 33;
-- Result: [{ rule_type: 'link', rule_value: '35686b306...' }]
```

**Trace:**
```
canAccess(guest_user, 'page', 33, no_token)

  Step 1: getRules('page', 33)
    → Found: [{ type: 'link', value: '35686b306...' }]
    → Rules exist, skip inheritance

  Step 2: Loop through rules
    Rule: { type: 'link', value: '35686b306...' }

    Check: matchesRule(rule, guest_user, no_token)
      → Token provided? NO
      → return false

    No more rules to check

  Step 3: No rules matched
    → return false

Result: ❌ ACCESS DENIED
```

**Now with token:**
```
canAccess(guest_user, 'page', 33, '35686b306...')

  Step 1: getRules('page', 33)
    → Found: [{ type: 'link', value: '35686b306...' }]

  Step 2: Check link rule
    → Token provided: '35686b306...'
    → Rule value: '35686b306...'
    → Match? YES
    → Expires at: 2026-12-31
    → Current date: 2025-12-19
    → Expired? NO
    → return true

Result: ✅ ACCESS GRANTED
```

---

## File Access - Most Restrictive Wins

Files are special in the ACL system because they can be linked to multiple pieces of content (pages, wikis, sections, users). The access control for files uses a "**most restrictive wins**" approach.

### The Two-Part Check

To access a file, a user must pass BOTH checks:

```
┌─────────────────────────────────────────────┐
│ Check 1: Can user access the FILE itself?  │
│ (Based on file's own access_rules)         │
└──────────────┬──────────────────────────────┘
               │
               ↓ YES (or file has no rules)
┌─────────────────────────────────────────────┐
│ Check 2: Can user access at least ONE      │
│ piece of linked content?                    │
│ (Based on each linked content's ACL)       │
└──────────────┬──────────────────────────────┘
               │
               ↓ YES
         ✅ GRANTED
```

### Algorithm Walkthrough

```typescript
function canAccessFile(user, fileId, token) {
  // Part 1: Check file's own ACL
  const fileRules = getRules('file', fileId);

  let fileAccessGranted;
  if (fileRules.length === 0) {
    fileAccessGranted = true;  // No file rules = file is public
  } else {
    fileAccessGranted = anyRuleMatches(fileRules, user, token);
  }

  if (!fileAccessGranted) {
    return false;  // ❌ Can't even access the file
  }

  // Part 2: Check linked content
  const links = getFileLinks(fileId);  // Get all file_links

  if (links.length === 0) {
    return fileAccessGranted;  // No links = file rules only
  }

  // User must access at least ONE linked content
  for (const link of links) {
    if (canAccess(user, link.type, link.id, token)) {
      return true;  // ✅ User can access this linked content
    }
  }

  return false;  // ❌ Can't access any linked content
}
```

### Example 1: File + Public Page = Guest Allowed

**Setup:**
```
File 81 "user-manual.pdf"
  Rules: [] (no rules on file)
  Linked to: Page 34 "User Manual"

Page 34 "User Manual"
  Rules: [{ type: public }]
```

**Guest tries to access File 81:**
```
Part 1: Check File 81
  → Rules: [] (empty)
  → File access: ✅ GRANTED (no rules = public)

Part 2: Check linked content
  → File is linked to: Page 34
  → Check: canAccess(guest, 'page', 34)
    → Page 34 rules: [{ type: public }]
    → Public rule matches
    → ✅ GRANTED

Final: Guest can access File 81
       (passed both file check AND linked content check)
```

---

### Example 2: File + Private Page = Guest Denied

**Setup:**
```
File 82 "internal-memo.pdf"
  Rules: [] (no rules on file)
  Linked to: Page 33 "Confidential Memo"

Page 33 "Confidential Memo"
  Rules: [{ type: link, value: "35686b306..." }]
```

**Guest (no token) tries to access File 82:**
```
Part 1: Check File 82
  → Rules: [] (empty)
  → File access: ✅ GRANTED (no rules = public)

Part 2: Check linked content
  → File is linked to: Page 33
  → Check: canAccess(guest, 'page', 33, no_token)
    → Page 33 rules: [{ type: link, value: "35686b306..." }]
    → Guest has no token
    → ❌ DENIED

Final: Guest CANNOT access File 82
       (file was OK, but linked page was denied)
```

⚠️ **Key Insight:** Even though the file itself has no rules (public), the guest can't access it because they can't access the linked page.

---

### Example 3: File with Own Rules + Linked Content

**Setup:**
```
File 90 "restricted-document.pdf"
  Rules: [{ type: role, value: "library_staff" }]
  Linked to: Page 50 "Reference Page"

Page 50 "Reference Page"
  Rules: [{ type: public }]
```

**Three users try to access File 90:**

**Guest user:**
```
Part 1: Check File 90
  → Rules: [{ type: role, value: "library_staff" }]
  → Guest role: 0
  → Required: library_staff (1)
  → 0 >= 1? NO
  → ❌ DENIED at file level

Final: ❌ DENIED (didn't even check linked page)
```

**Library staff user:**
```
Part 1: Check File 90
  → Rules: [{ type: role, value: "library_staff" }]
  → User role: library_staff (1)
  → Required: library_staff (1)
  → 1 >= 1? YES
  → ✅ File access granted

Part 2: Check linked content
  → File is linked to: Page 50
  → Check: canAccess(library_staff_user, 'page', 50)
    → Page 50 rules: [{ type: public }]
    → ✅ GRANTED

Final: ✅ GRANTED (passed both checks)
```

**MOBIUS staff user:**
```
Part 1: Check File 90
  → Rules: [{ type: role, value: "library_staff" }]
  → User role: mobius_staff (2)
  → Required: library_staff (1)
  → 2 >= 1? YES (higher role)
  → ✅ File access granted

Part 2: Check linked content
  → Page 50 is public
  → ✅ GRANTED

Final: ✅ GRANTED
```

---

### Why "Most Restrictive Wins"?

This design prevents a security loophole:

**Without this protection:**
```
Scenario: Sensitive file linked to public page
Result: Anyone could access sensitive file via public page link
Risk: Data breach
```

**With "most restrictive wins":**
```
Scenario: Sensitive file linked to public page
File has role=mobius_staff rule
Result: Only MOBIUS staff can access file, even though page is public
Protection: File access requires BOTH file permission AND page permission
```

---

## Role Hierarchy

The MOBIUS Wiki has 4 role levels, each with increasing permissions:

```
Level 0: guest              (unauthenticated users)
  ↓
Level 1: library_staff      (library employees)
  ↓
Level 2: mobius_staff       (MOBIUS consortium employees)
  ↓
Level 3: site_admin         (system administrators)
```

### How Role Comparison Works

The system uses `>=` (greater than or equal) comparison:

```typescript
function hasRoleAccess(userRole, requiredRole) {
  const userLevel = ROLE_LEVELS[userRole] || 0;
  const requiredLevel = ROLE_LEVELS[requiredRole];
  return userLevel >= requiredLevel;
}
```

### Permission Inheritance Table

| User Role | Can Access Role Rule → | guest | library_staff | mobius_staff | site_admin |
|-----------|------------------------|-------|---------------|--------------|------------|
| **guest** (0) | | ✅ | ❌ | ❌ | ❌ |
| **library_staff** (1) | | ✅ | ✅ | ❌ | ❌ |
| **mobius_staff** (2) | | ✅ | ✅ | ✅ | ❌ |
| **site_admin** (3) | | ✅ | ✅ | ✅ | ✅ |

### Examples

**Content requires `library_staff`:**
- guest (0 >= 1?) → ❌ NO
- library_staff (1 >= 1?) → ✅ YES
- mobius_staff (2 >= 1?) → ✅ YES (higher role)
- site_admin (3 >= 1?) → ✅ YES (higher role)

**Content requires `mobius_staff`:**
- guest (0 >= 2?) → ❌ NO
- library_staff (1 >= 2?) → ❌ NO
- mobius_staff (2 >= 2?) → ✅ YES
- site_admin (3 >= 2?) → ✅ YES (higher role)

⚠️ **Special Case - User Rules Override Hierarchy:**

```
Page has rule: { type: user, value: "17" }

Even site_admin (level 3) CANNOT access
unless their user ID is 17!

User rules are the ultimate restriction.
```

---

## Link Sharing with Tokens

Link sharing allows you to grant temporary, anonymous access to content without requiring users to log in.

### How Tokens Are Generated

Tokens use Node.js `crypto.randomBytes(32)` to generate 64-character hexadecimal strings:

```typescript
import * as crypto from 'crypto';

function generateShareToken(): string {
  return crypto.randomBytes(32).toString('hex');
  // Example: "a8f3e2c1b9d7f6e5a4c3b2d1f0e9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2c1"
  // 32 bytes = 256 bits of entropy
}
```

**Security:** With 2^256 possible tokens, brute-forcing is computationally impossible.

### Creating a Share Link

**Request:**
```bash
curl -X POST http://localhost:10000/api/v1/pages/33/share-link \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "expiresAt": "2025-12-31T23:59:59Z"
  }'
```

**Response:**
```json
{
  "data": {
    "token": "35686b306c456da636dbab1ea7aeb99bcac9631e671fa0cd8af39e3a4502f2e3",
    "shareUrl": "/pages/33?token=35686b306c456da636dbab1ea7aeb99bcac9631e671fa0cd8af39e3a4502f2e3",
    "rule": {
      "id": 129,
      "ruleable_type": "page",
      "ruleable_id": 33,
      "rule_type": "link",
      "rule_value": "35686b306c456da636dbab1ea7aeb99bcac9631e671fa0cd8af39e3a4502f2e3",
      "expires_at": "2025-12-31T23:59:59.000Z",
      "created_at": "2025-12-19T04:57:01.278Z",
      "created_by": 41
    }
  }
}
```

### Using the Share Link

**Without token (DENIED):**
```bash
curl http://localhost:10000/api/v1/pages/33
# Response: 403 Forbidden
```

**With token (GRANTED):**
```bash
curl "http://localhost:10000/api/v1/pages/33?token=35686b306c456da636dbab1ea7aeb99bcac9631e671fa0cd8af39e3a4502f2e3"
# Response: 200 OK with page data
```

### Token Expiration

Tokens can have an optional expiration date:

```typescript
// Creating a token that expires in 30 days
{
  "expiresAt": "2025-02-15T00:00:00Z"
}

// Creating a token that never expires
{
  // expiresAt not provided = null in database
}
```

**Expiration check:**
```typescript
if (rule.expires_at) {
  const now = new Date();
  const expiresAt = new Date(rule.expires_at);

  if (expiresAt < now) {
    return false;  // ❌ Token expired
  }
}
return true;  // ✅ Token valid
```

### Security Considerations

**✅ Good Security Practices:**
- Tokens are cryptographically random (can't be guessed)
- Tokens are stored in database (can be revoked by deleting the rule)
- Expiration is enforced server-side (client can't bypass)
- Link-shared content is NOT searchable (not discoverable)

**🔒 Privacy Note:**
```
Page with ONLY link rules → NOT in search results
Page with link + public rules → IS in search results

Why? Pure link-shared content should not be discoverable.
You must have the exact URL to access it.
```

---

## Quick Reference

### Rule Type Cheat Sheet

| Rule Type | Grants Access To | Typical Use |
|-----------|-----------------|-------------|
| `public` | Everyone (including guests) | Public documentation, help pages |
| `role` | Users with role level ≥ required | Staff-only content, internal docs |
| `library` | Users from specific library | Library-specific procedures |
| `user` | Single specific user | Personal drafts, private notes |
| `link` | Anyone with the token | Anonymous sharing, external collaborators |

### Inheritance Flow Chart

```
┌─────────────────────┐
│ Accessing Page 100  │
└──────────┬──────────┘
           │
           ↓
    ┌──────────────┐
    │ Page 100     │
    │ has rules?   │
    └──┬────────┬──┘
       │ YES    │ NO
       ↓        ↓
    ┌──────┐  ┌────────────┐
    │ Use  │  │ Check      │
    │ page │  │ Section 5  │
    │rules │  │ (parent)   │
    └──────┘  └─────┬──────┘
                    │
                    ↓
              ┌──────────────┐
              │ Section has  │
              │ rules?       │
              └──┬────────┬──┘
                 │ YES    │ NO
                 ↓        ↓
              ┌─────┐  ┌────────┐
              │ Use │  │ Check  │
              │sect │  │ Wiki 1 │
              │rules│  │(parent)│
              └─────┘  └────┬───┘
                            │
                            ↓
                      ┌──────────┐
                      │ Wiki has │
                      │ rules?   │
                      └──┬───┬───┘
                         │YES│NO
                         ↓   ↓
                      ┌────┐┌────────┐
                      │Use ││PUBLIC  │
                      │wiki││(default)│
                      │rule││        │
                      └────┘└────────┘
```

### Common Scenarios and Outcomes

| Scenario | Rules | Guest Access | Library Staff | MOBIUS Staff | Site Admin |
|----------|-------|--------------|---------------|--------------|------------|
| Public wiki, no page rules | Wiki: public | ✅ | ✅ | ✅ | ✅ |
| Staff wiki, no page rules | Wiki: role=mobius_staff | ❌ | ❌ | ✅ | ✅ |
| Public wiki, staff-only page | Wiki: public<br>Page: role=mobius_staff | ❌ | ❌ | ✅ | ✅ |
| Staff wiki, public section | Wiki: role=mobius_staff<br>Section: public | ✅ | ✅ | ✅ | ✅ |
| Link-only page | Page: link=abc123... | ❌ (no token) | ❌ (no token) | ❌ (no token) | ❌ (no token) |
| Link-only page (with token) | Page: link=abc123... | ✅ (with token) | ✅ (with token) | ✅ (with token) | ✅ (with token) |
| User-specific page | Page: user=42 | ❌ | ❌ (even if admin) | ❌ (even if admin) | ❌ (unless ID=42) |
| Library-specific page | Page: library=5 | ❌ | ✅ (if library 5) | ❌ | ❌ |

---

## Testing Your ACL Rules

### Test Setup

First, log in to get session cookies:

```bash
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mobius.org",
    "password": "admin123"
  }'
```

### Testing Public Rule

**Create public rule:**
```bash
curl -b cookies.txt -X POST http://localhost:10000/api/v1/pages/34/access-rules \
  -H "Content-Type: application/json" \
  -d '{"ruleType": "public"}'
```

**Test as guest (no cookies):**
```bash
curl http://localhost:10000/api/v1/pages/34
# Expected: 200 OK with page data
```

---

### Testing Role Rule

**Create role rule:**
```bash
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis/2/access-rules \
  -H "Content-Type: application/json" \
  -d '{
    "ruleType": "role",
    "ruleValue": "mobius_staff"
  }'
```

**Test as guest:**
```bash
curl http://localhost:10000/api/v1/wikis/2
# Expected: 403 Forbidden
```

**Test as site_admin:**
```bash
curl -b cookies.txt http://localhost:10000/api/v1/wikis/2
# Expected: 200 OK (site_admin level 3 >= mobius_staff level 2)
```

---

### Testing Link Rule (Share Token)

**Generate share link:**
```bash
curl -b cookies.txt -X POST http://localhost:10000/api/v1/pages/33/share-link \
  -H "Content-Type: application/json" \
  -d '{
    "expiresAt": "2026-12-31T23:59:59Z"
  }'
# Response includes: "token": "35686b306..."
```

**Test without token (DENIED):**
```bash
curl http://localhost:10000/api/v1/pages/33
# Expected: 403 Forbidden
```

**Test with token (GRANTED):**
```bash
curl "http://localhost:10000/api/v1/pages/33?token=35686b306c456da636dbab1ea7aeb99bcac9631e671fa0cd8af39e3a4502f2e3"
# Expected: 200 OK with page data
```

---

### Testing Library Rule

**Create library rule:**
```bash
curl -b cookies.txt -X POST http://localhost:10000/api/v1/pages/42/access-rules \
  -H "Content-Type: application/json" \
  -d '{
    "ruleType": "library",
    "ruleValue": "1"
  }'
```

**Test with user from library 1:**
```bash
# Log in as librarian@springfield.org (library_id = 1)
curl -c lib_cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "librarian@springfield.org", "password": "admin123"}'

curl -b lib_cookies.txt http://localhost:10000/api/v1/pages/42
# Expected: 200 OK
```

**Test with user from different library:**
```bash
# User from library 2 tries to access
# Expected: 403 Forbidden
```

---

### Testing User Rule

**Create user rule:**
```bash
curl -b cookies.txt -X POST http://localhost:10000/api/v1/pages/99/access-rules \
  -H "Content-Type: application/json" \
  -d '{
    "ruleType": "user",
    "ruleValue": "41"
  }'
```

**Test as the specified user (ID 41):**
```bash
# Log in as user 41
curl -b user41_cookies.txt http://localhost:10000/api/v1/pages/99
# Expected: 200 OK
```

**Test as different user (even site_admin):**
```bash
curl -b cookies.txt http://localhost:10000/api/v1/pages/99
# Expected: 403 Forbidden (even admins can't access)
```

---

### Testing Inheritance

**Setup: Wiki with public rule, page with no rules**
```bash
# Create public rule on wiki
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis/1/access-rules \
  -H "Content-Type: application/json" \
  -d '{"ruleType": "public"}'

# Get pages in that wiki (they should inherit public access)
curl http://localhost:10000/api/v1/sections/1/pages
# Expected: 200 OK with list of pages

# Access a specific page as guest
curl http://localhost:10000/api/v1/pages/3
# Expected: 200 OK (inherited public from wiki)
```

---

### Testing File Access (Most Restrictive)

**Upload and link file:**
```bash
# Upload file
curl -b cookies.txt -F "file=@test.pdf" \
  http://localhost:10000/api/v1/files
# Response: { "data": { "id": 81, ... } }

# Link to a public page
curl -b cookies.txt -X POST \
  http://localhost:10000/api/v1/files/81/link/pages/34
```

**Test access as guest:**
```bash
# Page 34 is public, so guest should access file
curl http://localhost:10000/api/v1/files/81
# Expected: 200 OK

curl http://localhost:10000/api/v1/files/81/download
# Expected: 200 OK with file download
```

**Link to private page:**
```bash
# Link same file to private page
curl -b cookies.txt -X POST \
  http://localhost:10000/api/v1/files/81/link/pages/33
# (page 33 has link token)

# Test access as guest without token
curl http://localhost:10000/api/v1/files/81
# Expected: 200 OK (can still access via page 34)

# Remove link to public page
curl -b cookies.txt -X DELETE \
  http://localhost:10000/api/v1/files/81/link/pages/34

# Test again
curl http://localhost:10000/api/v1/files/81
# Expected: 403 Forbidden (only linked to private page now)
```

---

## Managing Access Rules via API

### List Rules for Content

```bash
curl -b cookies.txt \
  http://localhost:10000/api/v1/pages/33/access-rules
```

**Response:**
```json
{
  "data": [
    {
      "id": 129,
      "ruleable_type": "page",
      "ruleable_id": 33,
      "rule_type": "link",
      "rule_value": "35686b306...",
      "expires_at": "2026-12-31T23:59:59.000Z",
      "created_at": "2025-12-19T04:57:01.278Z",
      "created_by": 41
    }
  ]
}
```

### Create Access Rule

```bash
curl -b cookies.txt -X POST \
  http://localhost:10000/api/v1/pages/42/access-rules \
  -H "Content-Type: application/json" \
  -d '{
    "ruleType": "role",
    "ruleValue": "library_staff"
  }'
```

### Delete Access Rule

```bash
curl -b cookies.txt -X DELETE \
  http://localhost:10000/api/v1/access-rules/129
```

**Result:** Rule is permanently deleted. Content permissions change immediately.

---

## Troubleshooting Common Issues

### Issue 1: "I created a public rule but guests still can't access"

**Possible causes:**
1. **Content has OTHER rules** - Remember: ANY matching rule grants access, but if there's a user-specific rule, public rule won't help
2. **Parent has more restrictive rules** - Wait, that's wrong! Own rules override parent...
3. **Content is soft-deleted** - Check `deleted_at IS NOT NULL`

**Debug steps:**
```bash
# Check all rules for the content
curl -b cookies.txt http://localhost:10000/api/v1/pages/42/access-rules

# Check if content exists
curl -b cookies.txt http://localhost:10000/api/v1/pages/42?includeDeleted=true
```

---

### Issue 2: "My page inherits the wrong rules"

**Check inheritance chain:**
```sql
-- Get page's section
SELECT section_id FROM wiki.pages WHERE id = 100;

-- Get section's wiki
SELECT wiki_id FROM wiki.sections WHERE id = 5;

-- Check rules at each level
SELECT * FROM wiki.access_rules WHERE ruleable_type = 'page' AND ruleable_id = 100;
SELECT * FROM wiki.access_rules WHERE ruleable_type = 'section' AND ruleable_id = 5;
SELECT * FROM wiki.access_rules WHERE ruleable_type = 'wiki' AND ruleable_id = 1;
```

**Remember:** If page has ANY rules, it IGNORES parent completely.

---

### Issue 3: "File access isn't working as expected"

**Remember the two-part check:**
1. User must pass file's ACL
2. User must pass at least ONE linked content's ACL

**Debug steps:**
```bash
# Check file rules
curl -b cookies.txt http://localhost:10000/api/v1/files/81/access-rules

# Check what content the file is linked to
curl http://localhost:10000/api/v1/files/linked/pages/34

# Check each linked content's rules
curl -b cookies.txt http://localhost:10000/api/v1/pages/34/access-rules
```

---

### Issue 4: "Token isn't working"

**Checklist:**
1. ✅ Token is in query parameter: `?token=xxx`
2. ✅ Token matches rule_value EXACTLY (case-sensitive)
3. ✅ Token hasn't expired (check `expires_at`)
4. ✅ Rule still exists (hasn't been deleted)

**Test token directly:**
```bash
# Get page rules
curl -b cookies.txt http://localhost:10000/api/v1/pages/33/access-rules

# Copy exact token from rule_value
# Test access
curl "http://localhost:10000/api/v1/pages/33?token=PASTE_EXACT_TOKEN_HERE"
```

---

## Summary

The MOBIUS Wiki ACL system provides:

✅ **Flexibility** - 5 rule types for different scenarios
✅ **Simplicity** - OR logic (any match = access)
✅ **Inheritance** - Set rules once at wiki level
✅ **Override** - Fine-tune at section/page level
✅ **Security** - Private content completely invisible
✅ **Sharing** - Anonymous token-based sharing
✅ **Hierarchy** - Role-based permissions with inheritance

**Key Principle:** Content with rules is private. Content without rules is public. Inheritance lets you manage permissions efficiently.

For more information:
- [Authentication Guide](./02-authentication.md)
- [Content Management API](./04-content-management.md)
- [File Management](./06-file-management.md)

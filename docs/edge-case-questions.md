# MOBIUS Wiki - Edge Case Questions

Use this document to think through edge cases before building. Sort your answers into the cost categories, then prioritize accordingly.

---

## Cost Categories Reference

- **Cheap to fix later**: UI tweaks, new fields, display logic
- **Annoying but survivable**: Schema additions, validation changes, component refactors
- **Expensive and painful**: Core relationships, URL structures, permission models, versioning
- **Basically impossible**: Data you never captured, trust you lost

---

## Schema & Data Model

### Expensive and Painful
- Do articles have versions? Can users roll back to a previous version?
- What happens when a user is deleted? Orphan their articles? Reassign? Delete?
- What happens when a category is deleted? Orphan articles? Reassign? Block deletion?
- Can an article belong to multiple categories, or just one?
- Are slugs immutable, or do they change when titles change?
- Do you need soft deletes, or is hard delete acceptable?
- What's your primary key strategy? Auto-increment? UUIDs?
- Do you need audit fields on every table (created_by, updated_by, deleted_by)?

### Annoying but Survivable
- What metadata do articles need? Tags? Keywords? Summary/excerpt?
- Do you need article templates for common documentation patterns?
- Should articles have an "owner" separate from "author"?
- Do you need to track view counts or "last viewed" dates?
- Can articles be pinned or featured?
- Do you need related articles or "see also" links?
- Should categories have descriptions or icons?

### Cheap to Fix Later
- What fields should be required vs optional?
- Do you need custom fields or is the schema fixed?
- Should articles have a table of contents auto-generated from headings?

---

## Authentication & Sessions

### Expensive and Painful
- What happens when someone is removed from SSO but has articles attributed to them?
- How do you handle role changes while a user is actively logged in?
- Can service accounts or API keys access the system, or only human users?
- Do you need to support multiple authentication methods?

### Annoying but Survivable
- What happens when a session expires mid-edit? Is draft content preserved?
- Can someone be logged in on multiple devices simultaneously?
- How long should sessions last before requiring re-authentication?
- Do you need "remember me" functionality?

### Cheap to Fix Later
- What does the login error experience look like?
- How do you handle SSO being temporarily unavailable?

---

## Permissions & Access Control

### Expensive and Painful
- What's the permission model? Role-based? Per-article? Per-category?
- What roles exist? (Admin, Editor, Viewer, etc.)
- Can consortium members see all public articles, or only certain categories?
- Are there articles that only specific people can see (not just role-based)?
- Can permissions be delegated? Can an admin make someone else an admin?
- Do draft articles have different visibility than published articles?

### Annoying but Survivable
- Can viewers see that a restricted article exists, or is it completely hidden?
- Can someone share a direct link to a draft? Should they be able to?
- What happens when someone follows a link to an article they can't access?
- Can editors edit anyone's articles, or only their own?
- Can you restrict who can publish vs who can only save drafts?

### Cheap to Fix Later
- What does the "access denied" page look like?
- How do you communicate why someone can't access something?

---

## Article Editor

### Expensive and Painful
- What format is content stored in? Markdown? HTML? Rich text JSON?
- How do you handle concurrent editing (two people editing the same article)?
- How do you sanitize content to prevent XSS attacks?
- Do you need real-time collaborative editing, or is locking acceptable?

### Annoying but Survivable
- What happens when someone pastes from Microsoft Word?
- What happens when someone pastes an image? Upload? Base64? Reject?
- Can users embed videos, iframes, or external content?
- Is there autosave? How frequently? Where does it save to?
- What happens if the browser tab closes accidentally?
- What's the maximum article size? What happens when someone hits it?
- Do you need support for code blocks with syntax highlighting?
- Can users create tables in articles?
- Do you need image resizing or cropping in the editor?

### Cheap to Fix Later
- What toolbar options does the editor expose?
- Can users switch between visual and source/markdown view?
- What keyboard shortcuts should be supported?

---

## Categories & Organization

### Expensive and Painful
- Can categories be nested? How deep?
- Can an article exist without a category?
- What's the URL structure for categories?

### Annoying but Survivable
- What happens if someone creates two categories with the same name?
- Can categories be renamed? What happens to URLs/bookmarks?
- Can categories be merged?
- Can you reorder categories, or are they alphabetical?
- Can categories be archived/hidden without deleting?

### Cheap to Fix Later
- What does the category picker UI look like?
- How do you display deeply nested categories in navigation?
- Can categories have icons or colors?

---

## Search

### Expensive and Painful
- What's your search backend? Postgres full-text? Elasticsearch? Something else?
- What fields are searchable? Title? Body? Tags? All of the above?
- How do you keep the search index in sync with content changes?

### Annoying but Survivable
- How do you handle partial matches? "Outlook" vs "Microsoft Outlook"?
- How do you handle typos? "Outlock" should find "Outlook"
- How do you rank results? Recency? Relevance? Views?
- What about search within a specific category?
- Do you index file attachment contents?
- How fresh is search? Can you find an article immediately after publishing?

### Cheap to Fix Later
- What does "no results" look like? Do you suggest alternatives?
- How many results per page? Pagination or infinite scroll?
- Do you highlight search terms in results?
- Can users filter or sort search results?

---

## Files & Attachments

### Expensive and Painful
- Where do files live? Local disk? S3? Database?
- What's your file naming/organization strategy? Can filenames collide?
- Can the same file be attached to multiple articles, or is it duplicated?
- What happens to attachments when an article is deleted?

### Annoying but Survivable
- What file types are allowed? What's explicitly blocked?
- What's the maximum file size?
- What's the maximum total storage per article?
- How do you handle files with the same name uploaded to the same article?
- Can users replace an attachment, or only delete and re-upload?
- Do you generate thumbnails for images?

### Cheap to Fix Later
- What does the file upload UI look like?
- How do you display attachments in articles? Inline? List at bottom?
- Can users drag-and-drop files?

---

## Content Display & Formatting

### Annoying but Survivable
- What happens with very long titles? Truncate? Wrap? Break layout?
- What happens with very wide images? Scale down? Horizontal scroll?
- What happens with very long code blocks?
- How do you handle mobile display?
- Do you need print-friendly styles?
- Do you need a dark mode?

### Cheap to Fix Later
- What typography and styling for article content?
- How do you style different heading levels?
- What about blockquotes, callouts, warnings, tips?
- Do you show word count or reading time?

---

## Versioning & History

### Expensive and Painful
- Do you need version history at all?
- What gets stored in each version? Full content snapshot? Diff?
- Can any user see history, or only editors/admins?
- Can any user restore a previous version, or only certain roles?

### Annoying but Survivable
- How long do you keep version history? Forever? Time limit? Version limit?
- Can you compare two versions side-by-side?
- Can you see what specifically changed between versions?
- Do you track who made each change?

### Cheap to Fix Later
- What does the version history UI look like?
- How do you indicate when an article was last updated and by whom?

---

## Publishing Workflow

### Expensive and Painful
- Is there an approval workflow, or can anyone publish immediately?
- What statuses can an article have? (Draft, Review, Published, Archived?)
- Who can change an article's status?

### Annoying but Survivable
- Can you schedule an article to publish in the future?
- Can you unpublish an article without deleting it?
- Do you need a review/approval process before publishing?
- What happens to a published article when someone edits it? New draft version?
- Can you have multiple draft versions of a published article?

### Cheap to Fix Later
- How do you indicate draft vs published in the UI?
- What's the publish confirmation flow?

---

## Notifications & Communication

### Annoying but Survivable
- Does anyone get notified when an article is published?
- Does the author get notified when someone else edits their article?
- Can users subscribe to categories for updates?
- Can users subscribe to specific articles for changes?
- How are notifications delivered? Email? In-app? Both?

### Cheap to Fix Later
- What do notification emails look like?
- Can users control notification preferences?
- Is there a notification center in the app?

---

## Admin & Maintenance

### Expensive and Painful
- What admin functions do you need? User management? Bulk operations?
- Can you export all content for backup or migration?
- Can you import content from another system?

### Annoying but Survivable
- Can you bulk-update or bulk-delete articles?
- Can you bulk-reassign articles from one user to another?
- Can you merge duplicate articles?
- Can you see system-wide analytics? Most viewed articles? Most active editors?
- How do you identify stale content that needs updating?
- Can you force a password reset or session invalidation for a user?

### Cheap to Fix Later
- What does the admin dashboard show?
- What audit logs do you expose in the UI?

---

## Performance & Scale

### Annoying but Survivable
- How many articles do you expect? 100? 1,000? 10,000?
- How many concurrent users?
- What queries will be slow? Article listing? Search? History?
- Are you caching anything? What invalidates the cache?
- Do you need database indexes beyond the defaults?
- What happens during traffic spikes (e.g., after sending a newsletter)?

### Cheap to Fix Later
- Do you paginate article lists?
- Do you lazy-load anything?
- Are images optimized/compressed?

---

## Deployment & Infrastructure

### Expensive and Painful
- Where does this run? On-prem? Cloud? Which provider?
- How do you deploy updates? Manual? CI/CD?
- What's your rollback strategy if a deployment breaks something?

### Annoying but Survivable
- Do you have a staging environment?
- How do you handle database migrations during deployment?
- What happens to active users during deployment? Downtime? Graceful handling?
- How do you manage environment variables and secrets?
- Who has production access?

### Cheap to Fix Later
- How do you promote code from staging to production?
- Do you have deployment notifications?

---

## Monitoring & Reliability

### Expensive and Painful
- How do you know the system is down?
- What monitoring/alerting do you have?

### Annoying but Survivable
- What do you log? Where do logs go? How long are they retained?
- How do you track errors? Do you get notified?
- Do you have health check endpoints?
- What's your on-call or incident response process?
- How do you handle partial outages (e.g., search is down but wiki is up)?

### Cheap to Fix Later
- Do you have a status page?
- How do you communicate outages to users?

---

## Backup & Recovery

### Basically Impossible (if you don't plan it)
- How do you back up the database?
- How do you back up uploaded files?
- Have you ever tested restoring from a backup?

### Annoying but Survivable
- How frequently do you back up?
- How long do you retain backups?
- Can you do point-in-time recovery?
- What's your documented recovery procedure?
- How long would recovery take?

---

## Security

### Expensive and Painful
- Are you using parameterized queries to prevent SQL injection?
- How do you sanitize user input to prevent XSS?
- Do you have CSRF protection?
- How do you validate file uploads? Can someone upload malicious files?

### Annoying but Survivable
- Do you have rate limiting on login, search, API endpoints?
- Are you logging authentication failures?
- Do you have account lockout after failed attempts?
- How do you handle password/token storage?
- Are sensitive data in URLs (tokens, etc.)?
- What security headers do you set? (CSP, X-Frame-Options, etc.)

### Cheap to Fix Later
- Do you have a security.txt file?
- How do you handle security vulnerability reports?

---

## Migration & Launch

### Basically Impossible (once you've launched)
- How do you migrate existing content from Bluespice?
- How do you preserve URLs/links from the old system?
- How do you migrate user accounts and permissions?
- How do you handle content that exists in both systems during transition?

### Annoying but Survivable
- Do you run both systems in parallel during transition?
- How do you communicate the change to users?
- Do you have a rollback plan if launch goes badly?
- How do you handle broken links from external sources?
- Do you need redirects from old URLs to new URLs?

---

## Accessibility

### Annoying but Survivable
- Can someone using a screen reader navigate the wiki?
- Is there sufficient color contrast?
- Does it work keyboard-only?
- Do images have alt text?
- Are form inputs properly labeled?
- Do you use semantic HTML?

### Cheap to Fix Later
- Do you have skip links for navigation?
- Do you support reduced motion preferences?
- What's the focus indicator style?

---

## Legal & Compliance

### Expensive and Painful
- Are there data retention requirements?
- Are there privacy requirements for user data?
- Do consortium agreements govern shared documentation?

### Annoying but Survivable
- Do you need a privacy policy?
- Do you need terms of service?
- Do you need to track consent for anything?
- Can users request their data be deleted?
- Do you need audit logs for compliance purposes?

---

## The Human Stuff

### Basically Impossible (to recover from)
- What does success look like? How will you know this project worked?
- Who owns this after launch? Who decides what features get added?
- What happens when you're unavailable and something breaks?

### Annoying but Survivable
- How do users report bugs or request features?
- Who handles content disputes between departments?
- What are the content standards? Who enforces them?
- How do you onboard new staff to the system?
- Who trains consortium members?

### Cheap to Fix Later
- Is there in-app help or documentation?
- Is there a feedback mechanism in the UI?

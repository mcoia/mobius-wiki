# Toast Notifications Implementation Plan

## Overview

Add ngx-toastr toast notifications to MOBIUS Wiki frontend to replace browser `alert()` calls and provide better user feedback for actions like publishing pages, creating sections, and handling errors.

**Approach**: Use ngx-toastr library (top-right position, auto-dismiss for success/info, manual dismiss for errors/warnings, with close buttons and icons).

---

## Current State Analysis

**Problems:**
- Browser `alert()` used for success messages (blocking, poor UX)
- Inconsistent error handling across components
- No visual feedback system for background operations
- Inline errors work for forms but not for global actions

**Existing Infrastructure:**
- ✅ CSS custom properties for status colors (--color-success, --color-danger, etc.)
- ✅ Lucide-angular icons installed
- ✅ Angular 21 standalone components
- ❌ No toast notification library
- ❌ No HTTP error interceptor

---

## Implementation Steps

### Phase 1: Install Dependencies (5 min)

**Install packages:**
```bash
cd frontend
npm install ngx-toastr@latest @angular/animations --save
```

**Expected versions:**
- ngx-toastr: ^19.0.0
- @angular/animations: ^21.0.0

---

### Phase 2: Configure Angular App (10 min)

**File:** `frontend/src/app/app.config.ts`

**Add imports:**
```typescript
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
```

**Add to providers array:**
```typescript
provideAnimations(),
provideToastr({
  timeOut: 3000,
  positionClass: 'toast-top-right',
  preventDuplicates: true,
  progressBar: true,
  closeButton: true,
  tapToDismiss: false,
  maxOpened: 3,
  autoDismiss: false,
  newestOnTop: true,
  enableHtml: false,
})
```

**Verify:** Run `ng serve` and ensure no errors.

---

### Phase 3: Add Custom Styling (15 min)

**Create:** `frontend/src/styles/toast.css`

**Key styles to include:**
- Import ngx-toastr base: `@import 'ngx-toastr/toastr';`
- Toast container with `z-index: 9999`
- Base toast styles (box-shadow, border-radius, padding, width: 350px)
- Status variants using CSS custom properties:
  - `.toast-success` → `var(--color-success)`, `var(--color-success-bg)`
  - `.toast-error` → `var(--color-danger)`, `var(--color-danger-bg)`
  - `.toast-warning` → `var(--color-warning)`, `var(--color-warning-bg)`
  - `.toast-info` → `var(--color-info)`, `var(--color-info-bg)`
- Left border accent (4px solid) matching note-box pattern
- Close button styling (position: absolute, right: 8px, top: 8px)
- Progress bar (height: 3px, opacity: 0.6)
- Animations (flyInLeft, fadeOut)

**Update:** `frontend/angular.json`

Add to styles array (line ~32):
```json
"styles": [
  "src/styles/mobius-ui.css",
  "src/styles/toast.css",
  "src/styles.css"
]
```

**Verify:** Restart dev server, check browser dev tools that toast.css loads.

---

### Phase 4: Create Toast Service (20 min)

**Create:** `frontend/src/app/core/services/toast.service.ts`

**Service structure:**
```typescript
import { Injectable } from '@angular/core';
import { ToastrService, IndividualConfig } from 'ngx-toastr';

@Injectable({ providedIn: 'root' })
export class ToastService {
  constructor(private toastr: ToastrService) {}

  // Success: auto-dismiss 3 seconds
  success(message: string, title: string = 'Success'): void { ... }

  // Error: manual dismiss only (timeOut: 0)
  error(message: string, title: string = 'Error'): void { ... }

  // Warning: manual dismiss only
  warning(message: string, title: string = 'Warning'): void { ... }

  // Info: auto-dismiss 5 seconds
  info(message: string, title: string = 'Info'): void { ... }

  // Convenience method for HTTP errors
  showApiError(error: any, fallbackMessage: string = 'An unexpected error occurred'): void {
    // Extract error.error?.message or error.message
    // Handle 404, 403, 401, 500+ status codes with specific titles
  }

  clear(): void { this.toastr.clear(); }
}
```

**Key decisions:**
- Success/info: auto-dismiss (3s/5s) with progress bar
- Error/warning: manual dismiss (timeOut: 0, disableTimeOut: true), no progress bar
- All toasts: closeButton: true, tapToDismiss: false

**Verify:** Test in browser console:
```javascript
inject(ToastService).success('Test message')
```

---

### Phase 5: Create HTTP Error Interceptor (20 min) - OPTIONAL

**Create:** `frontend/src/app/core/interceptors/http-error.interceptor.ts`

**Purpose:** Auto-toast critical server errors (500, network failures).

**Key features:**
- Export `HttpContextToken` named `SUPPRESS_ERROR_TOAST` for opt-out
- Intercept HTTP errors using `catchError`
- Auto-toast only:
  - `status >= 500` → "Server Error"
  - `status === 0` → "Connection Error" (network failure)
- Do NOT auto-toast: 400, 401, 403, 404 (handled by components)
- Always re-throw error so component handlers still execute

**Register in:** `frontend/src/app/app.config.ts`

```typescript
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';

provideHttpClient(
  withInterceptors([
    httpCredentialsInterceptor,
    httpErrorInterceptor
  ])
)
```

**Verify:** Force a 500 error or disconnect network, ensure toast appears.

---

### Phase 6: Refactor wiki-page-viewer.ts (30 min)

**File:** `frontend/src/app/pages/wiki-page-viewer/wiki-page-viewer.ts`

**Changes:**

1. **Add import:**
```typescript
import { ToastService } from '../../core/services/toast.service';
```

2. **Inject in constructor:**
```typescript
constructor(
  private route: ActivatedRoute,
  private router: Router,
  private wikiService: WikiService,
  private sanitizer: DomSanitizer,
  private authService: AuthService,
  private pageContext: PageContextService,
  private toastService: ToastService // NEW
) {}
```

3. **Replace all `alert()` calls:**

| Location Pattern | Current | Replacement |
|-----------------|---------|-------------|
| Section created | `alert('Section created...')` | `toastService.success('You can now create pages in this section.', 'Section Created')` |
| Page published | `alert('Page published!')` | `toastService.success('Your changes are now live!', 'Page Published')` |
| Cannot create page | `alert('Cannot create page...')` | `toastService.error('No valid section selected')` |
| No page loaded | `alert('No page loaded')` | `toastService.error('No page is currently loaded')` |
| Already published | `alert('Already published')` | `toastService.info('This page is already published')` |
| Error responses | `alert(error.error?.message ...)` | `toastService.showApiError(error, 'Failed to ...')` |

4. **Keep inline errors + add toasts:**

For `saveError` property (line ~341-352), keep the inline error assignment AND add:
```typescript
this.toastService.showApiError(err, 'Failed to save page');
```

**Rationale:** Inline errors persist in UI context, toasts grab immediate attention. Both are appropriate for save operations.

**Do NOT change:**
- Login component (inline errors appropriate for forms)
- Create modal component (inline errors appropriate for modals)
- Form validation errors (inline only)

**Verify after each change:**
- Create section → Success toast
- Publish page → Success toast
- Delete page → Confirmation + success toast
- Network error → Error toast (if interceptor enabled)

---

### Phase 7: Search for Other alert() Usages (5 min)

**Command:**
```bash
cd frontend
grep -r "alert(" src/app --include="*.ts" | grep -v "node_modules"
```

**Action:** Replace any additional `alert()` calls found using the same patterns as wiki-page-viewer.ts.

---

## Critical Files Summary

| File Path | Action | Purpose |
|-----------|--------|---------|
| `frontend/src/app/app.config.ts` | Edit | Add animations + toastr providers |
| `frontend/src/styles/toast.css` | Create | Custom MOBIUS-themed toast styles |
| `frontend/angular.json` | Edit | Include toast.css in build |
| `frontend/src/app/core/services/toast.service.ts` | Create | Wrapper service with app-specific defaults |
| `frontend/src/app/core/interceptors/http-error.interceptor.ts` | Create | Auto-toast critical HTTP errors (optional) |
| `frontend/src/app/pages/wiki-page-viewer/wiki-page-viewer.ts` | Edit | Replace alert() calls with toasts |

---

## Verification & Testing

### Manual Testing Checklist

**Success toasts:**
- [ ] Create section → Success toast appears top-right, auto-dismisses ~3s
- [ ] Publish page → Success toast appears, auto-dismisses
- [ ] Close button works

**Error toasts:**
- [ ] Delete non-existent page → Error toast appears, does NOT auto-dismiss
- [ ] Network disconnected + action → Connection error toast
- [ ] Close button works

**Info toasts:**
- [ ] Try to publish already-published page → Info toast

**Visual tests:**
- [ ] Toast colors match MOBIUS theme (compare to note-boxes)
- [ ] Progress bar visible on success/info toasts
- [ ] Progress bar NOT visible on error/warning toasts
- [ ] Toast positioned top-right
- [ ] Toast readable on all backgrounds
- [ ] Max 3 toasts at once

**Accessibility:**
- [ ] Close button keyboard accessible (Tab + Enter)
- [ ] Screen reader announces toasts (ARIA)

### Build Test

```bash
cd frontend
ng build --configuration production
```

**Expected:** No errors, bundle size increase < 100KB.

---

## Rollback Plan

If issues occur:

**Quick rollback:**
1. Revert `app.config.ts` (remove toastr providers)
2. Remove `ToastService` injections
3. Restore original `alert()` calls
4. Comment out toast.css import in angular.json

**Full uninstall:**
```bash
npm uninstall ngx-toastr
git checkout -- frontend/src/app/app.config.ts
git checkout -- frontend/src/app/pages/wiki-page-viewer/wiki-page-viewer.ts
```

---

## Success Criteria

Implementation complete when:

✅ All 4 toast types work (success, error, warning, info)
✅ Positioned top-right
✅ Success/info auto-dismiss (3-5 seconds)
✅ Error/warning manual dismiss only
✅ Close button on all toasts
✅ No `alert()` calls remain in codebase
✅ Toast styling matches MOBIUS UI Kit colors
✅ No console errors
✅ App builds successfully

---

## Architecture Decisions

### Why wrap ToastrService?
- Enforces consistent timeout behavior per toast type
- Provides `showApiError()` convenience method
- Easier to change behavior globally
- Better testability

### Why hybrid HTTP interceptor approach?
- Auto-toast critical errors (500, network) for consistency
- Components handle expected errors (404, 403) with custom messages
- Opt-out available via `SUPPRESS_ERROR_TOAST` context

### Why keep some inline errors?
- Form/modal errors should remain inline (user is looking at form)
- Save errors show BOTH inline + toast (attention + context)
- Toasts are for global actions, not field validation

---

## Future Enhancements (Out of Scope)

Not included in this implementation:
- Lucide icons in toasts (requires custom toast component)
- Action buttons ("Undo", "View") - add later if needed
- Toast positioning preferences (always top-right for now)
- Toast history/log feature

---

## Timeline Estimate

**Total: 2-3 hours**

- Phase 1-2: Installation & config (15 min)
- Phase 3: Styling (15 min)
- Phase 4: Toast service (20 min)
- Phase 5: HTTP interceptor (20 min) - optional
- Phase 6: Refactor wiki-page-viewer (30 min)
- Phase 7: Testing & verification (30 min)

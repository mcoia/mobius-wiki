import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `
    <footer class="site-footer">
      <div class="footer-content">
        <nav class="footer-links">
          <a routerLink="/wiki/site/main/about">About</a>
          <span class="footer-separator">&middot;</span>
          <a routerLink="/wiki/site/main/contact">Contact</a>
          <span class="footer-separator">&middot;</span>
          <a routerLink="/wiki/site/main/privacy">Privacy Policy</a>
          <span class="footer-separator">&middot;</span>
          <a routerLink="/wiki/site/main/terms">Terms of Use</a>
        </nav>
        <span class="footer-copyright">&copy; 2026 MOBIUS - Linking Libraries</span>
      </div>
    </footer>
  `,
  styles: [`
    .site-footer {
      flex-shrink: 0;
      background: var(--bg-page);
      color: var(--gray-600);
      padding: var(--space-lg) var(--space-2xl);
      border-top: 1px solid var(--gray-200);
      margin-left: var(--sidebar-left-width);
    }

    .footer-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    }

    .footer-copyright {
      color: var(--gray-500);
      font-size: 12px;
    }

    .footer-links {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .footer-links a {
      color: var(--gray-600);
      text-decoration: none;
      transition: color 0.2s;
    }

    .footer-links a:hover {
      color: var(--gray-800);
    }

    .footer-separator {
      color: var(--gray-400);
    }

    @media (max-width: 768px) {
      .footer-links {
        flex-wrap: wrap;
        justify-content: center;
      }
    }
  `]
})
export class Footer {}

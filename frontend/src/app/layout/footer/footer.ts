import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  template: `
    <footer class="site-footer">
      <div class="footer-content">
        <nav class="footer-links">
          <a href="#">About</a>
          <span class="footer-separator">&middot;</span>
          <a href="#">Contact</a>
          <span class="footer-separator">&middot;</span>
          <a href="#">Privacy Policy</a>
          <span class="footer-separator">&middot;</span>
          <a href="#">Terms of Use</a>
        </nav>
        <span class="footer-copyright">&copy; 2025 MOBIUS Library Consortium</span>
      </div>
    </footer>
  `,
  styles: [`
    .site-footer {
      flex-shrink: 0;
      background: var(--bg-sidebar-left);
      color: rgba(255, 255, 255, 0.8);
      padding: var(--space-lg) var(--space-2xl);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .footer-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    }

    .footer-copyright {
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
    }

    .footer-links {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .footer-links a {
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      transition: color 0.2s;
    }

    .footer-links a:hover {
      color: white;
    }

    .footer-separator {
      color: rgba(255, 255, 255, 0.4);
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

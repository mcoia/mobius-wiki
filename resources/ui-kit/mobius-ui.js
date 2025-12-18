/*!
 * MOBIUS Wiki UI Kit - JavaScript
 * Version: 1.0.0
 * Description: Interactive functionality for MOBIUS documentation pages
 * Dependencies: Mermaid (optional, for diagrams)
 */

(function() {
    'use strict';

    /**
     * Initialize Mermaid diagrams if library is loaded
     */
    function initMermaid() {
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({
                startOnLoad: true,
                theme: 'default',
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true,
                    curve: 'basis'
                },
                sequence: {
                    diagramMarginX: 50,
                    diagramMarginY: 10,
                    actorMargin: 50,
                    width: 150,
                    height: 65,
                    boxMargin: 10,
                    boxTextMargin: 5,
                    noteMargin: 10,
                    messageMargin: 35
                },
                gantt: {
                    titleTopMargin: 25,
                    barHeight: 20,
                    barGap: 4,
                    topPadding: 50,
                    leftPadding: 75,
                    gridLineStartPadding: 35,
                    fontSize: 11,
                    numberSectionStyles: 4,
                    axisFormat: '%Y-%m-%d'
                }
            });
        }
    }

    /**
     * Smooth scrolling for anchor links
     */
    function initSmoothScrolling() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');

                // Skip if href is just '#' or empty
                if (!href || href === '#') {
                    return;
                }

                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });

                    // Update URL without jumping
                    if (history.pushState) {
                        history.pushState(null, null, href);
                    }
                }
            });
        });
    }

    /**
     * Mobile menu toggle (future enhancement)
     */
    function initMobileMenu() {
        // Placeholder for mobile menu functionality
        // Can be implemented when needed
    }

    /**
     * Search box functionality (placeholder)
     */
    function initSearch() {
        const searchInput = document.querySelector('.search-box input');
        if (searchInput) {
            searchInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    const query = this.value.trim();
                    if (query) {
                        // Placeholder: implement search functionality
                        console.log('Search query:', query);
                    }
                }
            });
        }
    }

    /**
     * Highlight active nav item based on current page
     */
    function highlightActiveNav() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-menu a');

        navLinks.forEach(link => {
            const linkPath = link.getAttribute('href');
            if (linkPath && currentPath.endsWith(linkPath)) {
                link.classList.add('active');
            }
        });
    }

    /**
     * Initialize all UI functionality
     */
    function init() {
        initMermaid();
        initSmoothScrolling();
        initMobileMenu();
        initSearch();
        highlightActiveNav();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded
        init();
    }

})();

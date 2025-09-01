(function () {
    'use strict';

    let blockedCategories = [];
    let observer = null;

    // Cross-browser compatibility for extension APIs
    const extensionAPI = (function () {
        if (typeof browser !== 'undefined') {
            return browser;
        } else if (typeof chrome !== 'undefined') {
            return chrome;
        }
        return null;
    })();

    async function loadBlockedCategories() {
        try {
            const result = await extensionAPI.storage.sync.get(['blockedCategories']);
            blockedCategories = result.blockedCategories || [];
            console.log('Loaded blocked categories:', blockedCategories);
        } catch (error) {
            console.error('Error loading blocked categories:', error);
            blockedCategories = [];
        }
    }

    function isCategoryBlocked(categoryName) {
        if (!categoryName) return false;
        const normalizedCategory = categoryName.toLowerCase().trim();
        return blockedCategories.some(blocked =>
            blocked.toLowerCase().trim() === normalizedCategory
        );
    }

    function extractCategoryFromCard(card) {
        const categoryLink = card.querySelector('a[href^="/category/"]');
        if (categoryLink) {
            const href = categoryLink.getAttribute('href');
            const match = href.match(/\/category\/(.+)/);
            if (match) {
                const categorySlug = decodeURIComponent(match[1]);
                return categorySlug.replace(/-/g, ' ');
            }
        }

        const categoryText = card.querySelector('a[href^="/category/"] span');
        if (categoryText) {
            return categoryText.textContent.trim();
        }

        return null;
    }

    function hideStreamCard(card, category) {
        card.style.display = 'none';
        card.setAttribute('data-kick-blocker-hidden', 'true');
        card.setAttribute('data-kick-blocker-category', category);
        console.log(`Hidden stream with category: ${category}`);
    }

    function showStreamCard(card) {
        card.style.display = '';
        card.removeAttribute('data-kick-blocker-hidden');
        card.removeAttribute('data-kick-blocker-category');
    }

    function processStreamCard(card) {
        if (card.hasAttribute('data-kick-blocker-processed')) {
            return;
        }

        const category = extractCategoryFromCard(card);
        if (category) {
            card.setAttribute('data-kick-blocker-processed', 'true');
            card.setAttribute('data-kick-blocker-original-category', category);

            if (isCategoryBlocked(category)) {
                hideStreamCard(card, category);
            }
        }
    }

    function processAllStreamCards() {
        const streamCards = document.querySelectorAll('.group\\/card, [class*="group/card"]');

        streamCards.forEach(card => {
            processStreamCard(card);
        });

        const alternativeCards = document.querySelectorAll('div[class*="group"] a[href^="/category/"]');
        alternativeCards.forEach(categoryLink => {
            let card = categoryLink.closest('div[class*="group"]');
            if (card && !card.hasAttribute('data-kick-blocker-processed')) {
                processStreamCard(card);
            }
        });
    }

    function reprocessAllCards() {
        const allCards = document.querySelectorAll('[data-kick-blocker-processed]');

        allCards.forEach(card => {
            const originalCategory = card.getAttribute('data-kick-blocker-original-category');
            const isHidden = card.hasAttribute('data-kick-blocker-hidden');
            const shouldBeBlocked = isCategoryBlocked(originalCategory);

            if (shouldBeBlocked && !isHidden) {
                hideStreamCard(card, originalCategory);
            } else if (!shouldBeBlocked && isHidden) {
                showStreamCard(card);
            }
        });
    }

    function setupObserver() {
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver((mutations) => {
            let hasNewContent = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.classList && (node.classList.contains('group/card') || node.className.includes('group/card'))) {
                                hasNewContent = true;
                            }
                            else if (node.querySelector && node.querySelector('.group\\/card, [class*="group/card"]')) {
                                hasNewContent = true;
                            }
                        }
                    });
                }
            });

            if (hasNewContent) {
                clearTimeout(window.kickBlockerTimeout);
                window.kickBlockerTimeout = setTimeout(processAllStreamCards, 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    extensionAPI.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.blockedCategories) {
            console.log('Blocked categories updated:', changes.blockedCategories.newValue);
            blockedCategories = changes.blockedCategories.newValue || [];
            reprocessAllCards();
        }
    });

    function addContextMenuToCard(card) {
        const category = card.getAttribute('data-kick-blocker-original-category');
        if (!category) return;

        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            const isBlocked = isCategoryBlocked(category);
            const action = isBlocked ? 'Unblock' : 'Block';

            if (confirm(`${action} category "${category}"?`)) {
                toggleCategoryBlock(category);
            }
        });
    }

    async function toggleCategoryBlock(category) {
        try {
            const isBlocked = isCategoryBlocked(category);

            if (isBlocked) {
                blockedCategories = blockedCategories.filter(blocked =>
                    blocked.toLowerCase().trim() !== category.toLowerCase().trim()
                );
            } else {
                if (!blockedCategories.includes(category)) {
                    blockedCategories.push(category);
                }
            }

            await extensionAPI.storage.sync.set({ blockedCategories });
            console.log(`${isBlocked ? 'Unblocked' : 'Blocked'} category: ${category}`);
        } catch (error) {
            console.error('Error toggling category block:', error);
        }
    }

    async function init() {
        console.log('Kick Category Blocker: Initializing...');

        if (!extensionAPI) {
            console.error('Extension API not available');
            return;
        }

        await loadBlockedCategories();
        processAllStreamCards();
        setupObserver();

        const existingCards = document.querySelectorAll('[data-kick-blocker-processed]');
        existingCards.forEach(addContextMenuToCard);

        console.log('Kick Category Blocker: Ready!');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            setTimeout(processAllStreamCards, 500);
        }
    });
})();

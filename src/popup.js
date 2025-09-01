document.addEventListener('DOMContentLoaded', async function () {
    const categoryInput = document.getElementById('categoryInput');
    const addButton = document.getElementById('addButton');
    const blockedList = document.getElementById('blockedList');
    const popularButtons = document.querySelectorAll('.category-btn');

    let blockedCategories = [];

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
            renderBlockedList();
            updatePopularButtons();
        } catch (error) {
            console.error('Error loading blocked categories:', error);
        }
    }

    async function saveBlockedCategories() {
        try {
            await extensionAPI.storage.sync.set({ blockedCategories });
        } catch (error) {
            console.error('Error saving blocked categories:', error);
        }
    }

    async function addCategory(categoryName) {
        const trimmedCategory = categoryName.trim();
        if (!trimmedCategory) return;

        const isAlreadyBlocked = blockedCategories.some(category =>
            category.toLowerCase() === trimmedCategory.toLowerCase()
        );

        if (isAlreadyBlocked) {
            showMessage('Category already blocked!', 'error');
            return;
        }

        blockedCategories.push(trimmedCategory);
        await saveBlockedCategories();
        renderBlockedList();
        updatePopularButtons();
        categoryInput.value = '';
        showMessage('Category blocked successfully!', 'success');
    }

    async function removeCategory(categoryName) {
        blockedCategories = blockedCategories.filter(category =>
            category.toLowerCase() !== categoryName.toLowerCase()
        );
        await saveBlockedCategories();
        renderBlockedList();
        updatePopularButtons();
        showMessage('Category unblocked!', 'success');
    }

    function isCategoryBlocked(categoryName) {
        return blockedCategories.some(category =>
            category.toLowerCase() === categoryName.toLowerCase()
        );
    }

    function renderBlockedList() {
        // Clear existing content
        blockedList.innerHTML = '';

        if (blockedCategories.length === 0) {
            const noCategories = document.createElement('div');
            noCategories.className = 'no-categories';
            noCategories.textContent = 'No categories blocked yet';
            blockedList.appendChild(noCategories);
            return;
        }

        // Create elements safely without innerHTML
        blockedCategories.forEach(category => {
            const blockedItem = document.createElement('div');
            blockedItem.className = 'blocked-item';

            const categoryName = document.createElement('span');
            categoryName.className = 'blocked-item-name';
            categoryName.textContent = category; // Safe text assignment

            const removeButton = document.createElement('button');
            removeButton.className = 'remove-btn';
            removeButton.textContent = 'Remove';
            removeButton.setAttribute('data-category', category);

            // Add click event listener directly
            removeButton.addEventListener('click', () => {
                removeCategory(category);
            });

            blockedItem.appendChild(categoryName);
            blockedItem.appendChild(removeButton);
            blockedList.appendChild(blockedItem);
        });
    }

    function updatePopularButtons() {
        popularButtons.forEach(button => {
            const category = button.getAttribute('data-category');
            if (isCategoryBlocked(category)) {
                button.classList.add('blocked');
                button.textContent = `✓ ${category}`;
            } else {
                button.classList.remove('blocked');
                button.textContent = category;
            }
        });
    }

    function showMessage(text, type) {
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;
        message.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            z-index: 1000;
            ${type === 'success' ? 'background-color: #53fc18; color: #000;' : 'background-color: #ff4444; color: #fff;'}
        `;

        document.body.appendChild(message);

        setTimeout(() => {
            message.remove();
        }, 2000);
    }

    addButton.addEventListener('click', () => {
        addCategory(categoryInput.value);
    });

    categoryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addCategory(categoryInput.value);
        }
    });

    popularButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.getAttribute('data-category');
            if (isCategoryBlocked(category)) {
                removeCategory(category);
            } else {
                addCategory(category);
            }
        });
    });

    await loadBlockedCategories();
});

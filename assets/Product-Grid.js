// Current selected variant ID
let selectedVariantId = null;
let currentProductHandle = null;
let currentProduct = null;

// Product cache for instant modal loading
const productCache = {};

// Prefetch all products on page load
document.addEventListener('DOMContentLoaded', function () {
    const popups = document.querySelectorAll('.product-popup[data-product-handle]');
    popups.forEach(function (popup) {
        const handle = popup.dataset.productHandle;
        if (handle && !productCache[handle]) {
            prefetchProduct(handle);
        }
    });
});

// Prefetch a single product
async function prefetchProduct(handle) {
    try {
        const response = await fetch('/products/' + handle + '.js');
        const product = await response.json();
        productCache[handle] = product;
    } catch (error) {
        console.error('Error prefetching product:', handle, error);
    }
}

function toggleProductPopup(element) {
    const container = element.closest('.detail-container');

    // Close all other popups first
    document.querySelectorAll('.detail-container.active').forEach(function (activeContainer) {
        if (activeContainer !== container) {
            activeContainer.classList.remove('active');
        }
    });

    // Toggle current popup
    container.classList.toggle('active');
}

// Close popup when clicking outside
document.addEventListener('click', function (event) {
    if (event.target && !event.target.closest('.detail-container')) {
        document.querySelectorAll('.detail-container.active').forEach(function (container) {
            container.classList.remove('active');
        });
    }
});

// Open Add to Cart Modal
function openAddToCartModal(popupElement) {
    event.stopPropagation();

    const productHandle = popupElement.dataset.productHandle;
    const productTitle = popupElement.dataset.productTitle;
    const productPrice = popupElement.dataset.productPrice;
    const productImage = popupElement.dataset.productImage;
    const productDescription = popupElement.dataset.productDescription;
    const firstVariantId = popupElement.dataset.firstVariantId;

    // Set modal content
    document.getElementById('atcProductImage').src = productImage;
    document.getElementById('atcProductImage').alt = productTitle;
    document.getElementById('atcProductTitle').textContent = productTitle;
    document.getElementById('atcProductPrice').textContent = productPrice;
    document.getElementById('atcProductDescription').textContent = productDescription || '';

    // Store product info
    currentProductHandle = productHandle;
    selectedVariantId = firstVariantId;

    // Use cached product if available, otherwise fetch
    if (productCache[productHandle]) {
        loadProductVariants(productCache[productHandle]);
    } else {
        fetchProductVariants(productHandle);
    }

    // Show modal
    document.getElementById('atcModalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Add to Cart Modal
function closeAddToCartModal(event) {
    if (event) event.stopPropagation();
    document.getElementById('atcModalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

// Format money with currency
function formatMoney(cents) {
    if (typeof Shopify !== 'undefined' && Shopify.formatMoney) {
        return Shopify.formatMoney(cents);
    }
    // Fallback formatting with currency symbol
    const amount = (cents / 100).toFixed(2);
    return amount + '€';
}

// Load product variants from cache (instant)
function loadProductVariants(product) {
    const container = document.getElementById('atcVariantsContainer');
    currentProduct = product;

    // Update price with proper currency
    document.getElementById('atcProductPrice').textContent = formatMoney(product.price);

    // Check if product has meaningful options
    const hasOptions = product.options && product.options.length > 0;
    const isSingleDefaultOption = product.options.length === 1 &&
        (product.options[0] === 'Title' || (product.options[0].name && product.options[0].name === 'Title'));

    if (hasOptions && !isSingleDefaultOption) {
        renderVariantOptions(product);
    } else if (product.variants && product.variants.length >= 1) {
        selectedVariantId = product.variants[0].id;
        container.innerHTML = '';
    } else {
        container.innerHTML = '';
    }
}

// Fetch product variants from Shopify (fallback if not cached)
async function fetchProductVariants(handle) {
    const container = document.getElementById('atcVariantsContainer');
    container.innerHTML = '<p style="font-size: 12px; color: #666;">Loading options...</p>';

    try {
        const response = await fetch('/products/' + handle + '.js');
        const product = await response.json();

        // Cache for future use
        productCache[handle] = product;

        // Use the same loading logic
        loadProductVariants(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        container.innerHTML = '';
    }
}

// Render variant options
function renderVariantOptions(product) {
    const container = document.getElementById('atcVariantsContainer');
    container.innerHTML = '';

    // product.options can be array of strings OR array of objects
    // Handle both cases

    product.options.forEach(function (option, optionIndex) {
        // Get option name - could be string or object with name property
        const optionName = typeof option === 'string' ? option : (option.name || option);

        // Skip if option is just "Title" (default for single variant products)
        if (optionName === 'Title') return;

        const values = [];
        product.variants.forEach(function (variant) {
            const optionValue = variant.options[optionIndex];
            if (optionValue && !values.includes(optionValue)) {
                values.push(optionValue);
            }
        });

        if (values.length === 0) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'atc-variant-group';

        const label = document.createElement('span');
        label.className = 'atc-variant-label';
        label.textContent = optionName;
        groupDiv.appendChild(label);

        const isSize = String(optionName).toLowerCase() === 'size';

        if (isSize) {
            // Use dropdown for size
            const select = document.createElement('select');
            select.className = 'atc-size-select';
            select.dataset.optionIndex = optionIndex;

            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Choose your ' + optionName.toLowerCase();
            select.appendChild(defaultOption);

            values.forEach(function (value) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            });

            select.addEventListener('change', function () {
                updateSelectedVariant(product);
            });

            groupDiv.appendChild(select);
        } else {
            // Use buttons for color or other options
            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'atc-variant-options';
            optionsDiv.dataset.optionIndex = optionIndex;

            values.forEach(function (value, idx) {
                const btn = document.createElement('button');
                btn.className = 'atc-variant-btn';
                btn.type = 'button';
                btn.textContent = value;
                btn.dataset.optionValue = value;

                if (idx === 0) btn.classList.add('selected');

                btn.addEventListener('click', function () {
                    // Remove selected from siblings
                    optionsDiv.querySelectorAll('.atc-variant-btn').forEach(function (b) {
                        b.classList.remove('selected');
                    });
                    btn.classList.add('selected');
                    updateSelectedVariant(product);
                });

                optionsDiv.appendChild(btn);
            });

            groupDiv.appendChild(optionsDiv);
        }

        container.appendChild(groupDiv);
    });

    // Set initial variant
    updateSelectedVariant(product);
}

// Update selected variant based on current selections
function updateSelectedVariant(product) {
    const selectedOptions = [];

    // Get selected values from buttons
    document.querySelectorAll('.atc-variant-options').forEach(function (optionsDiv) {
        const selectedBtn = optionsDiv.querySelector('.atc-variant-btn.selected');
        if (selectedBtn) {
            selectedOptions[parseInt(optionsDiv.dataset.optionIndex)] = selectedBtn.dataset.optionValue;
        }
    });

    // Get selected values from dropdowns
    document.querySelectorAll('.atc-size-select').forEach(function (select) {
        if (select.value) {
            selectedOptions[parseInt(select.dataset.optionIndex)] = select.value;
        }
    });

    // Find matching variant
    const matchingVariant = product.variants.find(function (variant) {
        return product.options.every(function (optionName, index) {
            if (!selectedOptions[index]) return true; // Skip if not selected yet
            return variant.options[index] === selectedOptions[index];
        });
    });

    if (matchingVariant) {
        selectedVariantId = matchingVariant.id;
        // Update price display with currency
        document.getElementById('atcProductPrice').textContent = formatMoney(matchingVariant.price);
    }
}

// Add to Cart function
async function addToCart() {
    if (!selectedVariantId) {
        alert('Please select all options');
        return;
    }

    const addBtn = document.getElementById('atcAddBtn');
    const originalText = addBtn.innerHTML;
    addBtn.innerHTML = 'ADDING...';
    addBtn.disabled = true;

    try {
        const response = await fetch('/cart/add.js', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: selectedVariantId,
                quantity: 1
            })
        });

        if (response.ok) {
            addBtn.innerHTML = 'ADDED! ✓';

            // Update cart count if theme supports it
            updateCartCount();

            setTimeout(function () {
                addBtn.innerHTML = originalText;
                addBtn.disabled = false;
                closeAddToCartModal();
            }, 1500);
        } else {
            const error = await response.json();
            alert(error.message || 'Could not add to cart');
            addBtn.innerHTML = originalText;
            addBtn.disabled = false;
        }
    } catch (error) {
        console.error('Add to cart error:', error);
        alert('Could not add to cart. Please try again.');
        addBtn.innerHTML = originalText;
        addBtn.disabled = false;
    }
}

// Update cart count in header
async function updateCartCount() {
    try {
        const response = await fetch('/cart.js');
        const cart = await response.json();

        // Try common cart count selectors
        const cartCountElements = document.querySelectorAll(
            '.cart-count, .cart-item-count, [data-cart-count], .header__cart-count, #cart-icon-bubble span'
        );

        cartCountElements.forEach(function (el) {
            el.textContent = cart.item_count;
        });
    } catch (error) {
        console.error('Error updating cart count:', error);
    }
}

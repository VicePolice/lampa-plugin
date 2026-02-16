(function () {
    'use strict';

    /* ============================================================
     * NETFLIX PREMIUM STYLE v7.1 (Settings Restored & Border Fix)
     * ============================================================ */

    var Lampa = window.Lampa;
    
    // Дефолтні налаштування
    var defaults = {
        enabled: true,
        use_backdrops: false, // За замовчуванням вимкнено (стандартні постери)
        show_logos: true
    };

    function getSettings(key) {
        return Lampa.Storage.get('netflix_' + key, defaults[key]);
    }

    /* ------------------------------------------------------------------
     * LOGIC
     * ------------------------------------------------------------------ */
    function resolveLogoViaTmdb(movie, targetElement) {
        if (!getSettings('show_logos')) return;
        if (!movie || !movie.id || !Lampa.TMDB || targetElement.querySelector('.nfx-card-logo')) return;
        
        var type = (movie.name ? 'tv' : 'movie');
        var lang = Lampa.Storage.get('language', 'uk');
        var cacheKey = 'nfx_logo_' + type + '_' + movie.id;
        
        // Кешування в пам'яті
        if (window[cacheKey]) {
            applyLogo(targetElement, window[cacheKey]);
            return;
        }

        var url = Lampa.TMDB.api(type + '/' + movie.id + '/images?api_key=' + Lampa.TMDB.key() + '&include_image_language=' + lang + ',en,null');

        $.get(url, function (data) {
            if (data.logos && data.logos.length) {
                var found = data.logos.find(function(l) { return l.iso_639_1 === lang; }) || 
                            data.logos.find(function(l) { return l.iso_639_1 === 'en'; }) || 
                            data.logos[0];
                
                if (found && found.file_path) {
                    var logoUrl = Lampa.TMDB.image('/t/p/w300' + found.file_path);
                    window[cacheKey] = logoUrl;
                    applyLogo(targetElement, logoUrl);
                }
            }
        });
    }

    function applyLogo(card, url) {
        var title = card.querySelector('.card__title');
        var view = card.querySelector('.card__view');
        
        if (view && !card.querySelector('.nfx-card-logo')) {
            var img = document.createElement('img');
            img.src = url;
            img.className = 'nfx-card-logo';
            view.appendChild(img);
            
            // Приховуємо текст (прозорістю, щоб не ламати верстку)
            if (title) title.style.opacity = '0'; 
        }
    }

    function processCard(card) {
        if (!getSettings('enabled')) return;
        if (card.dataset.nfxProcessed) return;
        card.dataset.nfxProcessed = 'true';

        var img = card.querySelector('.card__img');
        var data = card.card_data || card.data;

        if (!data) return;

        // Логіка для бекдропів (горизонтальні картинки)
        if (getSettings('use_backdrops') && data.backdrop_path && img) {
            var backdrop = 'https://image.tmdb.org/t/p/w500' + data.backdrop_path;
            img.src = backdrop;
            card.classList.add('card--landscape');
        }

        resolveLogoViaTmdb(data, card);
    }

    /* ------------------------------------------------------------------
     * STYLES
     * ------------------------------------------------------------------ */
    function injectStyles() {
        var cssId = 'netflix-style-css';
        var old = document.getElementById(cssId);
        if (old) old.remove();

        if (!getSettings('enabled')) return;

        var css = `
            /* --- MENU FIX --- */
            .menu__item.focus {
                background-color: transparent !important;
                box-shadow: inset 4px 0 0 0 #e50914 !important; /* Червона лінія зліва */
            }
            .menu__item.focus .menu__item-name,
            .menu__item.focus .menu__ico {
                color: #e50914 !important;
                opacity: 1 !important;
            }

            /* --- CARDS & BORDER FIX --- */
            
            /* Важливо: задаємо правильні пропорції контейнеру */
            .card__view {
                position: relative;
                overflow: visible !important; /* Дозволяємо тіні виходити за межі */
                border-radius: 6px !important;
                transition: transform 0.2s ease-out !important;
                /* Стандартний постер 2:3 */
                padding-bottom: 150%; 
                background: #141414; /* Щоб не було дірок */
            }

            /* Якщо увімкнено Landscape mode */
            .card--landscape .card__view {
                padding-bottom: 56.25% !important; /* 16:9 */
            }

            .card__img {
                position: absolute;
                top: 0; left: 0;
                width: 100%; height: 100%;
                object-fit: cover; /* Картинка завжди заповнює весь блок */
                border-radius: 6px;
            }

            /* ЕФЕКТ ФОКУСУ (РАМКА) */
            .card.focus .card__view, .card:hover .card__view {
                transform: scale(1.1);
                z-index: 100;
                /* Використовуємо box-shadow замість border, це лікує проблему "пів рамки" */
                box-shadow: 
                    0 0 0 3px #fff,  /* Біла рамка зовні */
                    0 10px 20px rgba(0,0,0,0.8); /* Тінь */
            }

            /* LOGO STYLES */
            .nfx-card-logo {
                position: absolute;
                bottom: 10px;
                left: 10px;
                right: 10px;
                width: auto;
                max-width: 85%;
                max-height: 40%;
                object-fit: contain;
                object-position: bottom left;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
                z-index: 20;
            }

            /* Градієнт для читабельності */
            .card__view::after {
                content: '';
                position: absolute;
                bottom: 0; left: 0; right: 0; height: 50%;
                background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%);
                border-radius: 0 0 6px 6px;
                pointer-events: none;
            }
        `;

        var style = document.createElement('style');
        style.id = cssId;
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* ------------------------------------------------------------------
     * INIT & SETTINGS
     * ------------------------------------------------------------------ */
    function addSettings() {
        if (window.nfx_settings_added) return;
        window.nfx_settings_added = true;

        // Додаємо налаштування в інтерфейс
        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { name: 'netflix_enabled', type: 'trigger', default: true },
            field: { name: 'Netflix Design', description: 'Увімкнути стиль Netflix' },
            onChange: function() { window.location.reload(); }
        });

        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { name: 'netflix_use_backdrops', type: 'trigger', default: false },
            field: { name: 'Netflix Backdrops', description: 'Горизонтальні постери (якщо є)' },
            onChange: function() { 
                // Перезавантаження для зміни сітки
                setTimeout(function(){ window.location.reload(); }, 200); 
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { name: 'netflix_show_logos', type: 'trigger', default: true },
            field: { name: 'Netflix Logos', description: 'Показувати лого замість тексту' },
            onChange: function() { window.location.reload(); }
        });
    }

    function startObserver() {
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) {
                        if (node.classList.contains('card')) processCard(node);
                        var cards = node.querySelectorAll('.card');
                        cards.forEach(processCard);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        if (window.netflix_style_init) return;
        window.netflix_style_init = true;

        injectStyles();
        addSettings();
        startObserver();
        
        console.log('Netflix Premium Style v7.1 Loaded');
    }

    // Запуск (перевіряємо чи Lampa завантажилась)
    if (window.Lampa) {
        init();
    } else {
        var t = setInterval(function() {
            if (window.Lampa) {
                clearInterval(t);
                init();
            }
        }, 300);
    }
})();

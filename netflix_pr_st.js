(function () {
    'use strict';

    /* ============================================================
     * NETFLIX PREMIUM STYLE (Fixed Original)
     * ============================================================ */

    var Lampa = window.Lampa;

    /* 1. НАЛАШТУВАННЯ */
    function getBool(key, def) {
        var v = Lampa.Storage.get(key, def);
        if (typeof v === 'string') v = v.trim().toLowerCase();
        return v === true || v === 'true' || v === 1 || v === '1';
    }

    var settings = {
        get enabled() { return getBool('netflix_premium_enabled', true); },
        get useBackdrops() { return getBool('netflix_use_backdrops', false); }, // За замовчуванням вимкнено для стабільності
        get showLogos() { return getBool('netflix_show_logos', true); }
    };

    /* 2. ЛОГОТИПИ (TMDB) */
    function getMovieType(movie) { return movie.name ? 'tv' : 'movie'; }

    function resolveLogoViaTmdb(movie, card) {
        if (!settings.showLogos || card.querySelector('.nfx-logo')) return;
        if (!movie.id || !Lampa.TMDB) return;

        var type = getMovieType(movie);
        var lang = Lampa.Storage.get('language', 'uk');
        var cacheKey = 'nfx_logo_' + type + '_' + movie.id;

        // Перевірка кешу
        if (window[cacheKey]) {
            applyLogo(card, window[cacheKey]);
            return;
        }

        var url = Lampa.TMDB.api(type + '/' + movie.id + '/images?api_key=' + Lampa.TMDB.key() + '&include_image_language=' + lang + ',en,null');

        $.get(url, function (data) {
            if (data.logos && data.logos.length) {
                var found = data.logos.find(function(l) { return l.iso_639_1 === lang; }) || data.logos[0];
                if (found) {
                    var src = Lampa.TMDB.image('/t/p/w300' + found.file_path);
                    window[cacheKey] = src;
                    applyLogo(card, src);
                }
            }
        });
    }

    function applyLogo(card, src) {
        var title = card.querySelector('.card__title');
        var view = card.querySelector('.card__view');
        
        if (view && !view.querySelector('.nfx-logo')) {
            var img = document.createElement('img');
            img.src = src;
            img.className = 'nfx-logo';
            view.appendChild(img);
            if (title) title.style.opacity = '0'; // Просто ховаємо текст
        }
    }

    /* 3. ОБРОБКА КАРТОК */
    function processCard(card) {
        if (!settings.enabled || card.dataset.nfx) return;
        card.dataset.nfx = 'true';

        var img = card.querySelector('.card__img');
        var data = card.card_data || card.data;
        if (!data) return;

        // Backdrops
        if (settings.useBackdrops && data.backdrop_path && img) {
            img.src = Lampa.TMDB.image('/t/p/w500' + data.backdrop_path);
            card.classList.add('card--landscape');
        }

        // Logos
        resolveLogoViaTmdb(data, card);
    }

    /* 4. СТИЛІ (CSS) */
    function injectStyles() {
        var id = 'netflix-style-css';
        if (document.getElementById(id)) return;

        var css = `
            /* --- MENU FIX --- */
            /* Червона смужка зліва для активного пункту */
            .menu__item.focus {
                background-color: transparent !important;
                position: relative;
            }
            .menu__item.focus::before {
                content: '';
                position: absolute;
                left: 0; top: 10%; bottom: 10%;
                width: 4px; 
                background: #e50914;
                border-radius: 2px;
            }
            .menu__item.focus .menu__ico,
            .menu__item.focus .menu__text,
            .menu__item.focus .menu__title {
                color: #e50914 !important;
                opacity: 1 !important;
            }

            /* --- CARDS FIX --- */
            .card__view {
                border-radius: 6px !important;
                overflow: visible !important; /* Щоб рамка не обрізалась */
                transition: transform 0.3s !important;
            }

            /* Рамка через ::after (вирішує проблему "пів рамки") */
            .card.focus .card__view::after {
                content: '';
                position: absolute;
                top: -4px; left: -4px; right: -4px; bottom: -4px;
                border: 3px solid #fff;
                border-radius: 8px;
                z-index: 100;
                pointer-events: none;
                box-shadow: 0 10px 20px rgba(0,0,0,0.8);
            }

            .card.focus .card__view {
                transform: scale(1.1);
                z-index: 50 !important;
                background: #141414;
            }
            
            .card.focus {
                z-index: 100 !important; /* Картка поверх сусідніх */
            }

            /* Логотипи */
            .nfx-logo {
                position: absolute;
                bottom: 10px; left: 10px; right: 10px;
                max-width: 90%; max-height: 50px;
                object-fit: contain; object-position: bottom left;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
                z-index: 20;
            }

            /* Landscape (Backdrops) Fix */
            .card--landscape .card__view {
                padding-bottom: 56.25% !important; /* 16:9 */
            }
            .card--landscape .card__img {
                object-fit: cover !important;
            }
        `;

        var style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* 5. ЗАПУСК */
    function startObserver() {
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) {
                        if (node.classList.contains('card')) processCard(node);
                        node.querySelectorAll('.card').forEach(processCard);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        if (window.netflix_fixed_init) return;
        window.netflix_fixed_init = true;

        injectStyles();
        
        // Додаємо налаштування
        if (Lampa.SettingsApi) {
            Lampa.SettingsApi.addParam({
                component: 'interface',
                param: { name: 'netflix_premium_enabled', type: 'trigger', default: true },
                field: { name: 'Netflix Style', description: 'Увімкнути стиль' },
                onChange: function() { location.reload(); }
            });
            Lampa.SettingsApi.addParam({
                component: 'interface',
                param: { name: 'netflix_use_backdrops', type: 'trigger', default: false },
                field: { name: 'Netflix Backdrops', description: 'Горизонтальні постери' },
                onChange: function() { location.reload(); }
            });
             Lampa.SettingsApi.addParam({
                component: 'interface',
                param: { name: 'netflix_show_logos', type: 'trigger', default: true },
                field: { name: 'Netflix Logos', description: 'Лого замість назви' },
                 onChange: function() { location.reload(); }
            });
        }

        startObserver();
        console.log('Netflix Style Fixed Loaded');
    }

    // Безпечний старт
    if (window.Lampa) {
        init();
    } else {
        var t = setInterval(function () {
            if (window.Lampa && window.Lampa.SettingsApi) {
                clearInterval(t);
                init();
            }
        }, 300);
    }
})();

(function () {
    'use strict';

    /* ============================================================
     * NETFLIX PREMIUM STYLE v5.2 (Fixed)
     * Cinematic Red Accent, Smooth Rows, Movie Logo Headers
     * ============================================================ */

    var Lampa = window.Lampa;

    /* BLOCK: Utils */
    function getBool(key, def) {
        var v = Lampa.Storage.get(key, def);
        if (typeof v === 'string') v = v.trim().toLowerCase();
        return v === true || v === 'true' || v === 1 || v === '1';
    }

    function cleanTitle(text) {
        return String(text || '').replace(/\s+/g, ' ').trim();
    }

    /* 1. LOCALIZATION */
    Lampa.Lang.add({
        netflix_premium_title: { en: 'Netflix Premium Style', uk: 'Netflix Преміум Стиль' },
        netflix_enable: { en: 'Enable Netflix Premium style', uk: 'Увімкнути Netflix стиль' },
        netflix_use_backdrops: { en: 'Use backdrops (landscape)', uk: 'Горизонтальні постери (Backdrops)' },
        netflix_show_logos: { en: 'Replace full-card title with logo', uk: 'Логотип замість назви фільму' },
        netflix_round_corners: { en: 'Rounded corners', uk: 'Заокруглені кути' },
        netflix_card_height: { en: 'Card height', uk: 'Висота карток' }
    });

    /* 2. SETTINGS */
    var settings = {
        enabled: getBool('netflix_premium_enabled', true),
        useBackdrops: getBool('netflix_use_backdrops', true),
        showLogos: getBool('netflix_show_logos', true),
        roundCorners: getBool('netflix_round_corners', true),
        cardHeight: Lampa.Storage.get('netflix_card_height', 'medium')
    };

    /* Runtime state */
    var domObserver = null;
    var lastFullMovie = null;
    var lastFullMovieKey = '';
    var logoRequests = {};

    /* ------------------------------------------------------------------
     * LOGIC: TMDB LOGOS
     * ------------------------------------------------------------------ */
    function getMovieType(movie) {
        return movie && movie.name ? 'tv' : 'movie';
    }

    function getMovieKey(movie) {
        if (!movie || !movie.id) return '';
        return getMovieType(movie) + ':' + movie.id;
    }

    function resolveLogoViaTmdb(movie, done) {
        if (!movie || !movie.id || !Lampa.TMDB) { done(''); return; }

        var type = getMovieType(movie);
        var lang = Lampa.Storage.get('language', 'uk'); 
        // Спочатку шукаємо лого по мові інтерфейсу, потім англійське
        var cacheKey = 'nfx_logo_' + type + '_' + movie.id + '_' + lang;
        
        var cached = Lampa.Storage.get(cacheKey);
        if (cached) { done(cached === 'none' ? '' : cached); return; }

        var url = Lampa.TMDB.api(type + '/' + movie.id + '/images?api_key=' + Lampa.TMDB.key() + '&include_image_language=' + lang + ',en,null');

        $.get(url, function (data) {
            var logo = '';
            if (data.logos && data.logos.length) {
                // Шукаємо пріоритетну мову
                var found = data.logos.find(function(l) { return l.iso_639_1 === lang; });
                if (!found) found = data.logos.find(function(l) { return l.iso_639_1 === 'en'; });
                if (!found) found = data.logos[0]; // Будь-яке
                if (found && found.file_path) logo = Lampa.TMDB.image('/t/p/w500' + found.file_path);
            }

            Lampa.Storage.set(cacheKey, logo || 'none');
            done(logo);
        }).fail(function () {
            Lampa.Storage.set(cacheKey, 'none');
            done('');
        });
    }

    /* ------------------------------------------------------------------
     * LOGIC: MENU FIXES (Виправлення дублікатів)
     * ------------------------------------------------------------------ */
    function cleanMenuLabel(item) {
        if (item.dataset.nfxMenuProcessed) return;
        
        // Знаходимо всі текстові ноди, які Lampa створює
        var textNodes = item.querySelectorAll('.menu__item-name, .menu__item-text, .menu__item-title, .menu__item-label');
        var bestText = '';
        
        // Шукаємо найдовший текст (зазвичай це правильна назва, а не "TV" чи "Movie")
        for (var i = 0; i < textNodes.length; i++) {
            var t = textNodes[i].textContent.trim();
            if (t.length > bestText.length) bestText = t;
        }

        // Якщо тексту немає, спробуємо атрибути
        if (!bestText) bestText = item.getAttribute('data-title') || item.title || '';

        // Створюємо наш власний лейбл
        var label = item.querySelector('.nfx-menu-label');
        if (!label) {
            label = document.createElement('div');
            label.className = 'nfx-menu-label';
            item.appendChild(label);
        }
        
        if (bestText) label.textContent = bestText;
        
        // Додаємо клас, щоб CSS приховав все інше
        item.classList.add('nfx-menu-item-styled');
        item.dataset.nfxMenuProcessed = 'true';
    }

    /* ------------------------------------------------------------------
     * LOGIC: CARDS & LAYOUT
     * ------------------------------------------------------------------ */
    function processCard(card) {
        if (!settings.enabled || card.dataset.nfxProcessed) return;

        var img = card.querySelector('.card__img');
        var data = card.card_data || card.data;

        // Застосування backdrop (горизонтальна картинка)
        if (settings.useBackdrops && data && data.backdrop_path && img) {
            var backdrop = 'https://image.tmdb.org/t/p/w780' + data.backdrop_path;
            var preload = new Image();
            preload.onload = function() {
                img.src = backdrop;
                card.classList.add('card--has-backdrop');
            };
            preload.src = backdrop;
        }

        card.dataset.nfxProcessed = 'true';
    }

    function applyFullCardLogo(movie) {
        if (!settings.enabled || !settings.showLogos) return;

        var titleNodes = document.querySelectorAll('.full-start-new__title, .full-start__title');
        if (!titleNodes.length) return;

        var movieKey = getMovieKey(movie);
        if (movieKey === lastFullMovieKey && document.querySelector('.nfx-full-logo')) return; // Вже є
        lastFullMovieKey = movieKey;

        resolveLogoViaTmdb(movie, function(logoUrl) {
            if (!logoUrl) return; // Якщо лого немає, залишаємо текст

            titleNodes.forEach(function(node) {
                // Зберігаємо оригінал про всяк випадок
                if (!node.dataset.origHtml) node.dataset.origHtml = node.innerHTML;
                
                node.innerHTML = '<img class="nfx-full-logo" src="' + logoUrl + '" alt="Logo" />';
                node.classList.add('nfx-logo-mode');
            });
        });
    }

    /* ------------------------------------------------------------------
     * DOM OBSERVER (Слідкує за змінами)
     * ------------------------------------------------------------------ */
    function scanNode(node) {
        if (!node || !node.classList) return;

        // Обробка меню (ліве меню і будь-які інші списки меню)
        if (node.classList.contains('menu__item')) cleanMenuLabel(node);
        var menuItems = node.querySelectorAll('.menu__item');
        for (var i = 0; i < menuItems.length; i++) cleanMenuLabel(menuItems[i]);

        // Обробка карток
        if (node.classList.contains('card')) processCard(node);
        var cards = node.querySelectorAll('.card');
        for (var j = 0; j < cards.length; j++) processCard(cards[j]);

        // Логотип у повній картці
        if (document.querySelector('.full-start') || document.querySelector('.full-start-new')) {
            if (lastFullMovie) applyFullCardLogo(lastFullMovie);
        }
    }

    function startObserver() {
        if (domObserver) return;
        domObserver = new MutationObserver(function (mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(scanNode);
            });
        });
        domObserver.observe(document.body, { childList: true, subtree: true });
        scanNode(document.body);
    }

    /* ------------------------------------------------------------------
     * CSS STYLES (THEME)
     * ------------------------------------------------------------------ */
    function injectStyles() {
        var id = 'netflix_premium_styles_v5';
        var old = document.getElementById(id);
        if (old) old.remove();

        if (!settings.enabled) return;

        var heights = { small: '170px', medium: '220px', large: '272px', xlarge: '340px' };
        var h = heights[settings.cardHeight] || heights.medium;
        var radius = settings.roundCorners ? '10px' : '4px';

        var css = `
            :root {
                --nfx-card-h: ${h};
                --nfx-card-w: calc(var(--nfx-card-h) * 1.7778); 
                --nfx-red: #e50914;
            }

            /* --- BACKGROUND & GLOBAL --- */
            body {
                background-color: #141414 !important;
                background-image: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(20,20,20,1) 100%) !important;
            }
            .background__gradient { background: linear-gradient(to right, #000 0%, transparent 100%) !important; }

            /* --- MENU FIXES (Агресивне приховування дублікатів) --- */
            /* Спочатку приховуємо всі стандартні текстові елементи всередині стилізованого пункту */
            .nfx-menu-item-styled > *:not(.menu__item-icon):not(.nfx-menu-label) {
                display: none !important;
            }
            
            .nfx-menu-item-styled {
                display: flex !important;
                align-items: center !important;
                gap: 15px !important;
                padding: 10px 15px !important;
                border-radius: 8px !important;
            }
            
            .nfx-menu-label {
                color: #e5e5e5;
                font-weight: 500;
                font-size: 1.1em;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                opacity: 0.7;
                transition: opacity 0.3s;
            }
            
            .menu__item.focus .nfx-menu-label, .menu__item.hover .nfx-menu-label {
                opacity: 1;
                color: #fff;
            }

            /* Активний елемент меню */
            .menu__item.focus, .menu__item.hover {
                background-color: transparent !important;
                border: 1px solid rgba(255,255,255,0.2) !important; 
                box-shadow: none !important;
                transform: scale(1.05);
            }
            
            /* Лінія виділення зліва як у Netflix */
            .menu__item.focus::before {
                content: '';
                position: absolute;
                left: 0;
                top: 10%;
                height: 80%;
                width: 4px;
                background-color: var(--nfx-red);
                border-radius: 2px;
            }

            /* --- CARDS --- */
            .card {
                width: var(--nfx-card-w) !important;
                height: var(--nfx-card-h) !important;
            }
            
            .card__view {
                border-radius: ${radius} !important;
                border: none !important;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                transition: transform 0.3s, box-shadow 0.3s !important;
            }

            .card.focus .card__view, .card:hover .card__view {
                transform: scale(1.1) !important;
                box-shadow: 0 10px 20px rgba(0,0,0,0.8) !important;
                border: 2px solid #fff !important;
                z-index: 10;
            }
            
            .card__title {
                bottom: 10px !important;
                font-weight: bold;
                text-shadow: 1px 1px 2px black;
            }

            /* --- FULL SCREEN LOGO --- */
            .nfx-full-logo {
                max-height: 200px;
                width: auto;
                object-fit: contain;
                filter: drop-shadow(0 5px 15px rgba(0,0,0,0.8));
                margin-bottom: 20px;
                display: block;
            }
            
            .nfx-logo-mode {
                background: none !important;
                padding: 0 !important;
            }

            /* --- UI CLEANUP --- */
            .scroll__title, .category-title {
                color: #e5e5e5 !important;
                font-weight: bold !important;
                font-size: 1.5em !important;
                margin-bottom: 10px !important;
                padding-left: 4% !important;
            }
            
            /* Прибираємо зайві бордери */
            .settings-param, .selectbox-item, .simple-button {
                border-radius: 6px !important;
            }
        `;

        var style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* ------------------------------------------------------------------
     * INIT
     * ------------------------------------------------------------------ */
    function init() {
        if (window.netflix_premium_initialized_v5) return;
        window.netflix_premium_initialized_v5 = true;

        // Патчимо налаштування для миттєвого оновлення
        var originalSet = Lampa.Storage.set;
        Lampa.Storage.set = function (key, val) {
            var res = originalSet.apply(this, arguments);
            if (key.indexOf('netflix_') === 0) {
                // Оновлюємо змінні
                if (key === 'netflix_premium_enabled') settings.enabled = val;
                if (key === 'netflix_use_backdrops') settings.useBackdrops = val;
                if (key === 'netflix_show_logos') settings.showLogos = val;
                if (key === 'netflix_round_corners') settings.roundCorners = val;
                if (key === 'netflix_card_height') settings.cardHeight = val;
                
                injectStyles();
                // Оновлюємо вже відмальоване
                scanNode(document.body);
            }
            return res;
        };

        // Слухаємо відкриття повної картки
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite' && e.data && e.data.movie) {
                lastFullMovie = e.data.movie;
                setTimeout(function() { applyFullCardLogo(lastFullMovie); }, 100);
            }
        });

        // Додаємо налаштування в меню
        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { name: 'netflix_premium_enabled', type: 'trigger', default: true },
            field: { name: Lampa.Lang.translate('netflix_enable'), description: 'v5.2 Fix' }
        });
        
        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { name: 'netflix_use_backdrops', type: 'trigger', default: true },
            field: { name: Lampa.Lang.translate('netflix_use_backdrops') }
        });

        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { name: 'netflix_show_logos', type: 'trigger', default: true },
            field: { name: Lampa.Lang.translate('netflix_show_logos') }
        });

        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { 
                name: 'netflix_card_height', 
                type: 'select', 
                values: { small: 'Small', medium: 'Medium', large: 'Large', xlarge: 'Cinema' },
                default: 'medium'
            },
            field: { name: Lampa.Lang.translate('netflix_card_height') }
        });

        injectStyles();
        startObserver();
        
        console.log('Netflix Premium Style v5.2 Loaded');
    }

    if (window.Lampa) init();
    else {
        var t = setInterval(function () {
            if (window.Lampa) { clearInterval(t); init(); }
        }, 300);
    }
})();
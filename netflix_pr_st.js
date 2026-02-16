(function () {
    'use strict';

    /* ============================================================
     * NETFLIX PREMIUM STYLE v7.0 (Fixed Settings & Borders)
     * ============================================================ */

    var Lampa = window.Lampa;
    var timer_styles = null;

    /* НАЛАШТУВАННЯ ЗА ЗАМОВЧУВАННЯМ */
    var defaults = {
        enabled: true,
        use_backdrops: false, // За замовчуванням вимкнено, щоб не ламати сітку, увімкніть в налаштуваннях якщо треба
        show_logos: true
    };

    /* Читання налаштувань */
    function getSettings(key) {
        return Lampa.Storage.get('netflix_' + key, defaults[key]);
    }

    /* ------------------------------------------------------------------
     * LOGIC
     * ------------------------------------------------------------------ */
    function getMovieType(movie) {
        return movie.name ? 'tv' : 'movie';
    }

    function resolveLogoViaTmdb(movie, targetElement) {
        if (!getSettings('show_logos')) return;
        if (!movie || !movie.id || !Lampa.TMDB || targetElement.querySelector('.nfx-card-logo')) return;
        
        // Щоб не спамити запитами, перевіряємо чи елемент видимий (проста перевірка)
        if (!document.body.contains(targetElement)) return;

        var type = getMovieType(movie);
        var lang = Lampa.Storage.get('language', 'uk');
        var cacheKey = 'nfx_logo_' + type + '_' + movie.id;
        
        // Перевірка кешу сесії (щоб не звертатись до API постійно)
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
                    window[cacheKey] = logoUrl; // Кешуємо
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
            
            if (title) title.style.opacity = '0'; // Ховаємо текст, але залишаємо в DOM
        }
    }

    function processCard(card) {
        if (!getSettings('enabled')) return;
        if (card.dataset.nfxProcessed) return;
        card.dataset.nfxProcessed = 'true';

        var img = card.querySelector('.card__img');
        var view = card.querySelector('.card__view');
        var data = card.card_data || card.data;

        if (!data || !view) return;

        // 1. Backdrops (Горизонтальні)
        if (getSettings('use_backdrops') && data.backdrop_path && img) {
            var backdrop = 'https://image.tmdb.org/t/p/w500' + data.backdrop_path;
            img.src = backdrop;
            card.classList.add('card--landscape');
        }

        // 2. Logos
        resolveLogoViaTmdb(data, card);
    }

    /* ------------------------------------------------------------------
     * OBSERVER & INIT
     * ------------------------------------------------------------------ */
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

    function addSettings() {
        if (!Lampa.SettingsApi) return;

        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { name: 'netflix_enabled', type: 'trigger', default: true },
            field: { name: 'Netflix Style', description: 'Увімкнути дизайн Netflix' },
            onChange: function() { window.location.reload(); }
        });

        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { name: 'netflix_use_backdrops', type: 'trigger', default: false },
            field: { name: 'Netflix Backdrops', description: 'Горизонтальні постери (перезавантажте)' },
            onChange: function() { setTimeout(function(){ window.location.reload() }, 500); }
        });

        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { name: 'netflix_show_logos', type: 'trigger', default: true },
            field: { name: 'Netflix Logos', description: 'Лого замість назви на картках' }
        });
    }

    /* ------------------------------------------------------------------
     * STYLES
     * ------------------------------------------------------------------ */
    function injectStyles() {
        if (!getSettings('enabled')) return;
        
        var css = `
            /* --- МЕНЮ (Стиль без JS) --- */
            .menu__item.focus {
                background-color: transparent !important;
                box-shadow: inset 4px 0 0 0 #e50914 !important; /* Червона смужка зліва */
            }
            .menu__item.focus .menu__item-name,
            .menu__item.focus .menu__ico {
                color: #e50914 !important; /* Червоний текст та іконка */
                opacity: 1 !important;
            }
            .menu__item {
                border-radius: 0 !important; /* Квадратні краї для меню */
            }

            /* --- КАРТКИ (Виправлення рамки) --- */
            /* Використовуємо box-shadow замість border, щоб не ламати розміри */
            .card.focus .card__view, .card:hover .card__view {
                transform: scale(1.1);
                z-index: 50;
                box-shadow: 
                    0 0 0 3px #fff, /* Біла рамка, яка малюється ПОВЕРХ, а не збоку */
                    0 10px 20px rgba(0,0,0,0.8); /* Тінь */
            }
            
            .card__view {
                overflow: visible !important; /* Дозволяємо тіні виходити за межі */
                transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
            }
            
            /* ЛОГОТИПИ */
            .nfx-card-logo {
                position: absolute;
                bottom: 10px;
                left: 10px;
                right: 10px;
                max-width: 90%;
                max-height: 50px;
                object-fit: contain;
                object-position: bottom left;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.9));
                z-index: 2;
                display: block !important;
            }
            
            /* ТЕМНЕНЬКИЙ ГРАДІЄНТ ЗНИЗУ КАРТКИ ДЛЯ ЧИТАБЕЛЬНОСТІ */
            .card__view::after {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 40%);
                z-index: 1;
                border-radius: inherit;
            }

            /* --- BACKDROPS (Горизонтальні) --- */
            /* Якщо увімкнено, міняємо пропорції контейнера */
            .card--landscape .card__view {
                padding-bottom: 56.25% !important; /* 16:9 Aspect Ratio */
            }
            .card--landscape .card__img {
                object-fit: cover;
            }
        `;

        var id = 'netflix-style-css';
        var style = document.getElementById(id);
        if (!style) {
            style = document.createElement('style');
            style.id = id;
            document.head.appendChild(style);
        }
        style.textContent = css;
    }

    /* INITIALIZATION */
    function init() {
        if (window.nfx_init_done) return;
        window.nfx_init_done = true;

        injectStyles();
        addSettings();
        startObserver();
        
        // Примусове оновлення стилів при старті
        setTimeout(injectStyles, 1000); 
        console.log('Netflix Premium Style v7.0 Loaded');
    }

    if (window.Lampa) {
        init();
    } else {
        var t = setInterval(function() {
            if (window.Lampa) {
                clearInterval(t);
                init();
            }
        }, 500);
    }
})();

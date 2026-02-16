(function () {
    'use strict';

    /* ============================================================
     * NETFLIX PREMIUM STYLE v6.0 (Stable/Safe)
     * ============================================================ */

    var Lampa = window.Lampa;

    /* НАЛАШТУВАННЯ */
    var settings = {
        enabled: true,
        use_backdrops: true, // Горизонтальні картинки
        show_logos: true     // Лого замість тексту (де можливо)
    };

    /* ------------------------------------------------------------------
     * LOGIC: TMDB LOGOS & BACKDROPS
     * ------------------------------------------------------------------ */
    function getMovieType(movie) {
        return movie.name ? 'tv' : 'movie';
    }

    function resolveLogoViaTmdb(movie, targetElement) {
        if (!movie || !movie.id || !Lampa.TMDB || targetElement.dataset.logoLoaded) return;
        
        targetElement.dataset.logoLoaded = 'true';
        var type = getMovieType(movie);
        var lang = Lampa.Storage.get('language', 'uk');
        
        var url = Lampa.TMDB.api(type + '/' + movie.id + '/images?api_key=' + Lampa.TMDB.key() + '&include_image_language=' + lang + ',en,null');

        $.get(url, function (data) {
            if (data.logos && data.logos.length) {
                var found = data.logos.find(function(l) { return l.iso_639_1 === lang; }) || 
                            data.logos.find(function(l) { return l.iso_639_1 === 'en'; }) || 
                            data.logos[0];
                
                if (found && found.file_path) {
                    var logoUrl = Lampa.TMDB.image('/t/p/w500' + found.file_path);
                    var img = document.createElement('img');
                    img.src = logoUrl;
                    img.className = 'nfx-card-logo';
                    
                    // Знаходимо текстову назву і ховаємо її, додаючи лого
                    var title = targetElement.querySelector('.card__title');
                    if (title) {
                        title.style.display = 'none';
                        title.parentNode.insertBefore(img, title);
                    }
                }
            }
        });
    }

    function processCard(card) {
        if (card.dataset.nfxProcessed) return;
        card.dataset.nfxProcessed = 'true';

        var img = card.querySelector('.card__img');
        var data = card.card_data || card.data; // Lampa зберігає дані тут

        if (!data) return;

        // 1. Backdrops (горизонтальні картинки)
        if (settings.use_backdrops && data.backdrop_path && img) {
            // Завантажуємо бекдроп тільки якщо він є
            var backdrop = 'https://image.tmdb.org/t/p/w500' + data.backdrop_path;
            
            // Створюємо "підкладку", щоб не ламати оригінальний img
            // Але для простоти в Lampa часто просто міняють src
            // Перевіряємо, чи це не квадратний постер
            img.src = backdrop;
            card.classList.add('card--landscape');
        }

        // 2. Logos (логотипи на картках)
        if (settings.show_logos) {
            resolveLogoViaTmdb(data, card);
        }
    }

    /* ------------------------------------------------------------------
     * OBSERVER
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

    /* ------------------------------------------------------------------
     * STYLES (CSS)
     * ------------------------------------------------------------------ */
    function injectStyles() {
        var css = `
            /* --- GLOBAL --- */
            body { background-color: #000 !important; }
            
            /* --- MENU FIX (Без зникнення) --- */
            .menu__item.focus, .menu__item:hover {
                background-color: transparent !important;
                border-left: 3px solid #e50914 !important; /* Червона лінія */
            }
            .menu__item-name {
                font-weight: bold;
                transition: color 0.3s;
            }
            .menu__item.focus .menu__item-name {
                color: #e50914 !important;
            }

            /* --- CARDS (Виправлення накладання) --- */
            .card--landscape .card__view {
                /* Якщо це бекдроп, робимо його ширшим візуально, але обережно */
                background-size: cover;
            }

            .card__view {
                border-radius: 6px !important;
                transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
                border: 2px solid transparent;
            }

            /* Ефект при наведенні */
            .card.focus .card__view, .card:hover .card__view {
                transform: scale(1.15); /* Збільшення */
                z-index: 1000 !important; /* ВАЖЛИВО: Картка поверх інших */
                box-shadow: 0 10px 30px rgba(0,0,0,0.9);
                border-color: #e50914 !important; /* Червона рамка */
                background-color: #141414;
            }
            
            /* Щоб сусідні картки не перекривали активну */
            .card {
                z-index: 1; 
                /* НЕ ЗАДАЄМО WIDTH/HEIGHT тут, хай Lampa рахує сама */
            }
            .card.focus {
                z-index: 100 !important;
            }

            /* Логотип на картці */
            .nfx-card-logo {
                position: absolute;
                bottom: 10px;
                left: 10px;
                width: 80%;
                max-height: 50%;
                object-fit: contain;
                filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.8));
                z-index: 20;
            }
            
            /* Тінь знизу картки для читабельності */
            .card__view::after {
                content: '';
                position: absolute;
                bottom: 0; left: 0; right: 0;
                height: 60%;
                background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
                border-radius: 0 0 6px 6px;
            }
        `;
        
        var style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* INIT */
    if (window.Lampa) {
        injectStyles();
        startObserver();
        console.log('Netflix Style Safe Loaded');
    } else {
        var t = setInterval(function() {
            if (window.Lampa) {
                clearInterval(t);
                injectStyles();
                startObserver();
            }
        }, 500);
    }
})();

/**
 * Likhtar Marks Only — плагін (Likhtar Team).
 * Вивід міток (якість, озвучка, рейтинг) на постери ТА в повну картку фільму/серіалу.
 */
(function () {
    'use strict';

    if (typeof Lampa === 'undefined') {
        console.error('Lampa not found (script loaded before app?)');
        return;
    }

    // =================================================================
    // НАЛАШТУВАННЯ ДЛЯ МІТОК
    // =================================================================
    function setupMarksSettings() {
        if (!Lampa.SettingsApi || !Lampa.SettingsApi.addComponent) return;

        Lampa.SettingsApi.addComponent({
            component: 'likhtar_marks',
            name: 'Мітки на постерах',
            icon: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 21h6m-3-18v1m-6.36 1.64l.7.71m12.02-.71l-.7.71M4 12H3m18 0h-1M8 12a4 4 0 108 0 4 4 0 00-8 0zm-1 5h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        });

        Lampa.SettingsApi.addParam({
            component: 'likhtar_marks',
            param: { type: 'title' },
            field: { name: 'Відображення міток на картках' }
        });

        Lampa.SettingsApi.addParam({ component: 'likhtar_marks', param: { name: 'likhtar_badge_ua', type: 'trigger', default: true }, field: { name: 'Українська озвучка (UA)' } });
        Lampa.SettingsApi.addParam({ component: 'likhtar_marks', param: { name: 'likhtar_badge_en', type: 'trigger', default: true }, field: { name: 'Англійська озвучка (EN)' } });
        Lampa.SettingsApi.addParam({ component: 'likhtar_marks', param: { name: 'likhtar_badge_pl', type: 'trigger', default: true }, field: { name: 'Польська озвучка (PL)' } });
        Lampa.SettingsApi.addParam({ component: 'likhtar_marks', param: { name: 'likhtar_badge_4k', type: 'trigger', default: true }, field: { name: 'Якість 4K' } });
        Lampa.SettingsApi.addParam({ component: 'likhtar_marks', param: { name: 'likhtar_badge_fhd', type: 'trigger', default: true }, field: { name: 'Якість FHD/HD' } });
        Lampa.SettingsApi.addParam({ component: 'likhtar_marks', param: { name: 'likhtar_badge_hdr', type: 'trigger', default: true }, field: { name: 'HDR / Dolby Vision' } });
    }

    // =================================================================
    // LIKHTAR QUALITY MARKS (Jacred + UaFix)
    // =================================================================
    function initMarksJacRed() {
        var workingProxy = null;
        var proxies = [
            'https://myfinder.kozak-bohdan.workers.dev/?key=lmp_2026_JacRed_K9xP7aQ4mV2E&url=',
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?url='
        ];

        function fetchWithProxy(url, callback) {
            try {
                var network = new Lampa.Reguest();
                network.timeout(10000);
                network.silent(url, function (json) {
                    var text = typeof json === 'string' ? json : JSON.stringify(json);
                    workingProxy = 'direct';
                    callback(null, text);
                }, function () {
                    tryProxies(url, callback);
                });
            } catch (e) {
                tryProxies(url, callback);
            }
        }

        function tryProxies(url, callback) {
            var proxyList = (workingProxy && workingProxy !== 'direct') ? [workingProxy] : proxies;

            function tryProxy(index) {
                if (index >= proxyList.length) {
                    callback(new Error('No proxy worked'));
                    return;
                }
                var p = proxyList[index];
                var target = p.indexOf('url=') > -1 ? p + encodeURIComponent(url) : p + url;

                var xhr = new XMLHttpRequest();
                xhr.open('GET', target, true);
                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        workingProxy = p;
                        callback(null, xhr.responseText);
                    } else {
                        tryProxy(index + 1);
                    }
                };
                xhr.onerror = function () { tryProxy(index + 1); };
                xhr.timeout = 10000;
                xhr.ontimeout = function () { tryProxy(index + 1); };
                xhr.send();
            }
            tryProxy(0);
        }

        var _jacredCache = {};

        function getBestJacred(card, callback) {
            var cacheKey = 'jacred_v3_' + card.id;

            if (_jacredCache[cacheKey]) {
                callback(_jacredCache[cacheKey]);
                return;
            }

            try {
                var raw = Lampa.Storage.get(cacheKey, '');
                if (raw && typeof raw === 'object' && raw._ts && (Date.now() - raw._ts < 48 * 60 * 60 * 1000)) {
                    _jacredCache[cacheKey] = raw;
                    callback(raw);
                    return;
                }
            } catch (e) { }

            var title = (card.original_title || card.title || card.name || '').toLowerCase();
            var year = (card.release_date || card.first_air_date || '').substr(0, 4);

            if (!title || !year) {
                callback(null);
                return;
            }

            var releaseDate = new Date(card.release_date || card.first_air_date);
            if (releaseDate && releaseDate.getTime() > Date.now()) {
                callback(null);
                return;
            }

            var apiUrl = 'https://jr.maxvol.pro/api/v1.0/torrents?search=' + encodeURIComponent(title) + '&year=' + year;

            fetchWithProxy(apiUrl, function (err, data) {
                if (err || !data) {
                    callback(null);
                    return;
                }

                try {
                    var parsed;
                    try {
                        parsed = JSON.parse(data);
                    } catch (e) {
                        callback(null);
                        return;
                    }

                    if (parsed.contents) {
                        try { parsed = JSON.parse(parsed.contents); } catch (e) { }
                    }

                    var results = Array.isArray(parsed) ? parsed : (parsed.Results || []);

                    if (!results.length) {
                        var emptyData = { empty: true, _ts: Date.now() };
                        _jacredCache[cacheKey] = emptyData;
                        try { Lampa.Storage.set(cacheKey, emptyData); } catch (e) { }
                        callback(null);
                        return;
                    }

                    var best = { resolution: 'SD', ukr: false, eng: false, hdr: false };
                    var resOrder = ['SD', 'HD', 'FHD', '2K', '4K'];

                    results.forEach(function (item) {
                        var t = (item.title || '').toLowerCase();

                        var currentRes = 'SD';
                        if (t.indexOf('4k') >= 0 || t.indexOf('2160') >= 0 || t.indexOf('uhd') >= 0) currentRes = '4K';
                        else if (t.indexOf('2k') >= 0 || t.indexOf('1440') >= 0) currentRes = '2K';
                        else if (t.indexOf('1080') >= 0 || t.indexOf('fhd') >= 0 || t.indexOf('full hd') >= 0) currentRes = 'FHD';
                        else if (t.indexOf('720') >= 0 || t.indexOf('hd') >= 0) currentRes = 'HD';

                        if (resOrder.indexOf(currentRes) > resOrder.indexOf(best.resolution)) {
                            best.resolution = currentRes;
                        }

                        if (t.indexOf('ukr') >= 0 || t.indexOf('укр') >= 0 || t.indexOf('ua') >= 0 || t.indexOf('ukrainian') >= 0) {
                            best.ukr = true;
                        }

                        if (t.indexOf('eng') >= 0 || t.indexOf('english') >= 0 || t.indexOf('multi') >= 0) {
                            best.eng = true;
                        }

                        if (t.indexOf('dolby vision') >= 0 || t.indexOf('dolbyvision') >= 0) {
                            best.hdr = true;
                            best.dolbyVision = true;
                        } else if (t.indexOf('hdr') >= 0) {
                            best.hdr = true;
                        }
                    });

                    if (card.original_language === 'uk') best.ukr = true;
                    if (card.original_language === 'en') best.eng = true;

                    best._ts = Date.now();
                    _jacredCache[cacheKey] = best;
                    try { Lampa.Storage.set(cacheKey, best); } catch (e) { }
                    callback(best);

                } catch (e) {
                    callback(null);
                }
            });
        }

        // =============================================================
        // ІНЖЕКТ МІТОК В ПОВНУ КАРТКУ (СТОРІНКА ФІЛЬМУ)
        // =============================================================
        function injectFullCardMarks(movie, renderEl) {
            if (!movie || !movie.id || !renderEl) return;
            var $render = $(renderEl);
            
            // Шукаємо блок тегів, де Lampa виводить "13+", "Випущено", TMDB рейтинг
            var tagsContainer = $render.find('.full-start-new__tags, .full-start__tags, .info__tags').first();
            if (!tagsContainer.length) return;
            
            // Уникаємо дублювання
            if (tagsContainer.find('.likhtar-full-tags').length) return;
            
            // Створюємо свій контейнер і додаємо його на початок блоку тегів
            var marksContainer = $('<div class="likhtar-full-tags" style="display:inline-flex; gap:0.4em; margin-right:0.4em;"></div>');
            tagsContainer.prepend(marksContainer);
            
            getBestJacred(movie, function (data) {
                if (data && !data.empty) {
                    renderInfoRowBadges(marksContainer, data);
                }
            });
        }

        function renderInfoRowBadges(container, data) {
            container.empty();
            // Нативний клас Лампи для тегів (створює таку ж саму рамочку і стиль)
            var tagClass = 'full-start__pg';

            if (data.ukr && Lampa.Storage.get('likhtar_badge_ua', true)) {
                container.append($('<div class="'+tagClass+'">UA+</div>'));
            }
            if (data.pol && Lampa.Storage.get('likhtar_badge_pl', true)) {
                container.append($('<div class="'+tagClass+'">PL</div>'));
            }
            if (data.eng && Lampa.Storage.get('likhtar_badge_en', true)) {
                container.append($('<div class="'+tagClass+'">EN</div>'));
            }

            if (data.resolution && data.resolution !== 'SD') {
                var resText = data.resolution === 'FHD' ? '1080p' : (data.resolution === 'HD' ? '720p' : data.resolution);
                if ((data.resolution === '4K' && Lampa.Storage.get('likhtar_badge_4k', true)) || 
                    ((data.resolution === 'FHD' || data.resolution === 'HD') && Lampa.Storage.get('likhtar_badge_fhd', true))) {
                    container.append($('<div class="'+tagClass+'">' + resText + '</div>'));
                }
            }

            if (data.hdr && Lampa.Storage.get('likhtar_badge_hdr', true)) {
                var hdrText = data.dolbyVision ? 'Dolby Vision' : 'HDR';
                container.append($('<div class="'+tagClass+'">' + hdrText + '</div>'));
            }
        }

        function initFullCardMarks() {
            if (!Lampa.Listener || !Lampa.Listener.follow) return;
            
            // Відловлюємо подію побудови (build) повної сторінки
            Lampa.Listener.follow('full', function (e) {
                if (e.type === 'build' && e.object && e.object.html) {
                    injectFullCardMarks(e.data.movie, e.object.html);
                }
            });

            // На випадок, якщо користувач оновив сторінку, і картка вже відкрита
            setTimeout(function () {
                try {
                    var act = Lampa.Activity && Lampa.Activity.active && Lampa.Activity.active();
                    if (act && act.component === 'full' && act.activity && act.activity.render) {
                        injectFullCardMarks(act.card || act.movie, act.activity.render());
                    }
                } catch (err) { }
            }, 500);
        }

        // =============================================================
        // ІНЖЕКТ МІТОК НА ПОСТЕРИ (ГОЛОВНА ТА КАТАЛОГИ)
        // =============================================================
        function processCards() {
            $('.card:not(.jacred-mark-processed-v2)').each(function () {
                var card = $(this);
                card.addClass('jacred-mark-processed-v2');

                var movie = card[0].heroMovieData || card.data('item') || (card[0] && (card[0].card_data || card[0].item)) || null;
                if (movie && movie.id && !movie.size) {
                    addMarksToContainer(card, movie, '.card__view');
                }
            });
        }

        function observeCardRows() {
            var observer = new MutationObserver(function () {
                processCards();
            });
            observer.observe(document.body, { childList: true, subtree: true });
            processCards();
        }

        var _uafixCache = {};

        function checkUafixDirect(movie, callback) {
            var query = movie.original_title || movie.original_name || movie.title || movie.name || '';
            if (!query) return callback(false);
            var searchUrl = 'https://uafix.net/index.php?do=search&subaction=search&story=' + encodeURIComponent(query);
            fetchWithProxy(searchUrl, function (err, html) {
                if (err || !html) return callback(false);
                var hasResults = html.indexOf('знайдено') >= 0 && html.indexOf('0 відповідей') < 0;
                callback(hasResults);
            });
        }

        function checkUafix(movie, callback) {
            if (!movie || !movie.id) return callback(false);
            var key = 'uafix_' + movie.id;
            if (_uafixCache[key] !== undefined) return callback(_uafixCache[key]);
            checkUafixDirect(movie, function (found) {
                _uafixCache[key] = found;
                callback(found);
            });
        }

        function createBadge(cssClass, label) {
            var badge = document.createElement('div');
            badge.classList.add('card__mark');
            badge.classList.add('card__mark--' + cssClass);
            badge.textContent = label;
            return badge;
        }

        function addMarksToContainer(element, movie, viewSelector) {
            var containerParent = viewSelector ? element.find(viewSelector) : element;
            if (!containerParent.length) containerParent = element;

            var marksContainer = containerParent.find('.card-marks');
            if (!marksContainer.length) {
                marksContainer = $('<div class="card-marks"></div>');
                containerParent.append(marksContainer);
            }

            if (movie.has_ua !== undefined || movie.quality !== undefined) {
                var staticData = {
                    ukr: movie.has_ua === true,
                    pol: movie.has_pl === true,
                    resolution: movie.quality || 'SD',
                    hdr: movie.is_hdr === true,
                    eng: false
                };
                renderBadges(marksContainer, staticData, movie);
                return; 
            }

            getBestJacred(movie, function (data) {
                if (!data) data = { empty: true };
                checkUafix(movie, function (hasUafix) {
                    if (hasUafix && data) {
                        data.ukr = true;
                        data.empty = false;
                    }
                    if (data && !data.empty) renderBadges(marksContainer, data, movie);
                });
            });
        }

        function renderBadges(container, data, movie) {
            container.empty();
            if (data.ukr && Lampa.Storage.get('likhtar_badge_ua', true)) container.append(createBadge('ua', 'UA'));
            if (data.pol && Lampa.Storage.get('likhtar_badge_pl', true)) container.append(createBadge('pl', 'PL'));
            if (data.eng && Lampa.Storage.get('likhtar_badge_en', true)) container.append(createBadge('en', 'EN'));
            
            if (data.resolution && data.resolution !== 'SD') {
                if (data.resolution === '4K' && Lampa.Storage.get('likhtar_badge_4k', true)) container.append(createBadge('4k', '4K'));
                else if (data.resolution === 'FHD' && Lampa.Storage.get('likhtar_badge_fhd', true)) container.append(createBadge('fhd', 'FHD'));
                else if (data.resolution === 'HD' && Lampa.Storage.get('likhtar_badge_fhd', true)) container.append(createBadge('hd', 'HD'));
                else if (Lampa.Storage.get('likhtar_badge_fhd', true)) container.append(createBadge('hd', data.resolution));
            }
            if (data.hdr && Lampa.Storage.get('likhtar_badge_hdr', true)) container.append(createBadge('hdr', 'HDR'));
            
            if (movie) {
                var rating = parseFloat(movie.imdb_rating || movie.kp_rating || movie.vote_average || 0);
                if (rating > 0) {
                    var rBadge = document.createElement('div');
                    rBadge.classList.add('card__mark', 'card__mark--rating');
                    rBadge.innerHTML = '<span class="mark-star">★</span>' + rating.toFixed(1);
                    container.append(rBadge);
                }
            }
        }

        var style = document.createElement('style');
        style.innerHTML = `
            /* ====== Вирівнюємо нативну TV мітку ====== */
            .card .card__type {
                left: -0.2em !important;
            }

            /* ====== Мітки на постерах ====== */
            .card-marks {
                position: absolute;
                top: 2.7em;
                left: -0.2em;
                display: flex;
                flex-direction: column;
                gap: 0.15em;
                z-index: 10;
                pointer-events: none;
            }
            .card:not(.card--tv):not(.card--movie) .card-marks,
            .card--movie .card-marks {
                top: 1.4em;
            }
            .card__mark {
                padding: 0.35em 0.45em;
                font-size: 0.8em;
                font-weight: 800;
                line-height: 1;
                letter-spacing: 0.03em;
                border-radius: 0.3em;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                align-self: flex-start;
                opacity: 0;
                animation: mark-fade-in 0.35s ease-out forwards;
                border: 1px solid rgba(255,255,255,0.15);
            }
            .card__mark--ua  { background: linear-gradient(135deg, #1565c0, #42a5f5); color: #fff; border-color: rgba(66,165,245,0.4); }
            .card__mark--4k  { background: linear-gradient(135deg, #e65100, #ff9800); color: #fff; border-color: rgba(255,152,0,0.4); }
            .card__mark--fhd { background: linear-gradient(135deg, #4a148c, #ab47bc); color: #fff; border-color: rgba(171,71,188,0.4); }
            .card__mark--hd  { background: linear-gradient(135deg, #1b5e20, #66bb6a); color: #fff; border-color: rgba(102,187,106,0.4); }
            .card__mark--en  { background: linear-gradient(135deg, #37474f, #78909c); color: #fff; border-color: rgba(120,144,156,0.4); }
            .card__mark--pl  { background: linear-gradient(135deg, #c41e3a, #ff4d4d); color: #fff; border-color: rgba(255,77,77,0.4); }
            .card__mark--hdr { background: linear-gradient(135deg, #f57f17, #ffeb3b); color: #000; border-color: rgba(255,235,59,0.4); }
            .card__mark--rating { background: linear-gradient(135deg, #1a1a2e, #16213e); color: #ffd700; border-color: rgba(255,215,0,0.3); font-size: 0.75em; white-space: nowrap; }
            .card__mark--rating .mark-star { margin-right: 0.15em; font-size: 0.9em; }

            .card.jacred-mark-processed-v2 .card__vote { display: none !important; }

            @keyframes mark-fade-in { to { opacity: 1; } }
        `;
        document.head.appendChild(style);

        initFullCardMarks();
        observeCardRows();
    }

    // =================================================================
    // INIT FUNCTION
    // =================================================================
    function init() {
        setupMarksSettings();
        initMarksJacRed();
    }

    if (window.appready) init();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }

})();

(function () {
    'use strict';

    /**
     * Парсер Uakino для Lampa/Lampac
     */
    function UakinoParser(object) {
        var network = new Lampa.Reguest();
        var mainUrl = "https://uakino.best";
        
        // Ті самі регулярки з вашого Kotlin-коду
        const fileRegex = /file\s*:\s*["']([^",']+?)["']/;
        
        this.search = function (data) {
            // Lampa передає об'єкт фільму (title, year)
            var query = data.movie.title;
            var searchUrl = mainUrl;

            network.silent(searchUrl, (html) => {
                this.parseSearch(html, data);
            }, object.error, {
                do: 'search',
                subaction: 'search',
                story: query.replace(/ /g, '+')
            }, { method: 'POST' });
        };

        this.parseSearch = function (html, data) {
            var $ = cheerio.load(html);
            var results = [];
            var items = $('.movie-item');

            items.each((i, el) => {
                var a = $(el).find('a.movie-title, a.full-movie');
                var title = a.text().trim();
                var href = a.attr('href');
                
                // Перевірка на відповідність року (щоб не було зайвого)
                // Можна додати фільтрацію за назвою тут
                if (href) {
                    results.push({
                        title: title,
                        url: href
                    });
                }
            });

            if (results.length > 0) {
                // Вибираємо перший найбільш схожий результат
                this.loadMovie(results[0].url, data);
            } else {
                object.error();
            }
        };

        this.loadMovie = function (url, data) {
            network.silent(url, (html) => {
                var $ = cheerio.load(html);
                var id = url.split('/').pop().split('-')[0];
                var isSerial = url.includes('/seriesss/') || url.includes('/anime-series/');

                if (isSerial) {
                    // Логіка для серіалів через AJAX
                    var ajaxUrl = `${mainUrl}/engine/ajax/playlists.php?news_id=${id}&xfield=playlist&time=${Date.now()}`;
                    network.silent(ajaxUrl, (res) => {
                        if (res.success) {
                            var $s = cheerio.load(res.response);
                            var files = [];
                            $s('.playlists-videos li').each((i, el) => {
                                files.push({
                                    title: $(el).text().trim(),
                                    file: $(el).attr('data-file'),
                                    quality: $(el).attr('data-voice') || 'UA'
                                });
                            });
                            this.success(files, data);
                        }
                    }, object.error, null, {
                        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Referer': mainUrl }
                    });
                } else {
                    // Логіка для фільмів
                    var iframeUrl = $('#pre').attr('src') || $('#pre').attr('data-src');
                    if (iframeUrl) {
                        this.extractDirect(iframeUrl, data);
                    } else {
                        object.error();
                    }
                }
            });
        };

        this.extractDirect = function (iframeUrl, data) {
            if (!iframeUrl.startsWith('http')) iframeUrl = 'https:' + iframeUrl;
            network.silent(iframeUrl, (scriptHtml) => {
                var match = scriptHtml.match(fileRegex);
                if (match) {
                    var files = [{
                        title: 'Uakino Video',
                        file: match[1],
                        quality: '720p/1080p'
                    }];
                    this.success(files, data);
                }
            }, object.error, null, { headers: { 'Referer': mainUrl } });
        };

        this.success = function (files, data) {
            var result = files.map(f => {
                return {
                    title: f.title,
                    url: f.file.startsWith('http') ? f.file : 'https:' + f.file,
                    quality: f.quality
                };
            });
            object.success(result);
        };
    }

    // Реєстрація як джерела відео
    function startPlugin() {
        Lampa.Component.add('uakino_parser', UakinoParser);
        
        // Додаємо кнопку "Uakino" в меню парсерів
        Lampa.Metrika.cache('uakino_parser', 10); // кешуємо результати на 10 хв
        
        Lampa.Player.onSearch((data) => {
            return new UakinoParser(data);
        });
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', (e) => {
        if (e.type == 'ready') startPlugin();
    });

})();

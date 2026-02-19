(function () {
    'use strict';

    Lampa.Platform.tv();

    /**
     * Плагін для Uakino.best (Lampac)
     * Базується на логіці CloudStream UakinoProvider
     */
    function Uakino(object) {
        var network = new Lampa.Reguest();
        var scroll  = new Lampa.Scroll({mask: true, over: true});
        var items   = [];
        var extract = {};
        var mainUrl = "https://uakino.best";

        // Селектори та регулярки з вашого коду
        const fileRegex = /file\s*:\s*["']([^",']+?)["']/;
        const subsRegex = /subtitle\s*:\s*["']([^",']+?)["']/;

        this.create = function () {
            this.activity.loader(true);
            this.start();
            return this.render();
        };

        this.start = function () {
            var url = object.url;
            if (object.search) {
                // Логіка пошуку (POST запит)
                network.silent(mainUrl, (html) => {
                    this.build(html);
                }, (e) => {
                    this.empty();
                }, {
                    do: 'search',
                    subaction: 'search',
                    story: object.search.replace(/ /g, '+')
                }, {method: 'POST'});
            } else {
                // Логіка категорій
                network.silent(url, (html) => {
                    this.build(html);
                }, this.empty.bind(this));
            }
        };

        this.build = function (html) {
            var $ = cheerio.load(html);
            var container = $('.owl-item, .movie-item');

            container.each((i, el) => {
                var a = $(el).find('a.movie-title, a.full-movie');
                var href = a.attr('href');
                
                // Фільтр "чорних" посилань (news/franchise)
                if (href && !href.match(/(\/news\/)|(\/franchise\/)/)) {
                    var title = a.text().trim() || $(el).find('.full-movie-title').text().trim();
                    var img = $(el).find('img').attr('src');
                    
                    items.push({
                        title: title,
                        url: href,
                        img: img ? (img.startsWith('http') ? img : mainUrl + img) : '',
                        method: href.includes('/seriesss/') || href.includes('/anime-series/') ? 'serial' : 'movie'
                    });
                }
            });

            if (items.length) {
                this.display();
            } else {
                this.empty();
            }
        };

        this.display = function () {
            this.activity.loader(false);
            // Тут логіка рендеру карток у Lampa
            items.forEach(item => {
                var card = Lampa.Template.get('card', item);
                card.on('click', () => {
                    this.loadDetails(item);
                });
                scroll.append(card);
            });
        };

        // Отримання посилань (LoadLinks логіка)
        this.loadDetails = function (item) {
            Lampa.Select.show({
                title: 'Вибір якості/озвучки',
                items: [{title: 'Завантаження...', info: ''}],
                onSelect: (sel) => {}
            });

            network.silent(item.url, (html) => {
                var $ = cheerio.load(html);
                var id = item.url.split('/').pop().split('-')[0];
                var iframeUrl = $('#pre').attr('src') || $('#pre').attr('data-src');

                if (item.method === 'serial') {
                    // AJAX для серіалів
                    var ajaxUrl = `${mainUrl}/engine/ajax/playlists.php?news_id=${id}&xfield=playlist&time=${Date.now()}`;
                    network.silent(ajaxUrl, (data) => {
                        if (data.success) {
                            var $s = cheerio.load(data.response);
                            var episodes = [];
                            $s('.playlists-videos li').each((i, el) => {
                                episodes.push({
                                    title: $(el).text().trim(),
                                    file: $(el).attr('data-file'),
                                    voice: $(el).attr('data-voice')
                                });
                            });
                            this.showEpisodes(episodes);
                        }
                    }, null, null, {
                        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Referer': mainUrl }
                    });
                } else {
                    // Пряме витягування для фільму
                    if (iframeUrl) this.extractVideo(iframeUrl);
                }
            });
        };

        this.extractVideo = function (url) {
            if (!url.startsWith('http')) url = 'https:' + url;
            network.silent(url, (scriptHtml) => {
                var fileMatch = scriptHtml.match(fileRegex);
                if (fileMatch) {
                    var videoUrl = fileMatch[1];
                    Lampa.Player.play({
                        url: videoUrl,
                        title: object.title
                    });
                }
            }, null, null, { headers: { 'Referer': mainUrl } });
        };

        this.empty = function () {
            this.activity.loader(false);
            // Відобразити "порожньо"
        };

        this.render = function () {
            return scroll.render();
        };
    }

    // Реєстрація плагіна в системі
    Lampa.Component.add('uakino', Uakino);

    function startPlugin() {
        window.uakino_plugin = true;
        Lampa.Menu.add({
            id: 'uakino',
            title: 'Uakino',
            icon: `<svg...>`, // тут можна додати іконку
            onSelect: function () {
                Lampa.Activity.push({
                    url: 'https://uakino.best/filmy/',
                    title: 'Uakino',
                    component: 'uakino',
                    page: 1
                });
            }
        });
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') startPlugin();
    });

})();

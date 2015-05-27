define([
    'jquery',
    'jQuery-ajaxTransport-XDomainRequest',
    'lodash',
    'bowser',
    'viewportSize',
    'text!templates/mainTemplate.html',
    'text!templates/navTemplate.html'
], function(
    $,
    jqueryAjaxPlugin,
    _,
    bowser,
    viewportSize,
    mainTmpl,
    navTmpl
) {
   'use strict';
    var rightTop,
        stickyTop,
        sheets,
        $window = $(window),
        $body,
        fixed = {},
        anchorsFired = new Array(),
        currentAnchors = {},
        lastAnchors = {},
        currentChapter,
        windowWidth = viewportSize.getWidth(),
        pastIntro = false,
        mobile = false,
        tablet = false,
        mute = false,
        currentAudio = "full-intro",
        currentDropdown = "",
        ticking = false,
        latestKnownScrollY = 0,
        volumes = {
            "videos": 0.6,
            "audio": 0.5,
        },
        dom = {},
        bandwidth = 750,
        savedData,
        loadDate = new Date(); 

    function init(el, context, config, mediator) {
        whatBrowser();
        $.ajax({
            url: "http://interactive.guim.co.uk/spreadsheetdata/0Aoi-l6_XQTv5dFV4X0pMVzNZUThfajVJeXk4Z0JzV1E.json",
            cache: false,
            crossDomain: true
        })
        .done(function(data) {
            data = typeof data === 'string' ? JSON.parse(data) : data;
            savedData = data;
            whatBrowser();
            testBandwidth(app);
        });
    }

    function app() {
        var data = savedData;
        console.log('start');
        sheets = data.sheets;
        var mainTemplate = _.template(mainTmpl),
            mainHTML = mainTemplate({data: data.sheets, getVideoNew: getVideoNew, width: viewportSize.getWidth()}),
            navTemplate = _.template(navTmpl),
            navHTML = navTemplate({});

        $body = $("body");
        $("html").css("overflow-y", "scroll");

        $(".element-interactive").html(mainHTML)
        $(".element-interactive .story-wrapper").before(navHTML);

        saveSelectors();
        initEvents();
    }

    function saveSelectors() {
        dom.chapters = {};
        $(".chapter").each(function(i, el) {
            var $el = $(el);
            dom.chapters[$el.attr("id")] = $(el);
        });

        dom.videos = {"chapters": {}, "breaks": {}};
        $(".right-container video").each(function(i, el) {
            var $el = $(el);
            dom.videos.chapters[$el.closest(".chapter").attr("id")] = $el;
        });

        $(".full").each(function(i, el) {
            var $el = $(el).find("video");
            if($el.length > 0 && !$el.closest(".full").hasClass("top")) {
                dom.videos.breaks[$el.closest(".full").attr("id")] = $el;
            }
        });

        dom.videos.intro = $("#full-intro video");

        // dom.videos.intro.get(0).addEventListener("playing", function() {
        //     console.log(new Date() - loadDate);
        // });

        dom.anchors = {"chapter-1": {}, "chapter-2": {}, "chapter-3": {}, "chapter-4": {}, "chapter-5": {}};

        $("#chapter-1 a[name]").each(function(i, el) {
            var $el = $(el);
            dom.anchors['chapter-1'][$el.attr("name")] = $el;
        });

        $("#chapter-2 a[name]").each(function(i, el) {
            var $el = $(el);
            dom.anchors['chapter-2'][$el.attr("name")] = $el;
        });

        $("#chapter-3 a[name]").each(function(i, el) {
            var $el = $(el);
            dom.anchors['chapter-3'][$el.attr("name")] = $el;
        });

        $("#chapter-4 a[name]").each(function(i, el) {
            var $el = $(el);
            dom.anchors['chapter-4'][$el.attr("name")] = $el;
        });

        $("#chapter-5 a[name]").each(function(i, el) {
            var $el = $(el);
            dom.anchors['chapter-5'][$el.attr("name")] = $el;
        });

        dom.nav = {"items": {}};
        dom.nav['container'] = $(".nav");
        $(".js-nav-item").each(function(i, el) {
            var $el = $(el);
            dom.nav.items[$el.attr("id")] = $el;
        });

        dom.breaks = {};
        $(".full").each(function(i, el) {
            var $el = $(el);
            dom.breaks[$el.attr("id")] = $el;
        });

        dom.text = {};
        $(".text--content").each(function(i, el) {
            var $el = $(el);
            dom.text[$el.closest(".int-main").attr("id")] = $el;
        });

        dom.audio = {};
        $(".audio-player").each(function(i, el) {
            var $el = $(el);
            dom.audio[$el.attr("id").slice(6)] = $el;
        });

        dom.navigation = {};
        dom.navigation['container'] = $(".nav");

        rightTop = parseInt($("#css-rc").css("top"));
        stickyTop = parseInt($("#css").css("top"), 10);

        dom.intro = {}
        dom.intro['right'] = $("#intro .right-container");
        dom.intro['div'] = $("#intro");

    }

    function whatBrowser() {
        if(bowser.mobile) {
            mobile = true;
        }

        if(bowser.tablet) {
            tablet = true;
        }
    }

    function initEvents() {
        preLoad();

        if(!mobile && !tablet && viewportSize.getWidth() > 980) {

            $(window).scroll(_.debounce(update, 500));

            $(window).scroll(_.throttle(function() {
                stickDivs(window.scrollY);
            }, 50));

            $(window).resize(_.throttle(function() {
                resizeVideos();
                saveSelectors();
            }, 100));

            $(".large-break-scroll").click(function(e) {
                $("html,body").animate({scrollTop: $(e.target).closest(".full").next(".int-container").find(".chapter").offset().top + 20}, 600);
            }); 

            resizeVideos();

            dom.videos.intro.get(0).oncanplay = function() {
                setTimeout(function() {
                    $(".title-box").addClass("visible");

                    setTimeout(function() {
                        $(".int-top-logo").addClass("visible");
                        setTimeout(function() {
                            $("#full-intro .large-break-scroll").addClass("scroll-visible");
                        }, 1000);
                    }, 1000);
                }, 22000);


                dom.videos.intro.get(0).onended = function() {
                    dom.videos.intro.remove();
                    $("#full-intro .video-wrapper").css("background-image", "url('@@assetPath@@/imgs/intro.png')");
                }
            }
        }

        var chp2Width = $("#chapter-1").width(),
            chp2RCWidth = $("#chapter-1 .right-container").width(),
            chp2TWidth = $("#chapter-1").find(".text").width();

        setTimeout(function() {
            if(!tablet && chp2Width - (chp2RCWidth + chp2TWidth) > 40) {
                $("head").append("<style>.text { width: " + (chp2Width - chp2RCWidth - 60) + "px; }</style>");
            }
        }, 500);

        $window.resize(_.debounce(function(){
            chp2Width = $("#chapter-1").width();
            chp2RCWidth = $("#chapter-1 .right-container").width();
            chp2TWidth = $("#chapter-1 .text").width();
            if((viewportSize.getWidth() > 980 && windowWidth < 980) || (viewportSize.getWidth() < 980 && windowWidth > 980) ) {
                location.reload();
            }

            windowWidth = viewportSize.getWidth();

            if(viewportSize.getWidth() > 980 && (chp2Width - (chp2RCWidth + chp2TWidth) > 40 || chp2Width - (chp2RCWidth + chp2TWidth) < 20)) {
                $("head").append("<style>.text { width: " + (chp2Width - chp2RCWidth - 60) + "px; }</style>");
            }
        }, 500));

        $window.on("orientationchange", _.debounce(function(){
            location.reload();
            windowWidth = viewportSize.getWidth();
        }, 500));

        $(".change-location").on("click", function(e) {
            var svg = '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M7.5 9L1 2l1-1 7 6.5L16 1l1 1-6.5 7 6.5 7-1 1-7-6.5L2 17l-1-1 6.5-7z"></path></svg>';
            if(e.currentTarget !== currentDropdown) {
                $("#int-dropdown").addClass("dropdown-open").appendTo(e.currentTarget.offsetParent);
                $(currentDropdown).html("episodes");
                $(e.currentTarget).html("close " + svg);
                currentDropdown = e.currentTarget;
            } else {
                $("#int-dropdown").toggleClass("dropdown-open");
                var setTo = (!$("#int-dropdown").hasClass("dropdown-open")) ? "episodes" : "close " + svg;
                $(e.currentTarget).html(setTo); 
            }
        }); 

        setAudioLevels();

        if((mobile || tablet) || viewportSize.getWidth() < 980) {
            dom.videos.intro.get(0).play();
            $(window).scroll( _.debounce(function() {
                mobilePlay() 
            }, 500));
        }

        if(mobile || tablet || viewportSize.getWidth() < 980) {
            _.each(dom.videos.breaks, function($el, key) {
                $el.prop("controls", true);
            });
            dom.videos.intro.prop("controls", true);
            dom.videos.intro.prop("autoplay", false);
        }

        if(tablet || mobile) {
            $("head").append("<style>.full video, .full { height:" + viewportSize.getWidth()/(16/9) + "px !important; }</style>");
            $("#full-intro .video-wrapper").css("position", "absolute");
        }

        if(tablet && viewportSize.getWidth() > 980) {
            $("head").append("<style>.text { width: 100%; max-width: 620px; } .right-container { display: none; } .mute { display: none; }</style>");
        }

        $("#show-credits").click(function() {
            $(".column").toggleClass("credits-visible");

            if($(".column").hasClass("credits-visible")) {
                $(".int-bottom-logo").css("opacity", "0");
                $("#show-credits").text("Hide credits");
                $("#int-teaser").css("opacity", "0");
            } else {
                $(".int-bottom-logo").css("opacity", "1");
                $("#show-credits").text("Show credits");
                $("#int-teaser").css("opacity", "1");
            }
        });

        $(".js-mute").on("click", function() {
            muteVideo();
        });
        // initTicker();
    }

    function update() {
        var currentScrollY = window.scrollY;

        navStuff(currentScrollY);
        videoControl(currentScrollY);
        anchorsAction(currentScrollY);
        // stickDivs(currentScrollY);
    }

    function setAudioLevels() {
        _.each(dom.audio, function($el, key) {
            if(key === "full-intro") {
                $el.get(0).volume = volumes.audio;
            } else {
                $el.get(0).volume = 0;
            }
        });

        $("video").each(function(i, el) {
            el.volume = volumes.videos;
        });
    }

    function stickDivs(scrollY) {
        _.each(dom.chapters, function(val, key) {
            var $div = val,
                $divRC = $.data(val, "RC") || $div.children(".right-container"),
                divHeight = $div.height(),
                divOffset = $div.offset().top;

            $.data(val, "RC", $divRC);

            if(key !== "intro") {
                if(divOffset + divHeight - stickyTop <= scrollY + $divRC.height()) {
                    $divRC.addClass("right-container--bottom");
                    $div.addClass("bottom");
                } else {
                    $divRC.removeClass("right-container--bottom");
                    $div.removeClass("bottom");
                }

                if(divOffset - (stickyTop - rightTop) <= scrollY) {
                    $divRC.addClass("right-container--sticky");
                    $div.addClass("stuck");
                } else {
                    $divRC.removeClass("right-container--sticky");
                    $div.removeClass("stuck");
                }
            }

            if(divOffset - 500 <= scrollY && (divOffset + divHeight) - 500 >= scrollY) {
                $divRC.addClass("visible");
            } else {
                $divRC.removeClass("visible");
            }

        });

        _.each(dom.videos.breaks, function($el, key) {
            var $full,
                $elVidWrapper;

            if($.data($el, "full") || $.data($el, "videoWrapper")) {
                $full = $.data($el, "full");
                $elVidWrapper = $.data($el, "videoWrapper");
            } else {
                $full = $el.closest(".full")
                $elVidWrapper = $el.parent(".video-wrapper");
                $.data($el, "full", $full);
                $.data($el, "videoWrapper", $elVidWrapper);
            }

            if($full.offset().top <= $window.scrollTop() && key !== "head-6") {
                $elVidWrapper.css("position", "fixed");

                if($full.offset().top + $full.height() >= $window.scrollTop()) {
                    $full.addClass("js-fixed");
                } else {
                    $full.removeClass("js-fixed");
                }

                if(fixed[key] !== true) {
                    fixed[key] = true;

                    setTimeout(function() {
                        $full.find(".large-break-title").addClass("visible");
                    }, 500);

                    setTimeout(function() {
                        $full.find(".large-break").addClass("visible");
                    }, 1000);

                    setTimeout(function() {
                        $full.find(".large-break-scroll").addClass("scroll-visible");
                        $.scrollLock(false);

                    }, 1500);

                    $full[0].scrollIntoView();
                    $.scrollLock(true);
                }
            } else {
                $elVidWrapper.css("position", "absolute");
                $full.removeClass("js-fixed");
            }
        });

        if(window.scrollY > dom.intro['div'].offset().top) {
            dom.intro['right'].addClass("right-container--sticky");

            if(dom.intro['div'].offset().top + dom.intro['div'].height() < window.scrollY) {
                dom.intro['right'].addClass("right-container--bottom");
            } else {
                dom.intro['right'].removeClass("right-container--bottom");
            }
        } else {
            dom.intro['right'].removeClass("right-container--sticky");
            dom.intro['right'].removeClass("right-container--bottom");
        }

        if(window.scrollY > $("#graph1").offset().top - $window.height() + 300) {
            $("#graph1").removeClass("before-animate");
        }
    }

    function mobilePlay() {
        _.each(dom.videos.breaks, function(val, key) {
            var $el = val;

            if($el.offset().top < $window.scrollTop() + $window.height() && $el.offset().top + $el.height() > $window.scrollTop()) {
                $el.get(0).play();
            } else {
                $el.get(0).pause();
            }
        });

        if($window.scrollTop() < dom.videos.intro.height()) {
            dom.videos.intro.get(0).play();
        } else {
            dom.videos.intro.get(0).pause();
        }
    }

    function videoControl(scrollY) {
        _.each(dom.videos.breaks, function(val, key) {
            var $el = val,
                $elParent = $.data(val, "full") || $el.closest(".full"),
                elParentOffset = $elParent.offset().top;

            if((elParentOffset - $window.height() + 500 <= scrollY && $window.scrollTop() + 500 < elParentOffset + $elParent.height())) {
                // $el.parent().css("opacity", "1");
                // $el.get(0).volume = 1;
                if($el.get(0).paused) {
                    $el.prop("volume", 0);
                    $el.get(0).load();
                    $el.get(0).play();
                    $el.animate({volume: volumes.videos}, 1000);
                    $el.css("display", "block");
                }
            } else {
                // $el.parent().css("opacity", "0");
                if(!$el.get(0).paused) {
                    $el.animate({volume: 0}, 1000);
                    setTimeout(function() {
                        $el.get(0).pause();
                    }, 1000);
                    $el.css("display", "none");
                }
            }
        });

        _.each(dom.videos.chapters, function(val, key) {
            var $el = val,
                $elParent = $.data(val, "full") || $el.closest(".right-container");

            if($elParent.hasClass("right-container--sticky") && !$elParent.hasClass("right-container--bottom")) {
                if($el.get(0).paused) {
                    $el.prop("volume", 0);
                    $el.get(0).play();
                    $el.animate({volume: volumes.videos}, 1000);
                    $el.css("display", "block");
                }
            } else {
                if(!$el.get(0).paused) {
                    $el.animate({volume: volumes.videos}, 1000);
                    setTimeout(function() {
                        $el.get(0).pause();
                    }, 1000);
                    $el.css("display", "none");
                }
            }
        });

        if(dom.videos.intro.get(0) && scrollY > $window.height() && windowWidth > 980) {
            dom.videos.intro.get(0).pause();
            dom.videos.intro.remove();
            $("#full-intro .video-wrapper").css("background-image", "url('@@assetPath@@/imgs/intro.png')");
            $(".title-box").addClass("visible");
        }
    }

    function muteVideo() {
        mute = (mute) ? false : true;
        _.each(dom.videos.breaks, function($el, key) {
            $el.get(0).muted = mute;
        });
        _.each(dom.videos.chapters, function($el, key) {
            $el.get(0).muted = mute;
        });
        _.each(dom.audio, function($el, key) {
            $el.get(0).muted = mute;
        });

        if(dom.videos.intro.get(0)) {
            dom.videos.intro.get(0).muted = mute;
        }

        if(mute === true) {
            $(".mute").addClass("muted");
        } else {
            $(".mute").removeClass("muted");
        }
    }

    function resizeVideos() {
        $("head").append("<style type='text/css'>.right-container video { margin-left: " + (-(dom.videos.chapters['chapter-1'].closest(".right-container").height()*(16/9) - dom.videos.chapters['chapter-1'].closest(".right-container").width())/2) + "px;}</style>");
        if(1.78 < $body.width() / $body.height()) {
            $body.removeClass("non-wide");

            $("head style").append(".full video { margin-left: " + 0 + "px;}");

            // videos
            // _.each(dom.videos.chapters, function($el, key) {
            //     $el.css("margin-left", (-($el.width() - $el.parent(".right-container").width())/2));
            // });
        } else {
            $body.addClass("non-wide");

            $("head style").append(".full video { margin-left: " + -((($body.height()*(16/9) - $body.width()))/2) + "px;}");
        }
    }

    function navStuff(scrollY) {
        var section = "";
        _.each(dom.breaks, function($el, key) {
            if($el.offset().top <= scrollY) {
                if(key !== currentChapter) {
                    section = key;
                    currentChapter = key;
                }
            }
        });

        if(section) {

            _.each(dom.audio, function($el, key) {
                if(currentAudio !== section) {

                    if(currentAudio !== "head-6") {
                        var toPause = currentAudio;
                        dom.audio[currentAudio].animate({volume: 0}, 3000, function () {
                            dom.audio[toPause].get(0).pause();
                        });
                    }

                    if(section !== "head-6") {
                        dom.audio[section].get(0).play();
                        dom.audio[section].animate({volume: volumes.audio}, 3000);
                    }

                    currentAudio = section;
                }
            });
        }
    }

    function anchorsAction(scrollY) {
        _.each(dom.chapters, function(el, chapterName) {
            lastAnchors[chapterName] = "";

            _.each(dom.anchors[chapterName], function(val, key) {
                var $el = val;
                if($el.offset().top - ($window.height()*0.333) < scrollY) {
                    lastAnchors[chapterName] = $el;
                }
            });

            if(lastAnchors[chapterName] !== "" && currentAnchors[chapterName] !== lastAnchors[chapterName]) {
                dom.text[chapterName].removeClass("first");

                if(lastAnchors[chapterName].data("type") === "video") {
                    changeVideo(lastAnchors[chapterName]);
                }

                if(lastAnchors[chapterName].data("type") === "image") {
                    changeImage(lastAnchors[chapterName]);
                }

                currentAnchors[chapterName] = lastAnchors[chapterName];

            } else if(lastAnchors[chapterName] === "" && dom.text[chapterName] && !dom.text[chapterName].hasClass("first")) {
                delete currentAnchors[chapterName];
                dom.text[chapterName].addClass("first");
                changeVideo(dom.text[chapterName]);
            }
        });
    }

    function preLoad() {
        var imagesLoaded = 0;
    }

    function changeImage($anchor) {
        var $chapter = $anchor.closest(".chapter");

        $chapter.find(".right-container").append("<img class='waiting'/>");
        $chapter.find("img.waiting").attr('src', getImage($anchor.attr("name")));

        setTimeout(function() {
           $chapter.find("img.waiting").removeClass("waiting").addClass("top-layer");

           setTimeout(function() {
                $chapter.find(".top-layer").first().remove();
            }, 1000);
        }, 10);
    }


    function changeVideo($anchor) {
        var $chapter = $.data($anchor, "chapter") || $anchor.closest(".chapter"),
            $chapterRC = $.data($anchor, "chapterRC") || $chapter.find(".right-container"),
            name = $anchor.attr("name");

        if(!$.data($anchor, "chapter")) {
            $.data($anchor, "chapter", $chapter);
            $.data($anchor, "chapterRC", $chapterRC);
        }

        $chapterRC.prepend(getVideoNew(name, "waiting", true, true));

        var $videoWrapper = $chapter.find("#" + name);

        dom.videos.chapters[$chapter.attr("id")] = $videoWrapper.find("video");
        dom.videos.chapters[$chapter.attr("id")].prop("volume", 0);

        $videoWrapper.removeClass("waiting").addClass("top-layer");

        var $save = $chapter.find(".top-layer").slice(1);

        dom.videos.chapters[$chapter.attr("id")].on('canplay', function() {
            // if($save.find("video").length > 0) { $save.find("video").get(0).pause(); }
            $save.addClass("fade-out");
            $save.find("video").animate({volume: 0}, 1000);

            dom.videos.chapters[$chapter.attr("id")].animate({volume: volumes.videos}, 1000);

            setTimeout(function() {
                $save.remove();
            }, 1000);
        });
    }

    function getImage(name) {
        var src = images[name].high;

        return src;
    }

    function getAltImage(name) {
        var src = altImages[name].high;

        return src;
    }

    function getVideoNew(name, className, autoplay, loop) {
        var mutedTag = (mute) ? " muted " : "",
            classTag =  (className) ? className : "",
            posterTag = "poster='http://multimedia.guardianapis.com/interactivevideos/video.php?file=" + name + "&format=video/mp4&maxbitrate=1024&poster=1'",
            autoplayTag = (autoplay) ? "autoplay" : "",
            loopTag = (loop) ? " loop " : "",
            src = {}; 
        src.mp4 = "<source src='http://multimedia.guardianapis.com/interactivevideos/video.php?file=" + name + "&format=video/mp4&maxbitrate=" + bandwidth + "' type='video/mp4'>";
        // src.ogg = "<source src='http://multimedia.guardianapis.com/interactivevideos/video.php?file=" + name + "&format=video/ogg&maxbitrate=2048' type='video/ogg'>";
        src.webm = "<source src='http://multimedia.guardianapis.com/interactivevideos/video.php?file=" + name + "&format=video/webm&maxbitrate=" + bandwidth + "' type='video/webm'>";
        return "<div id='" + name +"' class='video-wrapper " + classTag + "' style='background-image: url(\"http://multimedia.guardianapis.com/interactivevideos/video.php?file=" + name + "&format=video/mp4&maxbitrate=1024&poster=1\");'><video preload='none' " + mutedTag + posterTag + loopTag + autoplayTag + " >" + src.mp4 + src.webm + "</video></div>";
    }

    function testBandwidth(callback) {
        var startTime = new Date().getTime();

//      var checkFileSmall = 'http://cdn.theguardian.tv/';
//      var fileSizeSmall = 384;
        var checkFileSmall = 'http://cdn.theguardian.tv/interactive/speedtest/testfilesmall.dat';
        var fileSizeSmall = 1024*8;
        var checkFileLarge = 'http://cdn.theguardian.tv/interactive/speedtest/testfile.dat';
        var fileSizeLarge = 102400*8;
        var timeout = 2000;//just give up after 5 seconds
//      checkFileSmall += "?bust=" + startTime;
//      checkFileLarge += "?bust=" + startTime;
        var err = null;

        // setTimeout(function() {
        //     console.log('bob');
        // }, 500); 


        var loadSecondsLarge = 0;
        var loadSecondsSmall = 0;
        var loadedLarge = false;
        var loadedSmall = false;

//      var oneLoaded = function(){
//          if(loadedLarge && loadedSmall){
//              bothLoaded();
//          }
//      };
        var bothLoaded = function(){
//          console.log('time to load '+(fileSizeSmall/1024)+'kb: ' + loadSecondsSmall);
//          console.log('time to load '+(fileSizeLarge/1024)+'kb: ' + loadSecondsLarge);
            var loadSecondsDiff = loadSecondsLarge - loadSecondsSmall;
            loadSecondsDiff = Math.max(loadSecondsDiff, 0.01);
            var fileSizeDiff = fileSizeLarge - fileSizeSmall;
            var rate = fileSizeDiff/loadSecondsDiff;

//          console.log('estimated bandwidth: ' + (rate/1024) + 'kbps');
            console.log('estimated bandwidth: ' + (rate/1024) + 'kilobits/s');
            console.log('estimated latency: ' + loadSecondsSmall);
            console.log(new Date() - loadDate);

            var ratekbps = Math.round(rate*0.75/1024);

            ratekbps = Math.min(ratekbps, 10000);
            ratekbps = Math.max(ratekbps, 100);
            bandwidth = ratekbps;

            if(callback){
                var temp = callback;
                callback = null;//prevent double callback
                temp(err, rate);
            }
        };

        timeFile(checkFileSmall, function(err, loadSeconds){
            //make sure dnscache is happy
            if(!err){
                timeFile(checkFileSmall, function(err, loadSeconds){
                if(!err){
                    loadSecondsSmall = loadSeconds;
                    loadedSmall = true;
                    timeFile(checkFileLarge, function(err, loadSeconds){
                        if(!err){
                            loadSecondsLarge = loadSeconds;
                            loadedLarge = true;
                            bothLoaded();
            //              oneLoaded();
                        }
                    });
                }
            });
            }
        });


//      Settings.timeFile(checkFileLarge, function(err, loadSeconds){
//          var rate = fileSize / loadSeconds;
//          Settings.bandwidth = rate;
//          if(callback){
//              callback(err, rate);
//              callback = null;//prevent double callback
//          }
//      });

        setTimeout(function(){
            if(callback){
                console.log('running from timeout');
                var temp = callback;
                callback = null;
                temp("timeout", bandwidth);
            }
        }, 1000);
    };

    function timeFile(url, callback) {
        var startTime = new Date().getTime();
        url += "?bust=" + startTime;
        var err = null;
        loadScript(url, function () {
//          console.log('probably should just ignore Unexpected SyntaxError');
            var endTime = new Date().getTime();
            var loadTime = endTime - startTime;
            var loadSeconds = loadTime * 0.001;
            if(callback){
                callback(err, loadSeconds);
            }
        });
    };

    function loadScript(url, callback) {
        var script = document.createElement("script");
        script.charset = "utf-8";
        script.src = url;
        var done = false;
        script.onload = script.onreadystatechange = function () {
            if (!done && (!this.readyState || this.readyState === "loaded" || this.readyState === "complete")) {
                done = true;
                if(callback){
                    callback();
                }
                script.onload = script.onreadystatechange = null;
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
            }
        };
        document.body.appendChild(script);
    };

    $.scrollLock = ( function scrollLockClosure() {
        'use strict';

        var $html      = $( 'html' ),
            // State: unlocked by default
            locked     = false,
            // State: scroll to revert to
            prevScroll = {
                scrollLeft : $( window ).scrollLeft(),
                scrollTop  : $( window ).scrollTop()
            },
            // State: styles to revert to
            prevStyles = {},
            lockStyles = {
                'overflow-y' : 'scroll',
                'position'   : 'fixed',
                'width'      : '100%'
            };

        // Instantiate cache in case someone tries to unlock before locking
        saveStyles();

        // Save context's inline styles in cache
        function saveStyles() {
            var styleAttr = $html.attr( 'style' ),
                styleStrs = [],
                styleHash = {};

            if( !styleAttr ){
                return;
            }

            styleStrs = styleAttr.split( /;\s/ );

            $.each( styleStrs, function serializeStyleProp( styleString ){
                if( !styleString ) {
                    return;
                }

                var keyValue = styleString.split( /\s:\s/ );

                if( keyValue.length < 2 ) {
                    return;
                }

                styleHash[ keyValue[ 0 ] ] = keyValue[ 1 ];
            } );

            $.extend( prevStyles, styleHash );
        }

        function lock() {
            var appliedLock = {};

            // Duplicate execution will break DOM statefulness
            if( locked || bowser.safari) {
                return;
            }

            // Save scroll state...
            prevScroll = {
                scrollLeft : $( window ).scrollLeft(),
                scrollTop  : $( window ).scrollTop()
            };

            // ...and styles
            saveStyles();

            // Compose our applied CSS
            $.extend( appliedLock, lockStyles, {
                // And apply scroll state as styles
                'left' : - prevScroll.scrollLeft + 'px',
                'top'  : - prevScroll.scrollTop  + 'px'
            } );

            // Then lock styles...
            $html.css( appliedLock );

            // ...and scroll state
            $( window )
                .scrollLeft( 0 )
                .scrollTop( 0 );

            locked = true;
        }

        function unlock() {
            // Duplicate execution will break DOM statefulness
            if( !locked ) {
                return;
            }

            // Revert styles
            $html.attr( 'style', $( '<x>' ).css( prevStyles ).attr( 'style' ) || '' );

            // Revert scroll values
            $( window )
                .scrollLeft( prevScroll.scrollLeft )
                .scrollTop(  prevScroll.scrollTop );

            locked = false;
        }

        return function scrollLock( on ) {
            // If an argument is passed, lock or unlock depending on truthiness
            if( arguments.length ) {
                if( on ) {
                    lock();
                }
                else {
                    unlock();
                }
            }
            // Otherwise, toggle
            else {
                if( locked ){
                    unlock();
                }
                else {
                    lock();
                }
            }
        };
    }() );


    return {
        init: init
    };
});

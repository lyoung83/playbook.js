/**
 * Playbook.js
 * MIT licensed
 *
 * @requires RaphaelJS
 * @version 0.1.0
 * @author Nathan Davison <http://www.nathandavison.com>
 */

(function (root, factory) {
    if (typeof exports === 'object') {
        // CommonJS
        factory(Raphael, exports);
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['raphael', 'exports'], factory);
    } else {
        // Browser globals
        factory(Raphael, root);
    }
}(this, function(Raphael, exports) {

    /**
     * Playbook is the function whose prototype builds the main object.
     *
     * @param {Object} options
     * @returns void
     */
    function Playbook(options) {

        // options
        options = options || {};
        this.options = {};
        this.options.element = options.element || 'canvas';
        this.options.gridSize = options.gridSize || 25;
        this.options.fieldWidth = options.fieldWidth || 1200;
        this.options.fieldHeight = options.fieldHeight || 900;
        this.options.yardLineGap = options.yardLineGap || 100;
        this.options.yardLineWidth = this.options.fieldWidth;
        this.options.yardLineHeight = options.yardLineHeight || 8;
        this.options.yardMarkerWidth = options.yardMarkerWidth || 50;
        this.options.routeWidth = options.routeWidth || 20;
        this.options.LOS = this.options.fieldHeight - (3 * this.options.yardLineGap);
        this.options.colors = options.colors || {
            offense: '#e33232',
            defense: '#323ae3'
        };
        this.options.routeOpacity = options.routeOpacity || {
            offense: 1,
            defense: 0.75
        };
        this.mode = options.mode || 'move';
    };

    /**
     * Builds the field and player elements.
     *
     * @returns {Object} The Playbook instance.
     */
    Playbook.prototype.build = function() {
        // apply the Raphael extensions
        RaphaelElementDrag(Raphael, this);
        RaphaelSnapToGrid(Raphael, this);
        RaphaelCreateRoute(Raphael, this);
        RaphaelPathDrag(Raphael, this);
        RaphaelPathFirstSegment(Raphael);
        RaphaelMovePathStart(Raphael);

        // build the field.
        PlaybookBuildField(this);

        // build the players.
        PlaybookBuildPlayers(this);

        return this;
    };

    /**
     * Exports the current player and route configuration to JSON.
     *
     * @returns {Object}
     */
    Playbook.prototype.exportPlay = function() {
        var xpos,
            ypos,
            route,
            zone,
            pathEl,
            zoneEl,
            side,
            playerData = {};
        playerData.offense = [];
        playerData.defense = [];

        this.players.forEach(function(player) {
            xpos = player.attr('cx');
            ypos = player.attr('cy');
            pathEl = player.data('route');
            if (pathEl && pathEl.type && pathEl.type == 'path') {
                route = pathEl.attr('path');
                zoneEl = pathEl.data('zone');
                if (zoneEl && zoneEl.type && zoneEl.type == 'rect') {
                    zone = {};
                    zone.x = zoneEl.attr('x');
                    zone.y = zoneEl.attr('y');
                    zone.width = zoneEl.attr('width');
                    zone.height = zoneEl.attr('height');
                } else {
                    zone = '';
                }
            } else {
                route = '';
                zone = '';
            }
            side = player.data('side');

            playerData[side].push({
                cx: xpos,
                cy: ypos,
                side: side,
                route: route,
                zone: zone
            });
        });

        return playerData;
    };

    /**
     * Imports a play into the field.
     *
     * @param {Object} playerData
     * @returns void
     */
    Playbook.prototype.importPlay = function(playerData) {
        if (playerData && (playerData.offense || playerData.defense)) {
            var importPlayers = function(side, playbook) {
                if (playerData[side].length > 0) {
                    var toExclude = [];
                    playbook.players.forEach(function(player) {
                        if (player.data('side') == side) {
                            toExclude.push(player);
                            var oldRoute = player.data('route');
                            if (oldRoute && oldRoute.type && oldRoute.type == 'path') {
                                oldRoute.removeAll();
                            }
                            player.remove();
                            player.removeData();
                        }
                    });
                    for (var i = 0; i < toExclude.length; i++) {
                        playbook.players.exclude(toExclude[i]);
                    }
                    for (var i = 0; i < playerData[side].length; i++) {
                        if (playerData[side][i] && playerData[side][i].cx & playerData[side][i].cy && side) {
                            var fill = playbook.options.colors[side];
                            var zone = playerData[side][i].zone ? PlaybookBuildZone(playbook, playerData[side][i].zone.x, playerData[side][i].zone.y, playerData[side][i].zone.width, playerData[side][i].zone.height, side) : {};
                            var route = playerData[side][i].route ? PlaybookBuildRoute(playbook, playerData[side][i].route, fill, side, zone) : {};
                            playbook.players.push(PlaybookBuildPlayer(playbook, playerData[side][i].cx, playerData[side][i].cy, fill, side, route));
                        }
                    }
                }
            };

            // import offensive players
            if (playerData.offense.length > 0) {
                importPlayers('offense', this);
            }
            // import defensive players
            if (playerData.offense.length > 0) {
                importPlayers('defense', this);
            }
        }
    };

    /**
     * Brings all the player elements to the front.
     *
     * @returns {Object} The Playbook instance.
     */
    Playbook.prototype.playersToFront = function() {
        this.players.forEach(function(player) {
            player.toFront();
        });
        return this;
    };

    /**
     * Changes the active "mode".
     *
     * @param {String} mode The mode to change to.
     * @returns {Object} The Playbook instance.
     */
    Playbook.prototype.changeMode = function(mode) {
        this.mode = mode;
        return this;
    };

    /**
     * Builds the field elements.
     *
     * @param {Object} playbook The Playbook instance.
     * @returns void
     */
    function PlaybookBuildField(playbook) {
        // the Raphael paper
        playbook.paper = Raphael(playbook.options.element, playbook.options.fieldWidth, playbook.options.fieldHeight);

        // the alternating-tone green field
        var turf = playbook.paper.set();
        for (var i = 0; i <= playbook.options.fieldWidth; i = i + playbook.options.yardLineGap) {
            var fill = '#3a8c3a';
            if (i / playbook.options.yardLineGap % 2) {
                fill = '#306f30';
            }
            turf.push(
                playbook.paper.rect(
                    0,
                    i,
                    playbook.options.fieldWidth,
                    playbook.options.yardLineGap
                )
                .attr('fill', fill)
                .attr('stroke-width', 0)
            );
        }

        // the yard markers
        var yardMarks = playbook.paper.set();
        var yardLines = playbook.paper.set();
        var yardDashes = playbook.paper.set();

        // the "10 yard" lines
        for (var i = 0; i < playbook.options.fieldHeight; i = i + playbook.options.yardLineGap) {
            var yardLineYOffset = (i - (playbook.options.yardLineHeight / 2));
            yardLines.push(
                playbook.paper.rect(
                    0,
                    yardLineYOffset,
                    playbook.options.yardLineWidth,
                    playbook.options.yardLineHeight
                )
                .attr('fill', '#f0fff0')
                .attr('stroke-width', 0)
            );
        }

        // the individual yard dashes
        for (var i = 0; i < playbook.options.fieldHeight; i = i + 20) {
            yardDashes.push(
                playbook.paper.rect(
                    20,
                    i,
                    playbook.options.yardMarkerWidth,
                    (playbook.options.yardLineHeight / 2)
                )
                .attr('fill', '#f0fff0')
                .attr('stroke-width', 0),
                playbook.paper.rect(
                    (playbook.options.fieldWidth - (playbook.options.yardMarkerWidth + 20)),
                    i,
                    playbook.options.yardMarkerWidth,
                    (playbook.options.yardLineHeight / 2)
                )
                .attr('fill', '#f0fff0')
                .attr('stroke-width', 0)
            );
        }
        yardMarks.push(yardLines);
        yardMarks.push(yardDashes);

        // create a Raphael set for the full field
        playbook.field = playbook.paper.set();
        playbook.field.push(
            turf,
            yardMarks
        );
    };

    /**
     * Builds the player elements.
     *
     * @param {Object} playbook The Playbook instance.
     * @returns void
     */
    function PlaybookBuildPlayers(playbook) {
        playbook.players = playbook.paper.set();
        for (var i = 0; i < 22; i++) {
            var fill, xpos, ypos, side;
            if (i > 10) {
                fill = playbook.options.colors.defense;
                xpos = (i - 10) * 100;
                ypos = (playbook.options.LOS - 25);
                side = 'defense';
            } else {
                fill = playbook.options.colors.offense;
                xpos = (i + 1) * 100;
                ypos = (playbook.options.LOS + 25);
                side = 'offense';
            }
            playbook.players.push(PlaybookBuildPlayer(playbook, xpos, ypos, fill, side));
        }
    };

    /**
     * Builds a single player element.
     *
     * @param {Object} playbook The Playbook instance.
     * @param {Number} x The x coord of the player.
     * @param {Number} y The y coord of the player.
     * @param {String} fill The fill color of the player.
     * @param {String} side The 'side' of the player ('offense' or 'defense').
     * @param {Object} route The route element.
     * @returns {Object} The player element.
     */
    function PlaybookBuildPlayer(playbook, x, y, fill, side, route) {
        var player = playbook.paper.circle(x, y, 18)
                        .attr('fill', fill)
                        .attr('stroke-width', 4)
                        .attr('stroke-fill', 'black')
                        .data('side', side)
                        .draggable()
                        ;

        // add a route if one was supplied
        if (route) {
            player.data('route', route);
        }
        return player;
    };

    /**
     * Builds a single route element.
     *
     * @param {Object} playbook The Playbook instance.
     * @param {String} path The path string.
     * @param {String} fill The fill color of the player.
     * @param {String} side The 'side' of the route ('offense' or 'defense').
     * @param {Object} zone The zone element.
     * @returns {Object} The route element.
     */
    function PlaybookBuildRoute(playbook, path, fill, side, zone) {
        var route = playbook.paper.path(path)
            .attr('stroke', fill)
            .attr('stroke-width', playbook.options.routeWidth)
            .attr('stroke-opacity', playbook.options.routeOpacity[side] ? playbook.options.routeOpacity[side] : 1);
            ;

        if (zone && zone.type == 'rect') {
            route.data('zone', zone);
        }

        // remove the route plus any zone it may have
        route.removeAll = function() {
            // if there is a zone, remove it first
            var zone = this.data('zone');
            if (zone && zone.type == 'rect') {
                zone.remove();
            }
            this.remove();
        };

        route.pathdrag();
        route.data('side', side);

        return route;
    };

    /**
     * Builds a single zone.
     *
     * @param {Object} playbook The Playbook instance.
     * @param {Number} x The x coord of the zone.
     * @param {Number} y The y coord of the zone.
     * @param {Number} width The width of the zone.
     * @param {Number} height The height of the zone.
     * @param {String} side The 'side' of the zone ('offense' or 'defense').
     * @returns {Object} The zone element.
     */
    function PlaybookBuildZone(playbook, x, y, width, height, side) {
        var zone = playbook.paper.rect(x, y, width, height, 20)
                    .attr('fill', playbook.options.colors.defense)
                    .attr('stroke-width', 0)
                    .attr('fill-opacity', playbook.options.routeOpacity[side] ? playbook.options.routeOpacity[side] : 1)
                    ;

        return zone;
    };

    /**
     * Extends Raphael elements with a 'draggable' method.
     *
     * @param {Object} Raphael
     * @param {Object} playbook The Playbook instance.
     * @returns {Object} The element.
     */
    function RaphaelElementDrag(Raphael, playbook) {
        Raphael.el.draggable = function() {

            var ox, oy, el, xattr, yattr;
            el = this;

            // determine the attributes to use
            if (el.type && el.type == 'circle') {
                xattr = 'cx';
                yattr = 'cy';
            } else {
                xattr = 'x';
                yattr = 'y';
            }

            // the drag callbacks
            var startCallBack = function(x, y) {
                // get the original values
                ox = el.attr(xattr);
                oy = el.attr(yattr);
                if (playbook.mode == 'design') {
                    // in design mode, dragging on a player starts a new route
                    el.createRoute(x, y);
                }
            };

            var moveCallBack = function(dx, dy, x, y) {
                var newx = ox + dx;
                var newy = oy + dy;
                if (playbook.mode == 'move') {
                    el.attr(xattr, newx).attr(yattr, newy);
                    // if the element has a route path, move its starting coords
                    var route = el.data('route');
                    if (route && route.type && route.type == 'path') {
                        route.movePathStart(newx, newy);
                    }
                }
                if (playbook.mode == 'design') {
                    el.pathFirstSegment(newx, newy);
                }
            };

            var endCallBack = function(ev) {
                if (playbook.mode == 'move') {
                    el.snapToGrid(ev);
                }
            };

            // set the drag event callbacks
            this.drag(
                moveCallBack,
                startCallBack,
                endCallBack
            );

            return this;
        };
    };

    /**
     * Extends Raphael elements with a 'snapToGrid' method, which
     * wraps Raphael's inbuilt grid snapping ability with logic
     * around the Playbook grid.
     *
     * @param {Object} Raphael
     * @param {Object} playbook The Playbook instance.
     * @returns {Object} The element.
     */
    function RaphaelSnapToGrid(Raphael, playbook) {
        Raphael.el.snapToGrid = function(ev) {
            var xattr, yattr;
            if (this.type && this.type == 'circle') {
                xattr = 'cx';
                yattr = 'cy';
            } else {
                xattr = 'x';
                yattr = 'y';
            }
            var curx = this.attr(xattr);
            var cury = this.attr(yattr);
            var newx, newy;
            newx = Raphael.snapTo(playbook.options.gridSize, curx, 10);
            newy = Raphael.snapTo(playbook.options.gridSize, cury, 10);
            // animate the circle to the new positions
            var animObj = {};
            animObj[xattr] = newx;
            animObj[yattr] = newy;
            this.animate(
                animObj,
                100
            );
            // if the element has a route path, move its starting coords
            var route = this.data('route');
            if (route && route.type && route.type == 'path') {
                route.movePathStart(newx, newy);
            }

            return this;
        };
    };

    /**
     * Extends Raphael elements with a 'pathdrag' method, which adds the
     * ability to drag path points.
     *
     * @param {Object} Raphael
     * @param {Object} playbook The Playbook instance.
     * @returns {Object} The element.
     */
    function RaphaelPathDrag(Raphael, playbook) {
        Raphael.el.pathdrag = function() {

            var segmentToMove, side, origx, origy;

            // the drag callbacks
            var startCallBack = function(x, y) {
                origx = x;
                origy = y;
                var curPath = this.attr('path');
                side = this.data('side');

                if (side == 'offense' && playbook.mode == 'design') {
                    // by setting the segment to move to the number of segments, a new one will be created by the drag move callback
                    segmentToMove = curPath.length;
                }
                if (playbook.mode == 'move') {
                    // figure out which L point to change based on position of the drag start
                    segmentToMove = curPath.length - 1;
                    var bestScore = 10000;
                    for (var i = 1; i < curPath.length; i++) {
                        if (curPath[i].length == 3) {
                            // determine the 'score' of this iteration compared to the x,y of the drag start. The smaller the number the better.
                            var xscore = x - curPath[i][1];;
                            var yscore = y - curPath[i][2];
                            xscore = (xscore < 0) ? xscore * -1 : xscore;
                            yscore = (yscore < 0) ? yscore * -1 : yscore;
                            var score = xscore + yscore;

                            // if the score is less than or equal to the best score, record it and change the segment to move to this iteration
                            if (score <= bestScore) {
                                bestScore = score;
                                segmentToMove = i;
                            }
                        }
                    }
                }

                if (side == 'defense' && playbook.mode == 'design') {
                    // kill the current zone rect on drag start
                    var zone = this.data('zone');
                    if (zone && zone.type == 'rect') {
                        zone.remove();
                    }
                    // create a new zone rect
                    var zx, zy;
                    zx = curPath[curPath.length - 1][1];
                    zy = curPath[curPath.length - 1][2];
                    this.data('zone', PlaybookBuildZone(playbook, zx, zy, 0, 0, side));
                }
            };

            var moveCallBack = function(dx, dy, x, y) {
                var curPath = this.attr('path');
                if (side == 'offense' || playbook.mode == 'move') {
                    // get the current path and determine which point to modify based on the value determined on drag start
                    if (segmentToMove && segmentToMove > 0) {
                        curPath[segmentToMove] = ['L', origx + dx, origy + dy];
                        this.attr('path', curPath);
                    }
                }
                if (side == 'defense') {
                    // modify the zone rect with the drag
                    var zone = this.data('zone');
                    if (zone && zone.type == 'rect') {
                        // recalculate its size based on the relative drag distance
                        dx = dx > 0 ? dx : dx * -1;
                        dy = dy > 0 ? dy : dy * -1;
                        // determine the centre of the zone
                        var cenx = curPath[curPath.length - 1][1];
                        var ceny = curPath[curPath.length - 1][2];

                        zone.attr('height', dy);
                        zone.attr('width', dx);
                        zone.attr('x', cenx - (dx/2));
                        zone.attr('y', ceny - (dy/1.1));
                    }
                }
            };

            // set the drag event callbacks
            this.drag(
                moveCallBack,
                startCallBack
            );

            return this;
        };
    };

    /**
     * Extends Raphael elements with a 'createRoute' method, which starts
     * the creation of a path element for the purpose of a player route.
     *
     * @param {Object} Raphael
     * @param {Object} playbook The Playbook instance.
     * @returns {Object} The element.
     */
    function RaphaelCreateRoute(Raphael, playbook) {
        Raphael.el.createRoute = function(x, y) {
            var el = this;
            var curRoute = el.data('route');
            var side = el.data('side');
            if (curRoute && curRoute.type && curRoute.type == 'path') {
                curRoute.removeAll();
            }
            var xattr, yattr, fill;
            var fill = el.attr('fill');
            if (el.type && el.type == 'circle') {
                xattr = 'cx';
                yattr = 'cy';
            } else {
                xattr = 'x';
                yattr = 'y';
            }
            var curx = el.attr(xattr);
            var cury = el.attr(yattr);
            // the path
            var route = PlaybookBuildRoute(playbook, 'M' + curx + ',' + cury, fill, side);
            el.data('route', route);
            playbook.playersToFront();

            return this;
        }
    };

    /**
     * Extends Raphael elements with a 'pathFirstSegment' method, which
     * creates an initial segment for a path element.
     *
     * @param {Object} Raphael
     * @returns {Object} The element.
     */
    function RaphaelPathFirstSegment(Raphael) {
        Raphael.el.pathFirstSegment = function(x, y) {
            var path = this.data('route');
            if (path) {
                var curPath = path.attr('path');
                var newPath = curPath.slice(0, 1);
                newPath.push(['L', x, y]);
                path.attr('path', newPath);
            }

            return this;
        };
    };

    /**
     * Extends Raphael elements with a 'movePathStart' method, which
     * moves the starting point of a path element.
     *
     * @param {Object} Raphael
     * @returns {Object} The element.
     */
    function RaphaelMovePathStart(Raphael) {
        Raphael.el.movePathStart = function(x, y) {
            var pathEl = this;
            if (pathEl && pathEl.type == 'path') {
                var curPath = pathEl.attr('path');
                if (curPath) {
                    var newPath = curPath.slice(1);
                    newPath.unshift(['M', x, y]);
                    pathEl.attr('path', newPath);
                }
            }

            return this;
        };
    };

    // the exported object
    function playbook(options){
        return new Playbook(options);
    };
    exports.playbook = playbook;
    return playbook;
}));

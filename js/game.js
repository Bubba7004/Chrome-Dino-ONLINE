// Function Fix for "requestAnimationFrame" 12.06.17
(function() {
var lastTime = 0;
var vendors = ['ms', 'moz', 'webkit', 'o'];
for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
|| window[vendors[x]+'CancelRequestAnimationFrame'];
}
if (!window.requestAnimationFrame)
window.requestAnimationFrame = function(callback, element) {
var currTime = new Date().getTime();
var timeToCall = Math.max(0, 16 - (currTime - lastTime));
var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
timeToCall);
lastTime = currTime + timeToCall;
return id;
};
if (!window.cancelAnimationFrame)
window.cancelAnimationFrame = function(id) {
clearTimeout(id);
};
}());

var isEmbed = (typeof window !== 'undefined' && (window.isEmbed === true || (window.location && window.location.pathname && window.location.pathname.indexOf('/embed') !== -1)));

(function() {
    'use strict';

    var currentScore = 0;

    // Fix for AudioContext 12.06.17
	var AudioContext = window.AudioContext // Default
	    || window.webkitAudioContext // Safari and old versions of Chrome
	    || false;

    function Runner(outerContainerId, opt_config) {
        if (Runner.instance_) {
            return Runner.instance_
        }
        Runner.instance_ = this;
        this.containerEl = null;
        this.snackbarEl = null;
        this.config = opt_config || Runner.config;
        this.dimensions = Runner.defaultDimensions;
        this.canvas = null;
        this.canvasCtx = null;
        this.tRex = null;
        this.distanceMeter = null;
        this.distanceRan = 0;
        this.moveDir = 0;
        this.holdL = false;
        this.holdR = false;
        this.lastHold = 1;
        this.crashObstacle = null;
        this.highestScore = 0;
        this.time = 0;
        this.runningTime = 0;
        this.msPerFrame = 1000 / FPS;
        this.currentSpeed = this.config.SPEED;
        this.obstacles = [];
        this.started = false;
        this.activated = false;
        this.crashed = false;
        this.paused = false;
        this.resizeTimerId_ = null;
        this.playCount = 0;
        this.audioBuffer = null;
        this.soundFx = {};
        this.audioContext = null;
        this.images = {};
        this.imagesLoaded = 0;
        this.gamepadPreviousKeyDown = false;
        this.soundEnabled = (window.globalSoundEnabled !== undefined) ? window.globalSoundEnabled : true;
        this.zoomLevels = [0.8, 1, 1.2, 1.5, 2];
        this.currentZoomIndex = 1;
        this.zoomLevel = 1;
        this.outerContainerEl = document.querySelector(outerContainerId);
        if (!this.outerContainerEl) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    this.outerContainerEl = document.querySelector(outerContainerId);
                    if (this.outerContainerEl && !this.canvas) {
                        this.loadImages();
                    }
                }.bind(this));
                return;
            } else {
                return;
            }
        }
        this.loadImages();
    }
    window['Runner'] = Runner;
    var DEFAULT_WIDTH = 600;
    var FPS = 60;
    var IS_HIDPI = window.devicePixelRatio > 1;
    var IS_IOS = window.navigator.userAgent.indexOf('CriOS') > -1 || window.navigator.userAgent == 'UIWebViewForStaticFileContent';
    var IS_MOBILE = window.navigator.userAgent.indexOf('Mobi') > -1 || IS_IOS;
    var IS_TOUCH_ENABLED = 'ontouchstart' in window;
    Runner.config = {
        ACCELERATION: 0.001,
        BG_CLOUD_SPEED: 0.2,
        BOTTOM_PAD: 10,
        CLEAR_TIME: 3000,
        CLOUD_FREQUENCY: 0.5,
        GAMEOVER_CLEAR_TIME: 750,
        GAP_COEFFICIENT: 0.6,
        GRAVITY: 0.6,
        INITIAL_JUMP_VELOCITY: 12,
        MAX_CLOUDS: 6,
        MAX_OBSTACLE_LENGTH: 3,
        MAX_OBSTACLE_DUPLICATION: 2,
        MAX_SPEED: 13,
        MIN_JUMP_HEIGHT: 35,
        MOBILE_SPEED_COEFFICIENT: 1.2,
        RESOURCE_TEMPLATE_ID: 'audio-resources',
        SPEED: 6,
        SPEED_DROP_COEFFICIENT: 3
    };
    Runner.defaultDimensions = {
        WIDTH: DEFAULT_WIDTH,
        HEIGHT: 150
    };
    Runner.classes = {
        CANVAS: 'runner-canvas',
        CONTAINER: 'runner-container',
        CRASHED: 'crashed',
        ICON: 'icon-offline',
        SNACKBAR: 'snackbar',
        SNACKBAR_SHOW: 'snackbar-show',
        TOUCH_CONTROLLER: 'controller'
    };
    Runner.spriteDefinition = {
        LDPI: {
            CACTUS_LARGE: {
                x: 332,
                y: 2
            },
            CACTUS_SMALL: {
                x: 228,
                y: 2
            },
            CLOUD: {
                x: 86,
                y: 2
            },
            HORIZON: {
                x: 2,
                y: 54
            },
            PTERODACTYL: {
                x: 134,
                y: 2
            },
            RESTART: {
                x: 2,
                y: 2
            },
            TEXT_SPRITE: {
                x: 484,
                y: 2
            },
            TREX: {
                x: 677,
                y: 2
            }
        },
        HDPI: {
            CACTUS_LARGE: {
                x: 652,
                y: 2
            },
            CACTUS_SMALL: {
                x: 446,
                y: 2
            },
            CLOUD: {
                x: 166,
                y: 2
            },
            HORIZON: {
                x: 2,
                y: 104
            },
            PTERODACTYL: {
                x: 260,
                y: 2
            },
            RESTART: {
                x: 2,
                y: 2
            },
            TEXT_SPRITE: {
                x: 954,
                y: 2
            },
            TREX: {
                x: 1338,
                y: 2
            }
        }
    };
    Runner.sounds = {
        BUTTON_PRESS: 'offline-sound-press',
        HIT: 'offline-sound-hit',
        SCORE: 'offline-sound-reached'
    };
    Runner.keycodes = {
        JUMP: {
            '38': 1,
            '32': 1
        },
        DUCK: {
            '40': 1
        },
        // platformer walking: hold left / A to walk left, hold right / D to walk right, release to stand still
        MOVE: {
            '37': -1, '65': -1,
            '39': 1, '68': 1
        },
        RESTART: {
            '13': 1
        }
    };
    Runner.events = {
        ANIM_END: 'webkitAnimationEnd',
        CLICK: 'click',
        KEYDOWN: 'keydown',
        KEYUP: 'keyup',
        MOUSEDOWN: 'mousedown',
        MOUSEUP: 'mouseup',
        RESIZE: 'resize',
        TOUCHEND: 'touchend',
        TOUCHSTART: 'touchstart',
        VISIBILITY: 'visibilitychange',
        BLUR: 'blur',
        FOCUS: 'focus',
        LOAD: 'load',
        GAMEPADCONNECTED: 'gamepadconnected'
    };
    // ---- Game modes -------------------------------------------------------
    // Options: speed, maxSpeed, accel, gravity, jump, types (obstacle whitelist),
    // gapCoef, noCollision, doubleJump, chaos, roulette, ghost, blackout, disco,
    // filter / transform / bg (visual tweaks).
    Runner.modes = {
        classic:  { name: 'Classic', desc: 'The original experience.' },
        zen:      { name: 'Zen', desc: 'No collisions. Just run and relax.', noCollision: true },
        hardcore: { name: 'Hardcore', desc: 'Starts fast and gets faster. Good luck.', speed: 9, accel: 0.003, maxSpeed: 20 },
        chill:    { name: 'Chill', desc: 'Slow and gentle. Speed barely increases.', speed: 4, accel: 0.0002, maxSpeed: 7 },
        marathon: { name: 'Marathon', desc: 'Constant medium speed, no acceleration.', speed: 7, accel: 0, maxSpeed: 7 },
        roulette: { name: 'Speed Roulette', desc: 'Your speed randomly changes every few seconds.', speed: 7, accel: 0, maxSpeed: 13, roulette: true },
        moon:     { name: 'Moon Gravity', desc: 'Low gravity. Floaty, long jumps.', gravity: 0.3, jump: 7 },
        heavy:    { name: 'Heavy Gravity', desc: 'High gravity. Quick, snappy jumps.', gravity: 1.1, jump: 13.5 },
        chaos:    { name: 'Gravity Chaos', desc: 'Gravity is random on every jump.', chaos: true },
        doublejump: { name: 'Double Jump', desc: 'Press jump again in mid-air for a second jump.', doubleJump: true },
        ptero:    { name: 'Pterodactyl Storm', desc: 'Only pterodactyls, and lots of them.', types: ['PTERODACTYL'], noDupCheck: true, ignoreMinSpeed: true, gapCoef: 0.4 },
        cactus:   { name: 'Cactus Field', desc: 'Only cacti, packed close together.', types: ['CACTUS_SMALL', 'CACTUS_LARGE'], noDupCheck: true, gapCoef: 0.35 },
        ghost:    { name: 'Ghost Obstacles', desc: 'Obstacles flicker in and out of sight.', ghost: true },
        blackout: { name: 'Blackout', desc: 'Obstacles only appear when they are close.', blackout: true },
        night:    { name: 'Night Run', desc: 'Dark theme, inverted colors.', filter: 'invert(1)', bg: '#202124', stage: '#161616' },
        mirror:   { name: 'Mirror', desc: 'The whole game is flipped horizontally.', transform: 'scaleX(-1)' },
        flip:     { name: 'Upside Down', desc: 'The whole game is flipped vertically.', transform: 'scaleY(-1)' },
        disco:    { name: 'Disco', desc: 'Constantly shifting colors.', disco: true },
        // ---- more modes ----
        turbo:    { name: 'Turbo', desc: 'Starts at full tilt and keeps accelerating.', speed: 11, accel: 0.002, maxSpeed: 18 },
        crawl:    { name: 'Crawl', desc: 'Painfully slow. Obstacles are packed in to compensate.', speed: 3, accel: 0.0001, maxSpeed: 4.5, gapCoef: 0.7 },
        stumpy:   { name: 'Stumpy Hops', desc: 'Your jumps are tiny. Time everything.', gravity: 0.8, jump: 9.5 },
        tinycactus:  { name: 'Tiny Cacti', desc: 'Only small cacti, in big crowds.', types: ['CACTUS_SMALL'], noDupCheck: true, gapCoef: 0.4 },
        giantcactus: { name: 'Giant Cacti', desc: 'Only the big ones.', types: ['CACTUS_LARGE'], noDupCheck: true, gapCoef: 0.6 },
        tight:    { name: 'Tight Squeeze', desc: 'Obstacles come very close together.', gapCoef: 0.3 },
        wide:     { name: 'Wide Open', desc: 'Lots of room between obstacles. Relax.', gapCoef: 2.2 },
        opposite: { name: 'Opposite Day', desc: 'Left is right and right is left.', reverseKeys: true },
        pulse:    { name: 'Speed Pulse', desc: 'Your speed swells and fades in a steady rhythm.', speed: 7, accel: 0, maxSpeed: 10, pulse: true },
        mud:      { name: 'Mud Run', desc: 'You crawl while airborne: jumps carry you only a little way forward.', airSlow: 0.6 },
        leap:     { name: 'Long Leaps', desc: 'You fly forward fast while airborne.', airFast: 1.9 },
        pogo:     { name: 'Pogo', desc: 'You bounce non-stop. Tap jump to cut a bounce short, duck to stay low.', pogo: true },
        fog:      { name: 'Dense Fog', desc: 'You only see obstacles right before you reach them.', blackout: true, fog: true },
        cycle:    { name: 'Day & Night', desc: 'The world slowly fades between day and night.', cycle: true },
        drunk:    { name: 'Dizzy', desc: 'Everything sways, blurs and shifts colour.', drunk: true },
        noir:     { name: 'Noir', desc: 'Black and white, high contrast.', filter: 'grayscale(1) contrast(1.35)', bg: '#1b1b1b' },
        retro:    { name: 'Retro Sepia', desc: 'An old photograph of a dinosaur.', filter: 'sepia(1) contrast(1.1)', bg: '#2b2112', stage: '#eadbb4' },
        lava:     { name: 'Lava', desc: 'The whole world is on fire.', filter: 'sepia(1) saturate(5) hue-rotate(-35deg)', bg: '#2a0a00', stage: '#ffe2cc' },
        matrix:   { name: 'Matrix', desc: 'Green rain on a black screen.', filter: 'invert(1) sepia(1) saturate(6) hue-rotate(70deg)', bg: '#031403', stage: '#020a02' },
        jitter:   { name: 'Jitter', desc: 'Your speed changes every second or so.', speed: 7, accel: 0, maxSpeed: 12, roulette: true, rouletteMs: [250, 800] },
        tide:     { name: 'Tidal Gravity', desc: 'Gravity swells and fades while you run.', tide: true }
    };
    Runner.pulseSpeed = function(tk) { return 5 + 5 * (0.5 + 0.5 * Math.sin(tk / 110)) };
    Runner.tideGravity = function(tk) { return 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(tk / 150)) };
    Runner.prototype = {
        // game ticks: the fixed step counter online, elapsed 60ths of a second otherwise
        tick: function() { return this.online ? (this.stepCount | 0) : Math.round((this.runningTime || 0) / this.msPerFrame) },
        // modes like Mud Run / Long Leaps change how fast you move forward while airborne
        speedMul: function() {
            var mc = this.modeCfg || {};
            if (this.tRex && this.tRex.jumping) { if (mc.airSlow) return mc.airSlow; if (mc.airFast) return mc.airFast }
            return 1
        },
        rouletteDelay: function(mc) {
            var r = this.modeRng ? this.modeRng() : Math.random(), a = mc.rouletteMs || [2500, 6000];
            return a[0] + r * (a[1] - a[0])
        },
        // ---- Online API ----
        // Every client must run the *same* course, so online the whole simulation is deterministic:
        // seeded random numbers, a fixed 60 steps/second, a fixed 600px world width and fixed speeds.
        startOnline: function(seed, mode, x) {
            this.online = true; this.suspended = false; this.spectating = false;
            Runner.rng = Runner.makeRng(seed);
            this.modeRng = Runner.makeRng((seed ^ 0x5bd1e995) >>> 0);
            this.setMode(mode || 'classic');
            Runner.rng = Runner.makeRng(seed);
            this.modeRng = Runner.makeRng((seed ^ 0x5bd1e995) >>> 0);
            this.horizon.reset(); this.horizon.obstacleHistory = [];
            this.crashObstacle = null; this.tRex.facing = 1; this.tRex.idle = false;
            this.tRex.reset(); this.distanceMeter.reset(0);
            this.crashed = false; this.distanceRan = 0; this.runningTime = 0; this.started = true; this.activated = true; this.paused = false;
            this.stepAcc = 0; this.stepCount = 0; this.stun = 0; this.shield = 0; this.reverse = false; this.revEnd = 0; this.pushQ = 0; this.pushMax = 12; if (this.tRex) this.tRex.hidden = false; this.rouletteTimer = 0; this.spectateW = null;
            this.playingIntro = false; this.tRex.playingIntro = false; this.tRex.xPos = x || this.tRex.config.START_X_POS;
            this.containerEl.classList.remove(Runner.classes.CRASHED);
            this.loadSounds(); this.startGame(); this.updateMove();
            this.currentSpeed = this.config.SPEED; // no phone-width speed scaling: everyone runs at the same speed
            this.time = getTimeStamp();
            if (!this.raqId) this.update();
        },
        stopOnline: function() {
            this.online = false; Runner.rng = null; this.modeRng = null;
            if (this.spectating) {
                this.spectating = false; cancelAnimationFrame(this.raqId); this.raqId = 0; this.drawPending = false
            } else if (this.activated && !this.crashed) this.stop();
        },
        // pause input + the game while a menu is open
        suspend: function() {
            this.suspended = true; this.releaseMoves();
            if (!this.online && this.activated && !this.crashed) { this.stop(); this.pausedBySuspend = true }
        },
        resume: function() {
            this.suspended = false; this.updateMove();
            if (this.pausedBySuspend) { this.pausedBySuspend = false; this.tRex.reset(); this.play() }
        },
        getScore: function() { return Math.floor(this.distanceRan * 0.025) },
        // Walking is platformer-style: nothing held = stand still, right held = walk right, left held = walk left.
        // The score is your position on the course, so it goes up / down / stays put with you.
        // side: -1 = left control, 1 = right control (as seen on screen); down: pressed or released
        holdMove: function(side, down) {
            if (side < 0) this.holdL = !!down; else this.holdR = !!down;
            if (down) this.lastHold = side < 0 ? -1 : 1;
            this.updateMove();
        },
        releaseMoves: function() {
            this.holdL = false; this.holdR = false; this.updateMove();
        },
        updateMove: function() {
            var sd = (this.holdL && this.holdR) ? (this.lastHold || 1) : (this.holdR ? 1 : (this.holdL ? -1 : 0));
            var d = this.moveKeyToDir(sd); if ((this.reverse ? 1 : 0) ^ ((this.modeCfg && this.modeCfg.reverseKeys) ? 1 : 0)) d = -d;
            this.moveDir = (this.crashed || this.suspended) ? 0 : d;
            if (this.moveDir && this.tRex) this.tRex.facing = this.moveDir;
        },
        // Mirror mode runs the world the other way round, so left/right keys flip with it
        moveKeyToDir: function(v) {
            var tf = (this.modeCfg && this.modeCfg.transform) || '';
            return (v !== 0 && tf.indexOf('scaleX(-1)') > -1) ? -v : v;
        },
        // How fast the course ramps up, as a pure function of position, so obstacles are the same for everyone
        nominalSpeed: function(x) {
            var b = this.config.SPEED, a = this.config.ACCELERATION, m = this.config.MAX_SPEED;
            if (!(a > 0) || x <= 0) return Math.min(b, m);
            var f = (-b + Math.sqrt(b * b + 2 * a * x)) / a;
            return Math.min(m, b + a * f);
        },
        isDisabled: function() {
            return loadTimeData && loadTimeData.valueExists('disabledEasterEgg')
        },
        setupDisabledRunner: function() {
            this.containerEl = document.createElement('div');
            this.containerEl.className = Runner.classes.SNACKBAR;
            this.containerEl.textContent = loadTimeData.getValue('disabledEasterEgg');
            this.outerContainerEl.appendChild(this.containerEl);
            document.addEventListener(Runner.events.KEYDOWN, function(e) {
                if (Runner.keycodes.JUMP[e.keyCode]) {
                    this.containerEl.classList.add(Runner.classes.SNACKBAR_SHOW);
                    document.querySelector('.icon').classList.add('icon-disabled')
                }
            }.bind(this))
        },
        updateConfigSetting: function(setting, value) {
            if (setting in this.config && value != undefined) {
                this.config[setting] = value;
                switch (setting) {
                    case 'GRAVITY':
                    case 'MIN_JUMP_HEIGHT':
                    case 'SPEED_DROP_COEFFICIENT':
                        this.tRex.config[setting] = value;
                        break;
                    case 'INITIAL_JUMP_VELOCITY':
                        this.tRex.setJumpVelocity(value);
                        break;
                    case 'SPEED':
                        this.setSpeed(value);
                        break
                }
            }
        },
        loadImages: function() {
            if (IS_HIDPI) {
                Runner.imageSprite = document.getElementById('offline-resources-2x');
                this.spriteDef = Runner.spriteDefinition.HDPI
            } else {
                Runner.imageSprite = document.getElementById('offline-resources-1x');
                this.spriteDef = Runner.spriteDefinition.LDPI
            }
            this.init()
        },
        loadSounds: function() {
            if (this.audioContext) return;
            if (!IS_IOS && AudioContext) { // Fix 12.06.17
                this.audioContext = new AudioContext();
                var resourceTemplate = document.getElementById(this.config.RESOURCE_TEMPLATE_ID).content;
                for (var sound in Runner.sounds) {
                    var soundSrc = resourceTemplate.getElementById(Runner.sounds[sound]).src;
                    soundSrc = soundSrc.substr(soundSrc.indexOf(',') + 1);
                    var buffer = decodeBase64ToArrayBuffer(soundSrc);
                    this.audioContext.decodeAudioData(buffer, function(index, audioData) {
                        this.soundFx[index] = audioData
                    }.bind(this, sound))
                }
            }
        },
        setMode: function(id, initial) {
            var mode = Runner.modes[id] ? id : 'classic';
            var m = Runner.modes[mode];
            if (!Runner.baseCfg) {
                Runner.baseCfg = {
                    SPEED: Runner.config.SPEED,
                    MAX_SPEED: Runner.config.MAX_SPEED,
                    ACCELERATION: Runner.config.ACCELERATION,
                    GAP: Runner.config.GAP_COEFFICIENT,
                    GRAVITY: Trex.config.GRAVITY,
                    JUMP: Trex.config.INIITAL_JUMP_VELOCITY,
                    DROP: Trex.config.DROP_VELOCITY
                };
            }
            var base = Runner.baseCfg;
            this.mode = mode;
            this.modeCfg = m;
            this.rouletteTimer = 0;
            this.config.SPEED = m.speed != null ? m.speed : base.SPEED;
            this.config.MAX_SPEED = m.maxSpeed != null ? m.maxSpeed : base.MAX_SPEED;
            this.config.ACCELERATION = m.accel != null ? m.accel : base.ACCELERATION;
            Trex.config.GRAVITY = m.gravity != null ? m.gravity : base.GRAVITY;
            if (m.jump != null) {
                Trex.config.INIITAL_JUMP_VELOCITY = -m.jump;
                Trex.config.DROP_VELOCITY = -m.jump / 2;
            } else {
                Trex.config.INIITAL_JUMP_VELOCITY = base.JUMP;
                Trex.config.DROP_VELOCITY = base.DROP;
            }
            this.currentSpeed = this.config.SPEED;
            if (this.horizon) {
                this.horizon.gapCoefficient = m.gapCoef != null ? m.gapCoef : base.GAP;
            }
            if (this.canvas) {
                this.canvas.style.filter = m.filter || '';
                this.canvas.style.transform = m.transform || '';
            }
            document.documentElement.style.setProperty('--stagebg', m.stage || '#f7f7f7');
            document.documentElement.style.background = m.bg || '';
            document.body.style.background = m.bg || '';
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'modeChanged', mode: mode, name: m.name }, '*');
            }
            if (initial) {
                return;
            }
            // Return to the idle "press space to start" state with a fresh run
            if (this.raqId) {
                cancelAnimationFrame(this.raqId);
                this.raqId = 0;
            }
            this.drawPending = false;
            this.crashed = false;
            this.activated = false;
            this.started = false;
            this.paused = false;
            this.playingIntro = false;
            this.tRex.playingIntro = false;
            this.distanceRan = 0;
            this.crashObstacle = null;
            this.tRex.facing = 1;
            this.highestScore = 0;
            this.distanceMeter.highScore = 0;
            this.distanceMeter.acheivement = false;
            this.runningTime = 0;
            var sb = document.getElementById("shareBlock");
            if (sb) sb.style.display = 'none';
            this.containerEl.classList.remove(Runner.classes.CRASHED);
            this.horizon.reset();
            this.tRex.reset();
            this.tRex.xPos = 0;
            this.tRex.update(0, Trex.status.WAITING);
            this.clearCanvas();
            this.horizon.update(0, 0, false);
            this.tRex.draw(0, 0);
            this.time = getTimeStamp();
            this.update();
        },
        setSpeed: function(opt_speed) {
            var speed = opt_speed || this.currentSpeed;
            if (this.dimensions.WIDTH < DEFAULT_WIDTH) {
                var mobileSpeed = speed * this.dimensions.WIDTH / DEFAULT_WIDTH * this.config.MOBILE_SPEED_COEFFICIENT;
                this.currentSpeed = mobileSpeed > speed ? speed : mobileSpeed
            } else if (opt_speed) {
                this.currentSpeed = opt_speed
            }
        },
        init: function() {
            DEFAULT_WIDTH = Runner.FIXED_WIDTH || this.outerContainerEl.clientWidth;
            this.dimensions.WIDTH = DEFAULT_WIDTH;
            Runner.defaultDimensions.WIDTH = DEFAULT_WIDTH;
            this.adjustDimensions();
            this.setSpeed();
            this.containerEl = document.createElement('div');
            this.containerEl.className = Runner.classes.CONTAINER;
            this.containerEl.style.width = this.dimensions.WIDTH + 'px';
            this.containerEl.style.height = this.dimensions.HEIGHT + 'px';
            this.canvas = createCanvas(this.containerEl, this.dimensions.WIDTH, this.dimensions.HEIGHT, Runner.classes.PLAYER);
            this.canvasCtx = this.canvas.getContext('2d');
            this.canvasCtx.fillStyle = '#f7f7f7';
            this.canvasCtx.fill();
            Runner.updateCanvasScaling(this.canvas);
            this.horizon = new Horizon(this.canvas, this.spriteDef, this.dimensions, this.config.GAP_COEFFICIENT, DEFAULT_WIDTH);
            this.distanceMeter = new DistanceMeter(this.canvas, this.spriteDef.TEXT_SPRITE, this.dimensions.WIDTH);
            this.tRex = new Trex(this.canvas, this.spriteDef.TREX);
            this.outerContainerEl.appendChild(this.containerEl);
            if (IS_MOBILE) {
                this.createTouchController()
            }
            var urlMode = '';
            try {
                urlMode = new URLSearchParams(window.location.search).get('mode') || '';
            } catch (err) {}
            this.setMode(urlMode, true);
            this.startListening();
            this.update();
            window.addEventListener(Runner.events.RESIZE, this.debounceResize.bind(this))
        },
        createTouchController: function() {
            this.touchController = document.createElement('div');
            this.touchController.className = Runner.classes.TOUCH_CONTROLLER
        },
        debounceResize: function() {
            if (!this.resizeTimerId_) {
                this.resizeTimerId_ = setInterval(this.adjustDimensions.bind(this), 250)
            }
        },
        adjustDimensions: function() {
            clearInterval(this.resizeTimerId_);
            this.resizeTimerId_ = null;
            if (!this.outerContainerEl) {
                return;
            }
            var boxStyles = window.getComputedStyle(this.outerContainerEl);
            var padding = Number(boxStyles.paddingLeft.substr(0, boxStyles.paddingLeft.length - 2));
            var baseWidth = Runner.FIXED_WIDTH || (this.outerContainerEl.offsetWidth - padding * 2);
            var level = this.zoomLevel || 1;
            this.dimensions.WIDTH = Math.floor(baseWidth / level);
            if (this.outerContainerEl) {
                if (level === 1) {
                    this.outerContainerEl.style.height = '';
                } else {
                    this.outerContainerEl.style.height = Math.round(this.dimensions.HEIGHT * level) + 'px';
                }
            }
            if (this.containerEl) {
                this.containerEl.style.maxWidth = 'none';
                var newMargin = (baseWidth - this.dimensions.WIDTH) / 2;
                this.containerEl.style.width = this.dimensions.WIDTH + 'px';
                this.containerEl.style.height = this.dimensions.HEIGHT + 'px';
                if (level === 1) {
                    this.containerEl.style.transform = '';
                    this.containerEl.style.transformOrigin = '';
                    this.containerEl.style.marginLeft = '0px';
                } else {
                    this.containerEl.style.transform = 'scale(' + level + ')';
                    this.containerEl.style.transformOrigin = 'center top 0px';
                    this.containerEl.style.marginLeft = newMargin + 'px';
                }
            }
            if (this.canvas) {
                this.canvas.style.maxWidth = 'none';
                this.canvas.width = this.dimensions.WIDTH;
                this.canvas.height = this.dimensions.HEIGHT;
                Runner.updateCanvasScaling(this.canvas);
                if (this.distanceMeter) {
                    this.distanceMeter.calcXPos(this.dimensions.WIDTH);
                }
                if (this.horizon) {
                    this.horizon.updateDimensions(this.dimensions.WIDTH);
                }
                if (this.crashed || this.paused) {
                    this.clearCanvas();
                    this.horizon.update(0, 0, true);
                    this.tRex.update(0);
                    this.distanceMeter.update(0, Math.ceil(this.distanceRan));
                    this.stop()
                } else if (!this.activated) {
                    this.clearCanvas();
                    this.horizon.update(0, 0, true);
                    this.tRex.update(0);
                    this.tRex.draw(0, 0)
                }
                if (this.crashed && this.gameOverPanel) {
                    this.gameOverPanel.updateDimensions(this.dimensions.WIDTH);
                    this.gameOverPanel.draw()
                }
            }
        },
        setZoomIndex: function(index) {
            if (typeof index !== 'number' || index < 0 || index >= this.zoomLevels.length) {
                index = 1;
            }
            this.currentZoomIndex = index;
            this.zoomLevel = this.zoomLevels[index];
            this.adjustDimensions();
            return this.getZoom();
        },
        setZoomLevel: function(level) {
            var idx = this.zoomLevels.indexOf(level);
            if (idx === -1) {
                idx = 1;
            }
            return this.setZoomIndex(idx);
        },
        toggleZoom: function() {
            var nextIndex = (this.currentZoomIndex + 1) % this.zoomLevels.length;
            return this.setZoomIndex(nextIndex);
        },
        getZoom: function() {
            return {
                index: this.currentZoomIndex,
                level: this.zoomLevel,
                text: (this.zoomLevel === 1 ? '1' : this.zoomLevel) + 'x'
            };
        },
        playIntro: function() {
            if (!this.started && !this.crashed) {
                this.playingIntro = true;
                this.tRex.playingIntro = true;
                this.containerEl.style.width = this.dimensions.WIDTH + 'px';
                this.containerEl.style.height = this.dimensions.HEIGHT + 'px';
                if (this.touchController) {
                    this.outerContainerEl.appendChild(this.touchController)
                }
                this.activated = true;
                this.started = true;
            } else if (this.crashed) {
                this.restart()
            }
        },
        startGame: function() {
            this.runningTime = 0;
            this.playingIntro = false;
            this.tRex.playingIntro = false;
            this.containerEl.style.animation = '';
            this.playCount++;
            this.telemetry = {
                startTime: Date.now(),
                jumps: 0,
                ducks: 0,
                obstaclesPassed: 0,
                maxSpeed: this.config.SPEED,
                nightReached: false,
                attemptIndex: this.playCount || 1,
                inputMethod: 'keyboard'
            };
            if (window.DinoTracker) {
                window.DinoTracker.trackEvent('game_start', {
                    attempt_index: this.telemetry.attemptIndex
                });
            }
            if (!this.visBound) {
                this.visBound = true;
                document.addEventListener(Runner.events.VISIBILITY, this.onVisibilityChange.bind(this));
                window.addEventListener(Runner.events.BLUR, this.onVisibilityChange.bind(this));
                window.addEventListener(Runner.events.FOCUS, this.onVisibilityChange.bind(this))
            }
        },
        clearCanvas: function() {
            this.canvasCtx.clearRect(0, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT)
        },
        update: function() {
            this.drawPending = false;
            var now = getTimeStamp();
            var deltaTime = now - (this.time || now);
            this.time = now;
            if (this.online) {
                // fixed timestep: identical physics on 60Hz, 144Hz and slow devices
                this.stepAcc = Math.min((this.stepAcc || 0) + deltaTime, 100);
                while (this.stepAcc >= this.msPerFrame) {
                    this.stepAcc -= this.msPerFrame;
                    if (this.crashed) {
                        if (!this.spectating) break;
                        this.spectateStep(this.msPerFrame)
                    } else {
                        this.stepCount = (this.stepCount || 0) + 1;
                        this.runStep(this.msPerFrame)
                    }
                }
                if (!this.crashed || this.spectating) this.raq();
                return
            }
            this.runStep(deltaTime)
        },
        // after crashing in an online race the world keeps scrolling (same seeded course) so you can watch the others
        spectateStep: function(dt) {
            this.stepCount = (this.stepCount || 0) + 1;
            this.clearCanvas();
            var mc = this.modeCfg || {};
            if (mc.roulette) {
                this.rouletteTimer = (this.rouletteTimer || 0) - dt;
                if (this.rouletteTimer <= 0) {
                    this.currentSpeed = 5 + (this.modeRng ? this.modeRng() : Math.random()) * 8;
                    this.rouletteTimer = this.rouletteDelay(mc);
                }
            }
            if (this.spectateW != null) {
                // the page tells us where the camera should be (the player being watched); glide there
                var gap = this.spectateW - this.horizon.shift;
                var step = Math.abs(gap) > 500 ? gap : Math.round(gap * 0.3);
                if (step === 0 && gap !== 0) step = gap > 0 ? 1 : -1;
                this.horizon.follow(dt, step);
            } else {
                this.horizon.update(dt, this.currentSpeed, true);   // nobody to watch: keep scrolling forward
            }
            if (this.currentSpeed < this.config.MAX_SPEED) this.currentSpeed += this.config.ACCELERATION;
            // the crashed dino itself is drawn by the page's overlay (it flies off like jelly), so nothing to draw here
            this.distanceMeter.update(0, Math.ceil(this.distanceRan))
        },
        runStep: function(deltaTime) {
            if (this.activated) {
                this.clearCanvas();
                if (this.autopilot && this.started && !this.playingIntro && !this.crashed && !this.suspended) this.botThink(deltaTime);
                var m0 = this.modeCfg || {}, tk0 = this.tick();
                if (this.started && !this.playingIntro) {
                    if (m0.tide) this.tRex.config.GRAVITY = Runner.tideGravity(tk0);
                    if (m0.pulse) this.currentSpeed = Runner.pulseSpeed(tk0);
                    if (m0.pogo && !this.tRex.jumping && !this.tRex.ducking && !(this.stun > 0)) this.tRex.startJump(this.currentSpeed);
                }
                if (this.tRex.jumping) {
                    this.tRex.updateJump(deltaTime)
                }
                this.runningTime += deltaTime;
                // obstacles are placed by how far the world has scrolled (see Horizon), not by a timer,
                // so the first one only shows up after you have actually walked far enough
                var hasObstacles = true;
                if (this.tRex.jumpCount == 1 && !this.playingIntro && !this.started) {
                    this.playIntro()
                }
                if (this.playingIntro) {
                    this.horizon.update(0, this.currentSpeed, hasObstacles);
                    if (this.tRex.xPos >= this.tRex.config.START_X_POS) {
                        this.tRex.xPos = this.tRex.config.START_X_POS;
                        this.startGame();
                    }
                } else {
                    deltaTime = !this.started ? 0 : deltaTime;
                    var stunned = this.stun > 0; if (stunned) this.stun--;
                    if (this.reverse && (this.stepCount | 0) >= this.revEnd) { this.reverse = false; this.updateMove() }
                    this.horizon.update(deltaTime, (stunned ? 0 : this.moveDir) * this.currentSpeed * this.speedMul(), hasObstacles);
                    if (this.pushQ) {
                        // abilities: the world is shoved under you (kick = back, lego / dash = forward), a few px per step
                        var ps = Math.max(-this.pushMax, Math.min(this.pushMax, this.pushQ)), li = this.horizon.lastInc;
                        this.horizon.advance(0, ps, 0, true);
                        this.distanceRan += this.horizon.lastInc; if (this.distanceRan < 0) this.distanceRan = 0;
                        this.horizon.lastInc = li; this.pushQ -= ps;
                    }
                }
                var collision = false;
                var obsList = this.horizon.obstacles, tx = this.tRex.xPos;
                for (var oi = 0; oi < obsList.length; oi++) {
                    var ob = obsList[oi];
                    if (ob.xPos > tx + 80) break;
                    if (ob.xPos + ob.width < tx - 10) continue;
                    var hit = checkForCollision(ob, this.tRex);
                    if (hit) { collision = hit; this.crashObstacle = ob; break }
                }
                var mc = this.modeCfg || {};
                if (mc.noCollision || (this.stepCount | 0) < this.shield) {
                    collision = false;
                }
                if (mc.roulette && this.started && !this.playingIntro) {
                    this.rouletteTimer = (this.rouletteTimer || 0) - deltaTime;
                    if (this.rouletteTimer <= 0) {
                        this.currentSpeed = 5 + (this.modeRng ? this.modeRng() : Math.random()) * 8;
                        this.rouletteTimer = this.rouletteDelay(mc);
                    }
                }
                if (this.canvas && (mc.cycle || mc.drunk)) {
                    if (mc.cycle) { var ca = 0.5 + 0.5 * Math.sin(tk0 / 300), cg = Math.round(247 - 239 * ca); this.canvas.style.filter = 'invert(' + ca.toFixed(3) + ')'; document.documentElement.style.setProperty('--stagebg', 'rgb(' + cg + ',' + cg + ',' + cg + ')') }
                    else this.canvas.style.filter = 'blur(' + (0.4 + 1.1 * (0.5 + 0.5 * Math.sin(tk0 / 45))).toFixed(2) + 'px) hue-rotate(' + Math.round(40 * Math.sin(tk0 / 90)) + 'deg)';
                }
                if (mc.disco && this.canvas) {
                    this.canvas.style.filter = 'sepia(1) saturate(6) hue-rotate(' + ((Date.now() / 8) % 360) + 'deg)';
                }
                if (!collision) {
                    // forward = score up, backward = score down, stopped = no change (and no speeding up)
                    var inc = this.horizon.lastInc;
                    if (inc !== 0) {
                        var dd = this.currentSpeed * this.speedMul() * deltaTime / this.msPerFrame;
                        this.distanceRan += inc > 0 ? dd : -dd;
                    }
                    if (this.horizon.shift <= 0 || this.distanceRan < 0) this.distanceRan = 0;
                    if (inc > 0 && this.currentSpeed < this.config.MAX_SPEED) {
                        this.currentSpeed += this.config.ACCELERATION * (this.online ? Math.min(deltaTime, 50) / this.msPerFrame : 1)
                    }
                    this.tRex.idle = this.started && !this.playingIntro && inc === 0;
                    if (this.telemetry) {
                        if (this.currentSpeed > this.telemetry.maxSpeed) {
                            this.telemetry.maxSpeed = this.currentSpeed;
                        }
                        if (this.horizon && this.horizon.nightMode && this.horizon.nightMode.opacity > 0) {
                            this.telemetry.nightReached = true;
                        }
                        var po = this.horizon.obstacles;
                        while (this.horizon.passIdx < po.length && po[this.horizon.passIdx].xPos + po[this.horizon.passIdx].width < this.tRex.xPos) {
                            this.horizon.passIdx++;
                        }
                        if (this.horizon.passIdx > this.telemetry.obstaclesPassed) this.telemetry.obstaclesPassed = this.horizon.passIdx;
                    }
                } else {
                    this.gameOver()
                }
                var playAcheivementSound = this.distanceMeter.update(deltaTime, Math.ceil(this.distanceRan));
                if (playAcheivementSound) {
                    this.playSound(this.soundFx.SCORE)
                }
            }
            if (!this.crashed) {
                this.tRex.update(deltaTime);
                if (!this.online) this.raq()
            }
        },
        // ---- admin autopilot: plans by simulating the engine's own physics a couple of seconds ahead ----
        // Each frame it checks whether "just keep going and react the usual way" survives; if not it tries jump
        // variants, speed-drops, air jumps, ducking and even stopping / backing up (the world only moves when you do).
        botApply: function(a) {
            var t = this.tRex;
            if (!a) return;
            if (a.dir !== undefined) { this.moveDir = a.dir; if (a.dir) t.facing = a.dir }
            if (a.unduck) { t.speedDrop = false; t.setDuck(false) }
            if (a.jump && !t.jumping && !t.ducking) {
                try { this.playSound(this.soundFx.BUTTON_PRESS) } catch (e) {}
                t.startJump(this.currentSpeed)
            }
            if (a.air && t.jumping && !t.usedAirJump) t.airJump(this.currentSpeed);
            if (a.release && t.jumping) t.endJump();
            if (a.drop) { if (t.jumping) t.setSpeedDrop(); else if (!t.ducking) t.setDuck(true) }
        },
        botThink: function() {
            var self = this, t = this.tRex, hz = this.horizon, cfg = t.config, ac = this.config, mc = this.modeCfg || {};
            this.botInfo = this.botInfo || { frames: 0, plans: 0, panics: 0, last: '' };
            this.botInfo.frames++;
            if (mc.noCollision) { this.botApply({ dir: 1 }); return }
            var G = cfg.GRAVITY, ground = t.groundYPos, minJ = t.minJumpHeight, maxJ = cfg.MAX_JUMP_HEIGHT;
            var DROPV = cfg.DROP_VELOCITY, INITV = cfg.INIITAL_JUMP_VELOCITY, SDC = cfg.SPEED_DROP_COEFFICIENT;
            var MAXS = ac.MAX_SPEED, ACC = ac.ACCELERATION, fk = FPS / 1000, dtn = this.msPerFrame, dbl = !!mc.doubleJump;
            var tx = t.xPos, H = 100;
            // obstacles that still matter, as light proxies the collision code can read
            var list = hz.obstacles, P = [], ex0 = [], near = false, i, o;
            var reach = Math.max(this.currentSpeed, 6) * H + 120;
            for (i = 0; i < list.length; i++) {
                o = list[i];
                if (o.xPos + o.width < tx - 60) continue;
                var pr = { o: o, wl: o.wl, so: (o.typeConfig.speedOffset ? o.speedOffset : 0), width: o.width, yPos: o.yPos, size: o.size,
                           typeConfig: o.typeConfig, collisionBoxes: o.collisionBoxes, xPos: o.xPos, k: -1 };
                P.push(pr); ex0.push(o.extra || 0);
                if (o.xPos < tx + reach) near = true;
            }
            var fake = { xPos: tx, yPos: ground, ducking: false, facing: 1, config: cfg };
            // 0 = harmless, 1 = duck under it, 2 = must jump
            for (i = 0; i < P.length; i++) {
                var p = P[i];
                if (p.o._bk === undefined) {
                    var hs = false, hd = false, sv = p.xPos;
                    for (var off = -50; off <= 60 && !(hs && hd); off += 3) {
                        p.xPos = tx + off; fake.ducking = false; if (checkForCollision(p, fake)) hs = true;
                        fake.ducking = true; if (checkForCollision(p, fake)) hd = true
                    }
                    p.xPos = sv; fake.ducking = false;
                    p.o._bk = hs ? (hd ? 2 : 1) : 0
                }
                p.k = p.o._bk
            }
            if (!near || !P.length) { this.botApply({ dir: 1, unduck: t.ducking && !t.jumping }); return }
            function mk() {
                return { y: t.yPos, v: t.jumpVelocity, jmp: t.jumping, duck: t.ducking, sd: t.speedDrop, rmh: t.reachedMinHeight, ua: !!t.usedAirJump,
                         shift: hz.shift, sp: self.currentSpeed, dir: self.moveDir, face: t.facing, ex: ex0.slice(), tk: self.tick() }
            }
            function endJ(s) { if (s.rmh && s.v < DROPV) s.v = DROPV }
            // one engine step: input, jump physics, world scroll, collision, speed-up. true = crashed
            function step(s, a, dirO) {
                if (dirO !== undefined) s.dir = dirO;
                if (a) {
                    if (a.unduck) { s.sd = false; s.duck = false }
                    if (a.jump && !s.jmp && !s.duck) { s.v = INITV - s.sp / 10; s.jmp = true; s.rmh = false; s.sd = false }
                    if (a.air && s.jmp && !s.ua) { var v2 = INITV * 0.75 - s.sp / 10; if (s.v > v2) s.v = v2; s.rmh = false; s.sd = false; s.ua = true }
                    if (a.release && s.jmp) endJ(s);
                    if (a.drop) { if (s.jmp) { s.sd = true; s.v = 1 } else if (!s.duck) s.duck = true }
                }
                if (mc.pulse) s.sp = Runner.pulseSpeed(s.tk);
                var Gs = mc.tide ? Runner.tideGravity(s.tk) : G;
                s.tk++;
                if (mc.pogo && !s.jmp && !s.duck) { s.v = INITV - s.sp / 10; s.jmp = true; s.rmh = false; s.sd = false }
                if (s.jmp) {
                    s.y += Math.round(s.v * (s.sd ? SDC : 1));
                    s.v += Gs;
                    if (s.y < minJ || s.sd) s.rmh = true;
                    if (s.y < maxJ || s.sd) endJ(s);
                    if (s.y > ground) { s.y = ground; s.v = 0; s.jmp = false; s.duck = false; s.ua = false; s.sd = false }
                }
                var mag = Math.floor(Math.abs(s.dir * s.sp * (s.jmp ? (mc.airSlow || mc.airFast || 1) : 1)) * fk * dtn), inc = s.dir < 0 ? -mag : mag;
                if (s.shift + inc < 0) inc = -s.shift;
                s.shift += inc;
                if (s.dir) s.face = s.dir;
                if (inc !== 0) for (var j = 0; j < P.length; j++) if (P[j].so) s.ex[j] += (inc > 0 ? 1 : -1) * P[j].so;
                fake.yPos = s.y; fake.ducking = s.duck; fake.facing = s.face;
                for (var q = 0; q < P.length; q++) {
                    var pq = P[q], x = Math.round(pq.wl - s.shift - s.ex[q]);
                    if (x > tx + 80) break;
                    if (x + pq.width < tx - 10) continue;
                    pq.xPos = x;
                    if (checkForCollision(pq, fake)) return true
                }
                if (inc > 0 && s.sp < MAXS) s.sp += ACC;
                return false
            }
            // the "usual" reaction: duck under mid-height pterodactyls, jump so the apex is over the obstacle
            function pol(s) {
                if (s.jmp) return null;
                var wantDuck = false, go = false, apex = Math.abs(INITV - s.sp / 10) / G;
                for (var q = 0; q < P.length; q++) {
                    var pq = P[q];
                    if (pq.k === 0) continue;
                    var x = Math.round(pq.wl - s.shift - s.ex[q]);
                    if (x + pq.width < tx - 12) continue;
                    if (pq.k === 1) { if (x < tx + 59 + 2 * s.sp + 8) wantDuck = true }
                    else if (!go) {
                        var dx = x - (tx + 39);
                        if (dx > -4 && (dx + pq.width / 2 + 22) / Math.max(s.sp, 1) <= apex) go = true
                    }
                }
                if (wantDuck) return s.duck ? null : { drop: true };
                if (go) return s.duck ? { unduck: true, jump: true } : { jump: true };
                return s.duck ? { unduck: true } : null
            }
            function run(c) {
                var s = mk();
                for (var k = 0; k < H; k++) {
                    var a = c.ev[k] || pol(s), d;
                    if (c.dirs) for (var z = 0; z < c.dirs.length; z++) { var r = c.dirs[z]; if (k >= r[0] && k < r[1]) d = r[2] }
                    if (step(s, a, d === undefined ? 1 : d)) return k
                }
                return H + s.shift / 1000     // survived: the further it got, the better
            }
            var t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
            var first = { n: 'go', ev: {}, dirs: null };
            var best = first, bestK = run(first);
            if (bestK >= H && bestK >= H + (hz.shift + Math.max(self.currentSpeed, 1) * H * 0.9) / 1000) {
                this.botApply(Object.assign({ dir: 1 }, pol(mk())));
                return
            }
            this.botInfo.plans++;
            var C = [], a1, a2, a3;
            if (!t.jumping) {
                C.push({ n: 'jump', ev: { 0: { jump: true, unduck: true } } });
                [6, 10, 14].forEach(function(r) { var e = { 0: {} }; e[0] = { jump: true, unduck: true }; e[r] = { release: true }; C.push({ n: 'hop' + r, ev: e }) });
                [12, 18, 24, 30].forEach(function(r) { var e = { 0: { jump: true, unduck: true } }; e[r] = { drop: true }; C.push({ n: 'dive' + r, ev: e }) });
                [3, 6, 10].forEach(function(d) { var e = {}; e[d] = { jump: true, unduck: true }; C.push({ n: 'late' + d, ev: e }) });
                C.push({ n: 'duck', ev: { 0: { drop: true } } });
                [0, 6, 12, 20].forEach(function(a) { [6, 12, 20].forEach(function(l) { C.push({ n: 'float' + a + '/' + l, ev: { 0: { jump: true, unduck: true } }, dirs: [[a, a + l, 0]] }) }) });
                [6, 12, 24].forEach(function(l) { C.push({ n: 'wait' + l, ev: {}, dirs: [[0, l, 0]] }) });
                [8, 16].forEach(function(l) { C.push({ n: 'back' + l, ev: {}, dirs: [[0, l, -1]] }) });
                [8, 16].forEach(function(l) { C.push({ n: 'backjump' + l, ev: { 0: { jump: true, unduck: true } }, dirs: [[0, l, -1]] }) })
            } else {
                [0, 2, 4, 6, 8, 11, 14, 18, 23, 29].forEach(function(d) { var e = {}; e[d] = { drop: true }; C.push({ n: 'drop' + d, ev: e }) });
                [0, 2, 4, 7, 10].forEach(function(d) { var e = {}; e[d] = { release: true }; C.push({ n: 'rel' + d, ev: e }) });
                if (dbl && !t.usedAirJump) [0, 2, 4, 7, 10, 14, 19].forEach(function(d) { var e = {}; e[d] = { air: true }; C.push({ n: 'air' + d, ev: e }) });
                [0, 4, 8, 12].forEach(function(a) { [4, 8, 14, 22].forEach(function(l) { C.push({ n: 'hover' + a + '/' + l, ev: {}, dirs: [[a, a + l, 0]] }) }) });
                [0, 4].forEach(function(a) { [4, 8, 14].forEach(function(l) { C.push({ n: 'back' + a + '/' + l, ev: {}, dirs: [[a, a + l, -1]] }) }) });
                if (dbl && !t.usedAirJump) [0, 4, 8].forEach(function(a) { [6, 12].forEach(function(l) { var e = {}; e[a] = { air: true }; C.push({ n: 'airhover' + a, ev: e, dirs: [[a, a + l, 0]] }) }) })
            }
            for (i = 0; i < C.length; i++) {
                var kk = run(C[i]);
                if (kk > bestK + 1e-9) { bestK = kk; best = C[i] }
            }
            if (bestK < H) this.botInfo.panics++;
            if (t0) { var ms = performance.now() - t0; this.botInfo.ms = (this.botInfo.ms || 0) * 0.95 + ms * 0.05; if (ms > (this.botInfo.maxMs || 0)) this.botInfo.maxMs = ms }
            this.botInfo.last = best.n;
            var s0 = mk(), act = best.ev[0] || pol(s0), d0 = 1;
            if (best.dirs) for (var z = 0; z < best.dirs.length; z++) { var r = best.dirs[z]; if (0 >= r[0] && 0 < r[1]) d0 = r[2] }
            this.botApply(Object.assign({ dir: d0 }, act || {}))
        },
        handleEvent: function(e) {
            if (this.suspended) return;
            if (this.telemetry) {
                if (e.type === Runner.events.TOUCHSTART || e.type === Runner.events.TOUCHEND) {
                    this.telemetry.inputMethod = 'touch';
                } else if (e.type === Runner.events.MOUSEDOWN || e.type === Runner.events.MOUSEUP) {
                    this.telemetry.inputMethod = 'mouse';
                } else if (e.type === Runner.events.KEYDOWN) {
                    this.telemetry.inputMethod = 'keyboard';
                }
            }
            return (function(evtType, events) {
                switch (evtType) {
                    case events.KEYDOWN:
                    case events.TOUCHSTART:
                    case events.MOUSEDOWN:
                    case events.GAMEPADCONNECTED:
                        this.onKeyDown(e);
                        break;
                    case events.KEYUP:
                    case events.TOUCHEND:
                    case events.MOUSEUP:
                        this.onKeyUp(e);
                        break
                }
            }.bind(this))(e.type, Runner.events)
        },
        startListening: function() {
            document.addEventListener(Runner.events.KEYDOWN, this);
            document.addEventListener(Runner.events.KEYUP, this);
            if (!this.blurBound) {
                this.blurBound = true;
                // never get stuck walking because a key-up happened while the window wasn't focused
                window.addEventListener('blur', this.releaseMoves.bind(this));
            }
            if (IS_MOBILE) {
                this.touchController.addEventListener(Runner.events.TOUCHSTART, this);
                this.touchController.addEventListener(Runner.events.TOUCHEND, this);
                this.containerEl.addEventListener(Runner.events.TOUCHSTART, this)
            } else {
                document.addEventListener(Runner.events.MOUSEDOWN, this);
                document.addEventListener(Runner.events.MOUSEUP, this)
            }
            window.addEventListener(Runner.events.GAMEPADCONNECTED, this);
            window.setInterval(this.pollGamepads.bind(this), 10)
        },
        pollGamepads: function() {
            var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []); //  Fix for navigator.getGamepads() 12.06.17
            var keydown = false;
            for (var i = 0; i < gamepads.length; i++) {
                if (gamepads[i] != undefined) {
                    if (gamepads[i].buttons.filter(function(e) {
                            return e.pressed == true
                        }).length > 0) {
                        keydown = true
                    }
                }
            }
            if (keydown != this.gamepadPreviousKeyDown) {
                this.gamepadPreviousKeyDown = keydown;
                var event = new Event(keydown ? 'keydown' : 'keyup');
                event.keyCode = 32;
                event.which = event.keyCode;
                event.altKey = false;
                event.ctrlKey = true;
                event.shiftKey = false;
                event.metaKey = false;
                document.dispatchEvent(event)
            }
        },
        stopListening: function() {
            document.removeEventListener(Runner.events.KEYDOWN, this);
            document.removeEventListener(Runner.events.KEYUP, this);
            if (IS_MOBILE) {
                this.touchController.removeEventListener(Runner.events.TOUCHSTART, this);
                this.touchController.removeEventListener(Runner.events.TOUCHEND, this);
                this.containerEl.removeEventListener(Runner.events.TOUCHSTART, this)
            } else {
                document.removeEventListener(Runner.events.MOUSEDOWN, this);
                document.removeEventListener(Runner.events.MOUSEUP, this)
            }
        },
        onKeyDown: function(e) {
            if (IS_MOBILE) {
                e.preventDefault()
            }
            if (!this.crashed && !(this.stun > 0) && (Runner.keycodes.JUMP[e.keyCode] || e.type == Runner.events.TOUCHSTART || e.type == Runner.events.GAMEPADCONNECTED)) {
                if (!this.activated) {
                    this.loadSounds();
                    this.activated = true
                }
                if (!this.tRex.jumping && !this.tRex.ducking) {
                    this.playSound(this.soundFx.BUTTON_PRESS);
                    if (this.telemetry) this.telemetry.jumps++;
                    this.tRex.startJump(this.currentSpeed)
                } else if (this.modeCfg && this.modeCfg.doubleJump && this.started && this.tRex.jumping && !this.tRex.usedAirJump && !e.repeat) {
                    this.playSound(this.soundFx.BUTTON_PRESS);
                    if (this.telemetry) this.telemetry.jumps++;
                    this.tRex.airJump(this.currentSpeed)
                }
            }
            if (this.crashed && (e.type == Runner.events.TOUCHSTART || e.type == Runner.events.TOUCHEND)) {
                this.restart()
            }
            var mv = Runner.keycodes.MOVE[e.keyCode];
            if (mv !== undefined && e.type == Runner.events.KEYDOWN && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (!this.crashed) e.preventDefault();
                this.holdMove(mv, true);
            }
            if (this.activated && !this.crashed && !(this.stun > 0) && Runner.keycodes.DUCK[e.keyCode]) {
                e.preventDefault();
                if (this.tRex.jumping) {
                    this.tRex.setSpeedDrop()
                } else if (!this.tRex.jumping && !this.tRex.ducking) {
                    if (this.telemetry) this.telemetry.ducks++;
                    this.tRex.setDuck(true)
                }
            }
        },
        onKeyUp: function(e) {
            var keyCode = String(e.keyCode);
            var mvUp = Runner.keycodes.MOVE[keyCode];
            if (mvUp !== undefined) this.holdMove(mvUp, false);
            var isjumpKey = Runner.keycodes.JUMP[keyCode] || e.type == Runner.events.TOUCHEND || e.type == Runner.events.MOUSEDOWN;
            if (this.isRunning() && isjumpKey) {
                this.tRex.endJump()
            } else if (Runner.keycodes.DUCK[keyCode]) {
                this.tRex.speedDrop = false;
                this.tRex.setDuck(false)
            } else if (this.crashed) {
                var deltaTime = getTimeStamp() - this.time;
                if (Runner.keycodes.RESTART[keyCode] || this.isLeftClickOnCanvas(e) || (deltaTime >= this.config.GAMEOVER_CLEAR_TIME && Runner.keycodes.JUMP[keyCode])) {
                    this.restart()
                }
            } else if (this.paused && isjumpKey) {
                this.tRex.reset();
                this.play()
            }
        },
        isLeftClickOnCanvas: function(e) {
            return (e.button != null && e.button < 2 && e.type == Runner.events.MOUSEUP && e.target == this.canvas) ||
                   (IS_MOBILE && (e.type == Runner.events.TOUCHSTART || e.type == Runner.events.TOUCHEND));
        },
        raq: function() {
            if (!this.drawPending) {
                this.drawPending = true;
                this.raqId = requestAnimationFrame(this.update.bind(this))
            }
        },
        isRunning: function() {
            return !!this.raqId
        },
        gameOver: function() {
            this.playSound(this.soundFx.HIT);
            vibrate(200);
            this.stop();
            this.crashed = true;
            this.updateMove();
            this.distanceMeter.acheivement = false;
            var cscr = document.getElementById("currentScore");
            var finalScore = Math.floor(this.distanceRan * 0.025);
            currentScore = finalScore;
            if (this.distanceRan > this.highestScore) {
                currentScore = Math.round(Math.ceil(this.distanceRan) * 0.025);
            }
            if (cscr) cscr.innerText = currentScore;
            var sb = document.getElementById("shareBlock");
            this.tRex.update(100, Trex.status.CRASHED);

            var deathCause = 'other';
            if (this.crashObstacle) {
                var obs = this.crashObstacle;
                var obsType = obs.typeConfig ? obs.typeConfig.type : '';
                if (obsType === 'CACTUS_SMALL') deathCause = 'cactus_small';
                else if (obsType === 'CACTUS_LARGE') deathCause = 'cactus_large';
                else if (obsType === 'PTERODACTYL') {
                    deathCause = (obs.yPos < 75) ? 'ptero_high' : 'ptero_low';
                } else if (obsType) {
                    deathCause = obsType.toLowerCase();
                }
            }

            var isRecord = (this.distanceRan > this.highestScore);
            var duration = this.telemetry ? (Date.now() - this.telemetry.startTime) : 0;

            if (window.DinoTracker) {
                window.DinoTracker.trackEvent('game_over', {
                    score: currentScore,
                    duration_ms: duration,
                    jumps: this.telemetry ? this.telemetry.jumps : 0,
                    ducks: this.telemetry ? this.telemetry.ducks : 0,
                    obstacles_passed: this.telemetry ? this.telemetry.obstaclesPassed : 0,
                    max_speed: this.telemetry ? parseFloat(this.telemetry.maxSpeed.toFixed(2)) : this.currentSpeed,
                    night_reached: this.telemetry ? !!this.telemetry.nightReached : false,
                    death_cause: deathCause,
                    attempt_index: this.telemetry ? this.telemetry.attemptIndex : 1,
                    record_broken: isRecord,
                    input_method: this.telemetry ? this.telemetry.inputMethod : 'keyboard'
                });
            }
            if (!this.gameOverPanel) {
                this.gameOverPanel = new GameOverPanel(this.canvas, this.spriteDef.TEXT_SPRITE, this.spriteDef.RESTART, this.dimensions)
            } else {
                this.gameOverPanel.draw()
            }

            if (!isEmbed && !this.online && this.mode === 'classic') {
                if (currentScore > 500) {
                    if (sb) sb.style.display = 'block';

                    var pct = 50;
                    var xhrPct = new XMLHttpRequest();
                    xhrPct.open('GET', '/inc/pct.php?score=' + currentScore, false);
                    xhrPct.send();
                    if (xhrPct.status === 200 && xhrPct.responseText !== '') {
                        var parsed = parseInt(xhrPct.responseText, 10);
                        if (!isNaN(parsed)) {
                            pct = parsed;
                        }
                    }
                    var top = 100 - pct;

                    var templates = (window.I18N && Array.isArray(window.I18N.share_templates) && window.I18N.share_templates.length) ? window.I18N.share_templates : [
                        "You beat {pct}% of chromedino.com players!",
                        "You scored higher than {pct}% of players today.",
                        "Nice run — better than {pct}% of players worldwide.",
                        "You're in the top {top}% of players!",
                        "Top {top}% — great run!"
                    ];
                    var template = templates[Math.floor(Math.random() * templates.length)];
                    var shareText = template.replace(/{pct}/g, pct).replace(/{top}/g, top);

                    var shareTextEl = document.getElementById('shareBlockText');
                    if (shareTextEl) {
                        shareTextEl.textContent = shareText;
                    }
                    window.shareMessage = shareText;
                } else {
                    if (sb) sb.style.display = 'none';
                }
            }

            if (this.distanceRan > this.highestScore) {
                this.highestScore = Math.ceil(this.distanceRan);
                this.distanceMeter.setHighScore(this.highestScore);
                currentScore = Math.round(this.highestScore * 0.025);
                if (cscr) cscr.innerText = currentScore;
                if (!isEmbed && !this.online && this.mode === 'classic') {
                    var bestSpan = document.getElementById('toolbar-best-score');
                    var personalBest = bestSpan ? (Number(bestSpan.textContent) || 0) : 0;
                    if (window.personalBestScore !== undefined) {
                        personalBest = window.personalBestScore;
                    }

                    var shouldCheck = (currentScore > personalBest);

                    if (shouldCheck) {
                        var xhr = new XMLHttpRequest();
                        xhr.open('GET', '/inc/check.php?score=' + currentScore, false);
                        xhr.send();
                        if (xhr.status === 200 && xhr.responseText != '') {
                            alert(xhr.responseText);
                        }

                        var saveName = (typeof user_name !== 'undefined' && user_name !== '' && user_name !== null) ? user_name : ((typeof window.user_name !== 'undefined' && window.user_name !== '' && window.user_name !== null) ? window.user_name : (function() { var m = document.cookie.match(new RegExp('(^| )name=([^;]+)')); return m ? decodeURIComponent(m[2]) : ''; })());
                        if (!saveName || saveName === 'Login' || saveName === 'Nickname' || saveName === 'Anonym') {
                            saveName = 'Anonym';
                        }

                        var xhrSet = new XMLHttpRequest();
                        xhrSet.open('POST', '/inc/set.php', false);
                        xhrSet.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                        xhrSet.send(new URLSearchParams({
                            name: saveName,
                            score: currentScore,
                            t: duration,
                            o: this.telemetry ? this.telemetry.obstaclesPassed : 0,
                            a: this.telemetry ? this.telemetry.jumps + this.telemetry.ducks : 0,
                            n: (this.telemetry && this.telemetry.nightReached) ? 1 : 0,
                            s: this.telemetry ? parseFloat(this.telemetry.maxSpeed.toFixed(2)) : this.currentSpeed,
                            g: (typeof GAME_ID !== 'undefined') ? GAME_ID : 'dino'
                        }).toString());

                        if (typeof window.updateBestScore === 'function') {
                            window.updateBestScore(saveName);
                        }
                    }
                }
            }
            if (this.online) this.spectating = true;
            if (this.onCrash) this.onCrash(Math.floor(this.distanceRan * 0.025));
            this.time = getTimeStamp()
        },
        stop: function() {
            this.activated = false;
            this.paused = true;
            cancelAnimationFrame(this.raqId);
            this.raqId = 0
        },
        play: function() {
            if (!this.crashed) {
                this.activated = true;
                this.paused = false;
                this.tRex.update(0, Trex.status.RUNNING);
                this.time = getTimeStamp();
                this.update()
            }
        },
        restart: function() {
            if (!this.raqId && !this.online) {
                var sb = document.getElementById("shareBlock");
                if (sb) sb.style.display = 'none';
                this.playCount++;
                this.runningTime = 0;
                this.activated = true;
                this.crashed = false;
                this.distanceRan = 0;
                this.crashObstacle = null;
                this.tRex.facing = 1;
                this.updateMove();
                this.setSpeed(this.config.SPEED);
                this.time = getTimeStamp();
                this.containerEl.classList.remove(Runner.classes.CRASHED);
                this.clearCanvas();
                this.distanceMeter.reset(this.highestScore);
                this.horizon.reset();
                this.tRex.reset();
                this.tRex.xPos = this.tRex.config.START_X_POS;
                this.telemetry = {
                    startTime: Date.now(),
                    jumps: 0,
                    ducks: 0,
                    obstaclesPassed: 0,
                    maxSpeed: this.config.SPEED,
                    nightReached: false,
                    attemptIndex: this.playCount || 1,
                    inputMethod: 'keyboard'
                };
                if (window.DinoTracker) {
                    window.DinoTracker.trackEvent('game_start', {
                        attempt_index: this.telemetry.attemptIndex
                    });
                }
                this.playSound(this.soundFx.BUTTON_PRESS);
                this.update()
            }
        },
        onVisibilityChange: function(e) {
            if (this.online || this.suspended) return;
            if (document.hidden || document.webkitHidden || e.type == 'blur') {
                this.stop()
            } else if (!this.crashed) {
                this.tRex.reset();
                this.play()
            }
        },
        playSound: function(soundBuffer) {
            if (soundBuffer && (this.soundEnabled !== false)) {
                var sourceNode = this.audioContext.createBufferSource();
                sourceNode.buffer = soundBuffer;
                sourceNode.connect(this.audioContext.destination);
                sourceNode.start(0)
            }
        }
    };
    Runner.makeDinoSheet = function(color) {
        var img = Runner.imageSprite, c = document.createElement('canvas'), k = IS_HIDPI ? 2 : 1, p = Runner.instance_.spriteDef.TREX;
        c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0);
        x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.85; x.fillStyle = color;
        x.fillRect(p.x, 0, c.width - p.x, 52 * k); return c;
    };
    Runner.setDinoColor = function(color) { Runner.dinoSheet = color ? (Runner.sheets = Runner.sheets || {})[color] || (Runner.sheets[color] = Runner.makeDinoSheet(color)) : null };
    Runner.updateCanvasScaling = function(canvas, opt_width, opt_height) {
        var context = canvas.getContext('2d');
        var devicePixelRatio = Math.floor(window.devicePixelRatio) || 1;
        var backingStoreRatio = Math.floor(context.webkitBackingStorePixelRatio) || 1;
        var ratio = devicePixelRatio / backingStoreRatio;
        if (devicePixelRatio !== backingStoreRatio) {
            var oldWidth = opt_width || canvas.width;
            var oldHeight = opt_height || canvas.height;
            canvas.width = oldWidth * ratio;
            canvas.height = oldHeight * ratio;
            canvas.style.width = oldWidth + 'px';
            canvas.style.height = oldHeight + 'px';
            context.scale(ratio, ratio);
            return true
        } else if (devicePixelRatio == 1) {
            canvas.style.width = canvas.width + 'px';
            canvas.style.height = canvas.height + 'px'
        }
        return false
    };

    function seededRand() { return Runner.rng ? Runner.rng() : Math.random() }
    function getSeededNum(min, max) { return Math.floor(seededRand() * (max - min + 1)) + min }
    // online, obstacles always spawn at x=600 so the course is identical on every screen width
    // The play field is always this wide (the page scales it up or down with CSS), so everybody sees the same amount of course,
    // 250px of it behind the dino. Online obstacles spawn a bit beyond the right edge so they never pop in.
    Runner.FIXED_WIDTH = 900;
    Runner.ONLINE_WORLD_WIDTH = 1000;
    Runner.spawnWidth = function(dims) { return (Runner.instance_ && Runner.instance_.online) ? Runner.ONLINE_WORLD_WIDTH : dims.WIDTH };
    Runner.makeRng = function(seed) { var a = seed >>> 0; return function() { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } };
    function getRandomNum(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    function vibrate(duration) {
        if (IS_MOBILE && window.navigator.vibrate) {
            window.navigator.vibrate(duration)
        }
    }

    function createCanvas(container, width, height, opt_classname) {
        var canvas = document.createElement('canvas');
        canvas.className = opt_classname ? Runner.classes.CANVAS + ' ' + opt_classname : Runner.classes.CANVAS;
        canvas.width = width;
        canvas.height = height;
        container.appendChild(canvas);
        return canvas
    }

    function decodeBase64ToArrayBuffer(base64String) {
        var len = (base64String.length / 4) * 3;
        var str = atob(base64String);
        var arrayBuffer = new ArrayBuffer(len);
        var bytes = new Uint8Array(arrayBuffer);
        for (var i = 0; i < len; i++) {
            bytes[i] = str.charCodeAt(i)
        }
        return bytes.buffer
    }

    function getTimeStamp() {
        //return IS_IOS ? new Date().getTime() : performance.now()
        return new Date().getTime(); // Safari 5.17 Fix 12.06.17
    }

    function GameOverPanel(canvas, textImgPos, restartImgPos, dimensions) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.canvasDimensions = dimensions;
        this.textImgPos = textImgPos;
        this.restartImgPos = restartImgPos;
        this.draw()
    };
    GameOverPanel.dimensions = {
        TEXT_X: 0,
        TEXT_Y: 13,
        TEXT_WIDTH: 191,
        TEXT_HEIGHT: 11,
        RESTART_WIDTH: 36,
        RESTART_HEIGHT: 32
    };
    GameOverPanel.prototype = {
        updateDimensions: function(width, opt_height) {
            this.canvasDimensions.WIDTH = width;
            if (opt_height) {
                this.canvasDimensions.HEIGHT = opt_height
            }
        },
        draw: function() {
            var dimensions = GameOverPanel.dimensions;
            var centerX = this.canvasDimensions.WIDTH / 2;
            var textSourceX = dimensions.TEXT_X;
            var textSourceY = dimensions.TEXT_Y;
            var textSourceWidth = dimensions.TEXT_WIDTH;
            var textSourceHeight = dimensions.TEXT_HEIGHT;
            var textTargetX = Math.round(centerX - (dimensions.TEXT_WIDTH / 2));
            var textTargetY = Math.round((this.canvasDimensions.HEIGHT - 25) / 3);
            var textTargetWidth = dimensions.TEXT_WIDTH;
            var textTargetHeight = dimensions.TEXT_HEIGHT;
            var restartSourceWidth = dimensions.RESTART_WIDTH;
            var restartSourceHeight = dimensions.RESTART_HEIGHT;
            var restartTargetX = centerX - (dimensions.RESTART_WIDTH / 2);
            var restartTargetY = this.canvasDimensions.HEIGHT / 2;
            if (IS_HIDPI) {
                textSourceY *= 2;
                textSourceX *= 2;
                textSourceWidth *= 2;
                textSourceHeight *= 2;
                restartSourceWidth *= 2;
                restartSourceHeight *= 2
            }
            textSourceX += this.textImgPos.x;
            textSourceY += this.textImgPos.y;
            this.canvasCtx.drawImage(Runner.imageSprite, textSourceX, textSourceY, textSourceWidth, textSourceHeight, textTargetX, textTargetY, textTargetWidth, textTargetHeight);
            this.canvasCtx.drawImage(Runner.imageSprite, this.restartImgPos.x, this.restartImgPos.y, restartSourceWidth, restartSourceHeight, restartTargetX, restartTargetY, dimensions.RESTART_WIDTH, dimensions.RESTART_HEIGHT)
        }
    };

    function checkForCollision(obstacle, tRex, opt_canvasCtx) {
        var obstacleBoxXPos = Runner.defaultDimensions.WIDTH + obstacle.xPos;
        var tRexBox = new CollisionBox(tRex.xPos + 1, tRex.yPos + 1, tRex.config.WIDTH - 2, tRex.config.HEIGHT - 2);
        var obstacleBox = new CollisionBox(obstacle.xPos + 1, obstacle.yPos + 1, obstacle.typeConfig.width * obstacle.size - 2, obstacle.typeConfig.height - 2);
        if (opt_canvasCtx) {
            drawCollisionBoxes(opt_canvasCtx, tRexBox, obstacleBox)
        }
        if (boxCompare(tRexBox, obstacleBox)) {
            var collisionBoxes = obstacle.collisionBoxes;
            var tRexCollisionBoxes = tRex.ducking ? Trex.collisionBoxes.DUCKING : Trex.collisionBoxes.RUNNING;
            if (tRex.facing < 0) {
                // walking left: the dino's body is mirrored, so its hit boxes are too
                var bw = tRex.ducking ? tRex.config.WIDTH_DUCK : tRex.config.WIDTH;
                tRexCollisionBoxes = tRexCollisionBoxes.map(function(b) {
                    return new CollisionBox(bw - (b.x + b.width), b.y, b.width, b.height)
                });
            }
            for (var t = 0; t < tRexCollisionBoxes.length; t++) {
                for (var i = 0; i < collisionBoxes.length; i++) {
                    var adjTrexBox = createAdjustedCollisionBox(tRexCollisionBoxes[t], tRexBox);
                    var adjObstacleBox = createAdjustedCollisionBox(collisionBoxes[i], obstacleBox);
                    var crashed = boxCompare(adjTrexBox, adjObstacleBox);
                    if (opt_canvasCtx) {
                        drawCollisionBoxes(opt_canvasCtx, adjTrexBox, adjObstacleBox)
                    }
                    if (crashed) {
                        return [adjTrexBox, adjObstacleBox]
                    }
                }
            }
        }
        return false
    };

    function createAdjustedCollisionBox(box, adjustment) {
        return new CollisionBox(box.x + adjustment.x, box.y + adjustment.y, box.width, box.height)
    };

    function drawCollisionBoxes(canvasCtx, tRexBox, obstacleBox) {
        canvasCtx.save();
        canvasCtx.strokeStyle = '#f00';
        canvasCtx.strokeRect(tRexBox.x, tRexBox.y, tRexBox.width, tRexBox.height);
        canvasCtx.strokeStyle = '#0f0';
        canvasCtx.strokeRect(obstacleBox.x, obstacleBox.y, obstacleBox.width, obstacleBox.height);
        canvasCtx.restore()
    };

    function boxCompare(tRexBox, obstacleBox) {
        var crashed = false;
        var tRexBoxX = tRexBox.x;
        var tRexBoxY = tRexBox.y;
        var obstacleBoxX = obstacleBox.x;
        var obstacleBoxY = obstacleBox.y;
        if (tRexBox.x < obstacleBoxX + obstacleBox.width && tRexBox.x + tRexBox.width > obstacleBoxX && tRexBox.y < obstacleBox.y + obstacleBox.height && tRexBox.height + tRexBox.y > obstacleBox.y) {
            crashed = true
        }
        return crashed
    };

    function CollisionBox(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h
    };

    function Obstacle(canvasCtx, type, spriteImgPos, dimensions, gapCoefficient, speed) {
        this.canvasCtx = canvasCtx;
        this.spritePos = spriteImgPos;
        this.typeConfig = type;
        this.gapCoefficient = gapCoefficient;
        this.size = getSeededNum(1, Obstacle.MAX_OBSTACLE_LENGTH);
        this.dimensions = dimensions;
        this.remove = false;
        this.xPos = 0;
        this.yPos = 0;
        this.width = 0;
        this.collisionBoxes = [];
        this.gap = 0;
        this.speedOffset = 0;
        this.currentFrame = 0;
        this.timer = 0;
        this.init(speed)
    };
    Obstacle.MAX_GAP_COEFFICIENT = 1.5;
    Obstacle.MAX_OBSTACLE_LENGTH = 3, Obstacle.prototype = {
        init: function(speed) {
            this.cloneCollisionBoxes();
            if (this.size > 1 && this.typeConfig.multipleSpeed > speed) {
                this.size = 1
            }
            this.width = this.typeConfig.width * this.size;
            this.xPos = Runner.spawnWidth(this.dimensions) - this.width;
            if (Array.isArray(this.typeConfig.yPos)) {
                var yPosConfig = (IS_MOBILE && !(Runner.instance_ && Runner.instance_.online)) ? this.typeConfig.yPosMobile : this.typeConfig.yPos;
                this.yPos = yPosConfig[getSeededNum(0, yPosConfig.length - 1)]
            } else {
                this.yPos = this.typeConfig.yPos
            }
            this.wl = 0;     // fixed position in the world (set by Horizon when the obstacle is created)
            this.extra = 0;  // how far a flying obstacle has drifted on its own
            if (this.size > 1) {
                this.collisionBoxes[1].width = this.width - this.collisionBoxes[0].width - this.collisionBoxes[2].width;
                this.collisionBoxes[2].x = this.width - this.collisionBoxes[2].width
            }
            if (this.typeConfig.speedOffset) {
                this.speedOffset = seededRand() > 0.5 ? this.typeConfig.speedOffset : -this.typeConfig.speedOffset
            }
            this.gap = this.getGap(this.gapCoefficient, speed)
        },
        getAlpha: function() {
            var r = Runner.instance_;
            var mc = r && r.modeCfg;
            if (!mc) return 1;
            if (mc.ghost) {
                return Math.sin(Date.now() / 280) > 0.2 ? 1 : 0.06;
            }
            if (mc.blackout) {
                var d = this.xPos - 100;
                if (mc.fog) return d < 70 ? 1 : (d > 190 ? 0 : 1 - (d - 70) / 120);
                return d < 150 ? 1 : (d > 270 ? 0 : 1 - (d - 150) / 120);
            }
            return 1;
        },
        draw: function() {
            var a = this.getAlpha();
            if (a < 1) {
                this.canvasCtx.save();
                this.canvasCtx.globalAlpha = a;
                this.drawRaw();
                this.canvasCtx.restore();
            } else {
                this.drawRaw();
            }
        },
        drawRaw: function() {
            var sourceWidth = this.typeConfig.width;
            var sourceHeight = this.typeConfig.height;
            if (IS_HIDPI) {
                sourceWidth = sourceWidth * 2;
                sourceHeight = sourceHeight * 2
            }
            var sourceX = (sourceWidth * this.size) * (0.5 * (this.size - 1)) + this.spritePos.x;
            if (this.currentFrame > 0) {
                sourceX += sourceWidth * this.currentFrame
            }
            this.canvasCtx.drawImage(Runner.imageSprite, sourceX, this.spritePos.y, sourceWidth * this.size, sourceHeight, Math.round(this.xPos), this.yPos, this.typeConfig.width * this.size, this.typeConfig.height)
        },
        // Obstacles sit at a fixed world position (wl); the screen position is wl minus how far the world has
        // scrolled. Walk forward, back or stand still and they simply follow. inc = signed px moved this step.
        place: function(shift, inc, deltaTime) {
            if (this.typeConfig.speedOffset && inc !== 0) {
                this.extra += (inc > 0 ? 1 : -1) * this.speedOffset * (deltaTime / (1000 / FPS));
            }
            this.xPos = Math.round(this.wl - shift - this.extra);
            if (this.typeConfig.numFrames) {
                this.timer += deltaTime;
                if (this.timer >= this.typeConfig.frameRate) {
                    this.currentFrame = this.currentFrame == this.typeConfig.numFrames - 1 ? 0 : this.currentFrame + 1;
                    this.timer = 0
                }
            }
            if (this.xPos + this.width > 0 && this.xPos < this.dimensions.WIDTH + 20) {
                this.draw();
            }
        },
        getGap: function(gapCoefficient, speed) {
            var minGap = Math.round(this.width * speed + this.typeConfig.minGap * gapCoefficient);
            var maxGap = Math.round(minGap * Obstacle.MAX_GAP_COEFFICIENT);
            return getSeededNum(minGap, maxGap)
        },
        isVisible: function() {
            return this.xPos + this.width > 0
        },
        cloneCollisionBoxes: function() {
            var collisionBoxes = this.typeConfig.collisionBoxes;
            for (var i = collisionBoxes.length - 1; i >= 0; i--) {
                this.collisionBoxes[i] = new CollisionBox(collisionBoxes[i].x, collisionBoxes[i].y, collisionBoxes[i].width, collisionBoxes[i].height)
            }
        }
    };
    Obstacle.types = [{
        type: 'CACTUS_SMALL',
        width: 17,
        height: 35,
        yPos: Runner.defaultDimensions.HEIGHT - 55,
        multipleSpeed: 4,
        minGap: 120,
        minSpeed: 0,
        collisionBoxes: [new CollisionBox(0, 7, 5, 27), new CollisionBox(4, 0, 6, 34), new CollisionBox(10, 4, 7, 14)]
    }, {
        type: 'CACTUS_LARGE',
        width: 25,
        height: 50,
        yPos: Runner.defaultDimensions.HEIGHT - 60,
        multipleSpeed: 7,
        minGap: 120,
        minSpeed: 0,
        collisionBoxes: [new CollisionBox(0, 12, 7, 38), new CollisionBox(8, 0, 7, 49), new CollisionBox(13, 10, 10, 38)]
    }, {
        type: 'PTERODACTYL',
        width: 46,
        height: 40,
        yPos: [Runner.defaultDimensions.HEIGHT - 50, Runner.defaultDimensions.HEIGHT - 75, Runner.defaultDimensions.HEIGHT - 100],
        yPosMobile: [Runner.defaultDimensions.HEIGHT - 50, Runner.defaultDimensions.HEIGHT - 100],
        multipleSpeed: 999,
        minSpeed: 8.5,
        minGap: 150,
        collisionBoxes: [new CollisionBox(15, 15, 16, 5), new CollisionBox(18, 21, 24, 6), new CollisionBox(2, 14, 4, 3), new CollisionBox(6, 10, 4, 7), new CollisionBox(10, 8, 6, 9)],
        numFrames: 2,
        frameRate: 1000 / 6,
        speedOffset: .8
    }];

    function Trex(canvas, spritePos) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.spritePos = spritePos;
        this.xPos = 0;
        this.yPos = 0;
        this.groundYPos = 0;
        this.currentFrame = 0;
        this.currentAnimFrames = [];
        this.blinkDelay = 0;
        this.animStartTime = 0;
        this.timer = 0;
        this.msPerFrame = 1000 / FPS;
        this.config = Trex.config;
        this.status = Trex.status.WAITING;
        this.jumping = false;
        this.ducking = false;
        this.jumpVelocity = 0;
        this.reachedMinHeight = false;
        this.speedDrop = false;
        this.jumpCount = 0;
        this.jumpspotX = 0;
        this.facing = 1;   // 1 = facing right, -1 = facing left (walking left)
        this.idle = false;
        this.init()
    };
    Trex.config = {
        DROP_VELOCITY: -5,
        GRAVITY: 0.6,
        HEIGHT: 47,
        HEIGHT_DUCK: 25,
        INIITAL_JUMP_VELOCITY: -10,
        INTRO_DURATION: 500,
        MAX_JUMP_HEIGHT: 30,
        MIN_JUMP_HEIGHT: 30,
        SPEED_DROP_COEFFICIENT: 3,
        SPRITE_WIDTH: 262,
        START_X_POS: 250,
        WIDTH: 44,
        WIDTH_DUCK: 59
    };
    Trex.collisionBoxes = {
        DUCKING: [new CollisionBox(1, 18, 55, 25)],
        RUNNING: [new CollisionBox(22, 0, 17, 16), new CollisionBox(1, 18, 30, 9), new CollisionBox(10, 35, 14, 8), new CollisionBox(1, 24, 29, 5), new CollisionBox(5, 30, 21, 4), new CollisionBox(9, 34, 15, 4)]
    };
    Trex.status = {
        CRASHED: 'CRASHED',
        DUCKING: 'DUCKING',
        JUMPING: 'JUMPING',
        RUNNING: 'RUNNING',
        WAITING: 'WAITING'
    };
    Trex.BLINK_TIMING = 7000;
    Trex.animFrames = {
        WAITING: {
            frames: [44, 0],
            msPerFrame: 1000 / 3
        },
        RUNNING: {
            frames: [88, 132],
            msPerFrame: 1000 / 12
        },
        CRASHED: {
            frames: [220],
            msPerFrame: 1000 / 60
        },
        JUMPING: {
            frames: [0],
            msPerFrame: 1000 / 60
        },
        DUCKING: {
            frames: [262, 321],
            msPerFrame: 1000 / 8
        }
    };
    Trex.prototype = {
        init: function() {
            this.blinkDelay = this.setBlinkDelay();
            this.groundYPos = Runner.defaultDimensions.HEIGHT - this.config.HEIGHT - Runner.config.BOTTOM_PAD;
            this.yPos = this.groundYPos;
            this.xPos = 0;
            this.minJumpHeight = this.groundYPos - this.config.MIN_JUMP_HEIGHT;
            this.draw(0, 0);
            this.update(0, Trex.status.WAITING)
        },
        setJumpVelocity: function(setting) {
            this.config.INIITAL_JUMP_VELOCITY = -setting;
            this.config.DROP_VELOCITY = -setting / 2
        },
        update: function(deltaTime, opt_status) {
            this.timer += deltaTime;
            if (opt_status) {
                this.status = opt_status;
                this.currentFrame = 0;
                this.msPerFrame = Trex.animFrames[opt_status].msPerFrame;
                this.currentAnimFrames = Trex.animFrames[opt_status].frames;
                if (opt_status == Trex.status.WAITING) {
                    this.animStartTime = getTimeStamp();
                    this.setBlinkDelay()
                }
            }
            if (this.playingIntro && this.xPos < this.config.START_X_POS) {
                this.xPos += (this.config.START_X_POS / this.config.INTRO_DURATION) * deltaTime;
                if (this.xPos >= this.config.START_X_POS) {
                    this.xPos = this.config.START_X_POS;
                    this.playingIntro = false;
                }
            }
            if (this.status == Trex.status.WAITING) {
                this.blink(getTimeStamp())
            } else {
                // standing still: freeze the legs on the upright frame
                this.draw((this.idle && this.status == Trex.status.RUNNING) ? 0 : this.currentAnimFrames[this.currentFrame], 0)
            }
            if (this.timer >= this.msPerFrame) {
                this.currentFrame = this.currentFrame == this.currentAnimFrames.length - 1 ? 0 : this.currentFrame + 1;
                this.timer = 0
            }
            if (this.speedDrop && this.yPos == this.groundYPos) {
                this.speedDrop = false;
                this.setDuck(true)
            }
        },
        draw: function(x, y) {
            if (this.hidden) return;
            var sourceX = x;
            var sourceY = y;
            var sourceWidth = this.ducking && this.status != Trex.status.CRASHED ? this.config.WIDTH_DUCK : this.config.WIDTH;
            var sourceHeight = this.config.HEIGHT;
            if (IS_HIDPI) {
                sourceX *= 2;
                sourceY *= 2;
                sourceWidth *= 2;
                sourceHeight *= 2
            }
            sourceX += this.spritePos.x;
            sourceY += this.spritePos.y;
            var drawX = Math.round(this.xPos);
            var flip = this.facing < 0 && this.status != Trex.status.CRASHED;
            var dw = (this.ducking && this.status != Trex.status.CRASHED) ? this.config.WIDTH_DUCK : this.config.WIDTH;
            if (flip) {
                this.canvasCtx.save();
                this.canvasCtx.translate(drawX + dw, 0);
                this.canvasCtx.scale(-1, 1);
                drawX = 0;
            }
            if (this.ducking && this.status != Trex.status.CRASHED) {
                this.canvasCtx.drawImage((Runner.dinoSheet || Runner.imageSprite), sourceX, sourceY, sourceWidth, sourceHeight, drawX, this.yPos, this.config.WIDTH_DUCK, this.config.HEIGHT)
            } else {
                if (this.ducking && this.status == Trex.status.CRASHED) {
                    this.xPos++
                }
                this.canvasCtx.drawImage((Runner.dinoSheet || Runner.imageSprite), sourceX, sourceY, sourceWidth, sourceHeight, drawX, this.yPos, this.config.WIDTH, this.config.HEIGHT)
            }
            if (flip) this.canvasCtx.restore();
        },
        setBlinkDelay: function() {
            this.blinkDelay = Math.ceil(Math.random() * Trex.BLINK_TIMING)
        },
        blink: function(time) {
            var deltaTime = time - this.animStartTime;
            if (deltaTime >= this.blinkDelay) {
                this.draw(this.currentAnimFrames[this.currentFrame], 0);
                if (this.currentFrame == 1) {
                    this.setBlinkDelay();
                    this.animStartTime = time
                }
            }
        },
        startJump: function(speed) {
            if (!this.jumping) {
                this.update(0, Trex.status.JUMPING);
                var mc = Runner.instance_ && Runner.instance_.modeCfg;
                if (mc && mc.chaos) {
                    var g = 0.3 + Math.random() * 0.8;
                    var v = Math.sqrt(180 * g);
                    this.config.GRAVITY = g;
                    this.config.INIITAL_JUMP_VELOCITY = -v;
                    this.config.DROP_VELOCITY = -v / 2;
                }
                this.jumpVelocity = this.config.INIITAL_JUMP_VELOCITY - (speed / 10);
                this.jumping = true;
                this.reachedMinHeight = false;
                this.speedDrop = false
            }
        },
        airJump: function(speed) {
            var v = this.config.INIITAL_JUMP_VELOCITY * 0.75 - (speed / 10);
            if (this.jumpVelocity > v) {
                this.jumpVelocity = v;
            }
            this.reachedMinHeight = false;
            this.speedDrop = false;
            this.usedAirJump = true
        },
        endJump: function() {
            if (this.reachedMinHeight && this.jumpVelocity < this.config.DROP_VELOCITY) {
                this.jumpVelocity = this.config.DROP_VELOCITY
            }
        },
        updateJump: function(deltaTime, speed) {
            var msPerFrame = Trex.animFrames[this.status].msPerFrame;
            var framesElapsed = deltaTime / msPerFrame;
            if (this.speedDrop) {
                this.yPos += Math.round(this.jumpVelocity * this.config.SPEED_DROP_COEFFICIENT * framesElapsed)
            } else {
                this.yPos += Math.round(this.jumpVelocity * framesElapsed)
            }
            this.jumpVelocity += this.config.GRAVITY * framesElapsed;
            if (this.yPos < this.minJumpHeight || this.speedDrop) {
                this.reachedMinHeight = true
            }
            if (this.yPos < this.config.MAX_JUMP_HEIGHT || this.speedDrop) {
                this.endJump()
            }
            if (this.yPos > this.groundYPos) {
                this.reset();
                this.jumpCount++
            }
            this.update(deltaTime)
        },
        setSpeedDrop: function() {
            this.speedDrop = true;
            this.jumpVelocity = 1
        },
        setDuck: function(isDucking) {
            if (isDucking && this.status != Trex.status.DUCKING) {
                this.update(0, Trex.status.DUCKING);
                this.ducking = true
            } else if (this.status == Trex.status.DUCKING) {
                this.update(0, Trex.status.RUNNING);
                this.ducking = false
            }
        },
        reset: function() {
            this.yPos = this.groundYPos;
            this.jumpVelocity = 0;
            this.jumping = false;
            this.ducking = false;
            this.update(0, Trex.status.RUNNING);
            this.midair = false;
            this.usedAirJump = false;
            this.speedDrop = false;
            this.jumpCount = 0
        }
    };

    function DistanceMeter(canvas, spritePos, canvasWidth) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.image = Runner.imageSprite;
        this.spritePos = spritePos;
        this.x = 0;
        this.y = 5;
        this.currentDistance = 0;
        this.maxScore = 0;
        this.highScore = 0;
        this.container = null;
        this.digits = [];
        this.acheivement = false;
        this.defaultString = '';
        this.flashTimer = 0;
        this.flashIterations = 0;
        this.config = DistanceMeter.config;
        this.maxScoreUnits = this.config.MAX_DISTANCE_UNITS;
        this.init(canvasWidth)
    };
    DistanceMeter.dimensions = {
        WIDTH: 10,
        HEIGHT: 13,
        DEST_WIDTH: 11
    };
    DistanceMeter.yPos = [0, 13, 27, 40, 53, 67, 80, 93, 107, 120];
    DistanceMeter.config = {
        MAX_DISTANCE_UNITS: 5,
        ACHIEVEMENT_DISTANCE: 100,
        COEFFICIENT: 0.025,
        FLASH_DURATION: 1000 / 4,
        FLASH_ITERATIONS: 3
    };
    DistanceMeter.prototype = {
        init: function(width) {
            var maxDistanceStr = '';
            this.calcXPos(width);
            this.maxScore = this.maxScoreUnits;
            for (var i = 0; i < this.maxScoreUnits; i++) {
                this.draw(i, 0);
                this.defaultString += '0';
                maxDistanceStr += '9'
            }
            this.maxScore = parseInt(maxDistanceStr)
        },
        calcXPos: function(canvasWidth) {
            this.x = canvasWidth - (DistanceMeter.dimensions.DEST_WIDTH * (this.maxScoreUnits + 1))
        },
        draw: function(digitPos, value, opt_highScore) {
            var sourceWidth = DistanceMeter.dimensions.WIDTH;
            var sourceHeight = DistanceMeter.dimensions.HEIGHT;
            var sourceX = DistanceMeter.dimensions.WIDTH * value;
            var sourceY = 0;
            var targetX = digitPos * DistanceMeter.dimensions.DEST_WIDTH;
            var targetY = this.y;
            var targetWidth = DistanceMeter.dimensions.WIDTH;
            var targetHeight = DistanceMeter.dimensions.HEIGHT;
            if (IS_HIDPI) {
                sourceWidth *= 2;
                sourceHeight *= 2;
                sourceX *= 2
            }
            sourceX += this.spritePos.x;
            sourceY += this.spritePos.y;
            this.canvasCtx.save();
            if (opt_highScore) {
                var highScoreX = this.x - (this.maxScoreUnits * 2) * DistanceMeter.dimensions.WIDTH;
                this.canvasCtx.translate(highScoreX, this.y)
            } else {
                this.canvasCtx.translate(this.x, this.y)
            }
            this.canvasCtx.drawImage(this.image, sourceX, sourceY, sourceWidth, sourceHeight, targetX, targetY, targetWidth, targetHeight);
            this.canvasCtx.restore()
        },
        getActualDistance: function(distance) {
            return distance ? Math.round(distance * this.config.COEFFICIENT) : 0
        },
        update: function(deltaTime, distance) {
            var paint = true;
            var playSound = false;
            if (!this.acheivement) {
                distance = this.getActualDistance(distance);
                if (distance > this.maxScore && this.maxScoreUnits == this.config.MAX_DISTANCE_UNITS) {
                    this.maxScoreUnits++;
                    this.maxScore = parseInt(this.maxScore + '9')
                } else {
                    this.distance = 0
                }
                if (distance > 0) {
                    if (distance % this.config.ACHIEVEMENT_DISTANCE == 0 && distance > (this.achievedMax || 0)) {
                        this.achievedMax = distance;
                        this.acheivement = true;
                        this.flashTimer = 0;
                        playSound = true
                    }
                    var distanceStr = (this.defaultString + distance).substr(-this.maxScoreUnits);
                    this.digits = distanceStr.split('')
                } else {
                    this.digits = this.defaultString.split('')
                }
            } else {
                if (this.flashIterations <= this.config.FLASH_ITERATIONS) {
                    this.flashTimer += deltaTime;
                    if (this.flashTimer < this.config.FLASH_DURATION) {
                        paint = false
                    } else if (this.flashTimer > this.config.FLASH_DURATION * 2) {
                        this.flashTimer = 0;
                        this.flashIterations++
                    }
                } else {
                    this.acheivement = false;
                    this.flashIterations = 0;
                    this.flashTimer = 0
                }
            }
            if (paint) {
                for (var i = this.digits.length - 1; i >= 0; i--) {
                    this.draw(i, parseInt(this.digits[i]))
                }
            }
            this.drawHighScore();
            return playSound
        },
        drawHighScore: function() {
            this.canvasCtx.save();
            this.canvasCtx.globalAlpha = .8;
            for (var i = this.highScore.length - 1; i >= 0; i--) {
                this.draw(i, parseInt(this.highScore[i], 10), true)
            }
            this.canvasCtx.restore()
        },
        setHighScore: function(distance) {
            distance = this.getActualDistance(distance);
            var highScoreStr = (this.defaultString + distance).substr(-this.maxScoreUnits);
            this.highScore = ['10', '11', ''].concat(highScoreStr.split(''))
        },
        reset: function() {
            this.update(0);
            this.acheivement = false
        }
    };

    function Cloud(canvas, spritePos, containerWidth) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');
        this.spritePos = spritePos;
        this.containerWidth = containerWidth;
        this.xPos = containerWidth;
        this.yPos = 0;
        this.remove = false;
        this.cloudGap = getRandomNum(Cloud.config.MIN_CLOUD_GAP, Cloud.config.MAX_CLOUD_GAP);
        this.init()
    };
    Cloud.config = {
        HEIGHT: 14,
        MAX_CLOUD_GAP: 400,
        MAX_SKY_LEVEL: 30,
        MIN_CLOUD_GAP: 100,
        MIN_SKY_LEVEL: 71,
        WIDTH: 46
    };
    Cloud.prototype = {
        init: function() {
            this.yPos = getRandomNum(Cloud.config.MAX_SKY_LEVEL, Cloud.config.MIN_SKY_LEVEL);
            this.draw()
        },
        draw: function() {
            this.canvasCtx.save();
            var sourceWidth = Cloud.config.WIDTH;
            var sourceHeight = Cloud.config.HEIGHT;
            if (IS_HIDPI) {
                sourceWidth = sourceWidth * 2;
                sourceHeight = sourceHeight * 2
            }
            this.canvasCtx.drawImage(Runner.imageSprite, this.spritePos.x, this.spritePos.y, sourceWidth, sourceHeight, this.xPos, this.yPos, Cloud.config.WIDTH, Cloud.config.HEIGHT);
            this.canvasCtx.restore()
        },
        update: function(speed) {
            if (!this.remove) {
                this.xPos -= speed >= 0 ? Math.ceil(speed) : -Math.ceil(-speed);
                this.draw();
                if (!this.isVisible()) {
                    this.remove = true
                }
            }
        },
        isVisible: function() {
            return this.xPos + Cloud.config.WIDTH > 0 && this.xPos < this.containerWidth + Cloud.config.WIDTH
        }
    };

    function HorizonLine(canvas, spritePos, default_width) {
        this.spritePos = spritePos;
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.sourceDimensions = {};
        this.dimensions = HorizonLine.dimensions;
        this.width = default_width || Runner.defaultDimensions.WIDTH || 600;
        this.sourceXPos = [];
        this.xPos = [];
        this.yPos = 0;
        this.bumpThreshold = 0.5;
        this.setSourceDimensions();
        this.draw();
    };
    HorizonLine.dimensions = {
        WIDTH: 600,
        HEIGHT: 12,
        YPOS: Runner.defaultDimensions.HEIGHT - 23
    };
    HorizonLine.prototype = {
        setSourceDimensions: function() {
            for (var dimension in HorizonLine.dimensions) {
                if (IS_HIDPI) {
                    if (dimension != 'YPOS') {
                        this.sourceDimensions[dimension] = HorizonLine.dimensions[dimension] * 2
                    }
                } else {
                    this.sourceDimensions[dimension] = HorizonLine.dimensions[dimension]
                }
                this.dimensions[dimension] = HorizonLine.dimensions[dimension]
            }
            this.yPos = HorizonLine.dimensions.YPOS;
            this.updateDimensions(this.width);
        },
        updateDimensions: function(width) {
            this.width = width || this.width || 600;
            var numSegments = Math.ceil(this.width / this.dimensions.WIDTH) + 1;
            if (numSegments < 2) {
                numSegments = 2;
            }
            if (this.xPos.length === 0) {
                for (var i = 0; i < numSegments; i++) {
                    this.xPos[i] = i * this.dimensions.WIDTH;
                    this.sourceXPos[i] = this.getRandomType() + this.spritePos.x;
                }
            } else {
                while (this.xPos.length < numSegments) {
                    var maxX = Math.max.apply(null, this.xPos);
                    this.xPos.push(maxX + this.dimensions.WIDTH);
                    this.sourceXPos.push(this.getRandomType() + this.spritePos.x);
                }
            }
        },
        getRandomType: function() {
            return Math.random() > this.bumpThreshold ? this.sourceDimensions.WIDTH : 0;
        },
        draw: function() {
            for (var i = 0; i < this.xPos.length; i++) {
                this.canvasCtx.drawImage(
                    Runner.imageSprite,
                    this.sourceXPos[i],
                    this.spritePos.y,
                    this.sourceDimensions.WIDTH,
                    this.sourceDimensions.HEIGHT,
                    this.xPos[i],
                    this.yPos,
                    this.dimensions.WIDTH,
                    this.dimensions.HEIGHT
                );
            }
        },
        // increment: signed px the world moved this step (positive = forward)
        update: function(increment) {
            if (increment > 0) {
                for (var i = 0; i < this.xPos.length; i++) {
                    this.xPos[i] -= increment;
                }
                for (var i = 0; i < this.xPos.length; i++) {
                    if (this.xPos[i] <= -this.dimensions.WIDTH) {
                        var maxX = Math.max.apply(null, this.xPos);
                        this.xPos[i] = maxX + this.dimensions.WIDTH;
                        this.sourceXPos[i] = this.getRandomType() + this.spritePos.x;
                    }
                }
            } else if (increment < 0) {
                for (var i = 0; i < this.xPos.length; i++) {
                    this.xPos[i] -= increment;
                }
                for (var i = 0; i < this.xPos.length; i++) {
                    if (this.xPos[i] >= this.width) {
                        var minX = Math.min.apply(null, this.xPos);
                        this.xPos[i] = minX - this.dimensions.WIDTH;
                        this.sourceXPos[i] = this.getRandomType() + this.spritePos.x;
                    }
                }
            }
            this.draw();
        },
        reset: function() {
            this.xPos = [];
            this.sourceXPos = [];
            this.updateDimensions(this.width);
        }
    };

    function Horizon(canvas, spritePos, dimensions, gapCoefficient, default_width) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');
        this.config = Horizon.config;
        this.dimensions = dimensions;
        this.gapCoefficient = gapCoefficient;
        this.obstacles = [];
        this.obstacleHistory = [];
        this.shift = 0;        // how far the world has scrolled (px); the obstacles live at fixed world positions
        this.lastInc = 0;      // signed px the world moved on the last step
        this.passIdx = 0;
        this.firstThr = 1080;
        this.horizonOffsets = [0, 0];
        this.cloudFrequency = this.config.CLOUD_FREQUENCY;
        this.spritePos = spritePos;
        this.clouds = [];
        this.cloudSpeed = this.config.BG_CLOUD_SPEED;
        this.horizonLine = null;
        this.width = default_width;
        this.init()
    };
    Horizon.config = {
        BG_CLOUD_SPEED: 0.2,
        BUMPY_THRESHOLD: .3,
        CLOUD_FREQUENCY: .5,
        HORIZON_HEIGHT: 16,
        MAX_CLOUDS: 6
    };
    Horizon.prototype = {
        init: function() {
            this.addCloud();
            this.horizonLine = new HorizonLine(this.canvas, this.spritePos.HORIZON, this.width)
        },
        updateDimensions: function(width) {
            this.width = width;
            if (this.horizonLine) {
                this.horizonLine.updateDimensions(width);
            }
        },
        // speed is signed: > 0 walking forward, < 0 backward, 0 standing still
        update: function(deltaTime, speed, updateObstacles) {
            var mag = Math.floor(Math.abs(speed) * (FPS / 1000) * deltaTime);
            this.advance(deltaTime, speed < 0 ? -mag : mag, speed, updateObstacles);
        },
        // spectating: slide the camera by inc px (any size) so it ends up where somebody else is
        follow: function(deltaTime, inc) {
            this.advance(deltaTime, inc, Math.max(-13, Math.min(13, inc)), true);
        },
        advance: function(deltaTime, inc, cloudSpeed, updateObstacles) {
            this.runningTime += deltaTime;
            if (this.shift + inc < 0) inc = -this.shift;   // you can't go back past the start line
            this.shift += inc;
            this.lastInc = inc;
            this.horizonLine.update(inc % this.dimensions.WIDTH);
            this.updateClouds(deltaTime, inc === 0 ? 0 : cloudSpeed);
            if (updateObstacles) {
                this.updateObstacles(deltaTime, inc)
            }
        },
        updateClouds: function(deltaTime, speed) {
            var cloudSpeed = this.cloudSpeed / 1000 * deltaTime * speed;
            var numClouds = this.clouds.length;
            if (numClouds) {
                for (var i = numClouds - 1; i >= 0; i--) {
                    this.clouds[i].update(cloudSpeed)
                }
                var lastCloud = this.clouds[numClouds - 1];
                if (speed >= 0 && numClouds < this.config.MAX_CLOUDS && (this.dimensions.WIDTH - lastCloud.xPos) > lastCloud.cloudGap && this.cloudFrequency > Math.random()) {
                    this.addCloud()
                }
                var firstCloud = this.clouds[0];
                if (speed < 0 && numClouds < this.config.MAX_CLOUDS && firstCloud.xPos > firstCloud.cloudGap && this.cloudFrequency > Math.random()) {
                    this.addCloud(true)
                }
                this.clouds = this.clouds.filter(function(obj) {
                    return !obj.remove
                })
            } else if (speed !== 0) {
                this.addCloud(speed < 0)
            }
        },
        // the course is generated one obstacle at a time, in order, from the seeded random numbers; each obstacle's
        // world position and the speed used to size its gap depend only on where the previous one was, never on
        // how you walked, so every player meets exactly the same cacti in the same places
        updateObstacles: function(deltaTime, inc) {
            var sw = Runner.spawnWidth(this.dimensions);
            for (var guard = 0; guard < 80; guard++) {
                var last = this.obstacles[this.obstacles.length - 1];
                var thr = last ? last.wl + last.width + last.gap - sw : this.firstThr;
                if (this.shift < thr) break;
                this.addNewObstacle(thr, sw);
            }
            for (var i = 0; i < this.obstacles.length; i++) {
                this.obstacles[i].place(this.shift, inc, deltaTime);
            }
        },
        addNewObstacle: function(thr, sw) {
            var r = Runner.instance_;
            var currentSpeed = r ? r.nominalSpeed(thr) : 6;
            var mc = (Runner.instance_ && Runner.instance_.modeCfg) || {};
            var pool = Obstacle.types;
            if (mc.types) {
                pool = pool.filter(function(t) {
                    return mc.types.indexOf(t.type) > -1
                });
            }
            var obstacleType, tries = 0;
            do {
                obstacleType = pool[getSeededNum(0, pool.length - 1)];
                tries++;
            } while (tries < 50 && ((!mc.noDupCheck && this.duplicateObstacleCheck(obstacleType.type)) || (!mc.ignoreMinSpeed && currentSpeed < obstacleType.minSpeed)));
            if (!obstacleType) {
                return
            } else {
                var obstacleSpritePos = this.spritePos[obstacleType.type];
                var newObs = new Obstacle(this.canvasCtx, obstacleType, obstacleSpritePos, this.dimensions, this.gapCoefficient, currentSpeed);
                newObs.wl = thr + sw - newObs.width;
                this.obstacles.push(newObs);
                this.obstacleHistory.unshift(obstacleType.type);
                if (this.obstacleHistory.length > 1) {
                    this.obstacleHistory.splice(Runner.config.MAX_OBSTACLE_DUPLICATION)
                }
            }
        },
        duplicateObstacleCheck: function(nextObstacleType) {
            var duplicateCount = 0;
            for (var i = 0; i < this.obstacleHistory.length; i++) {
                duplicateCount = this.obstacleHistory[i] == nextObstacleType ? duplicateCount + 1 : 0
            }
            return duplicateCount >= Runner.config.MAX_OBSTACLE_DUPLICATION
        },
        reset: function() {
            this.obstacles = [];
            this.obstacleHistory = [];
            this.shift = 0;
            this.lastInc = 0;
            this.passIdx = 0;
            var r = Runner.instance_;
            this.firstThr = Math.round(Runner.config.CLEAR_TIME * (FPS / 1000) * ((r && r.config.SPEED) || 6));
            this.horizonLine.reset()
        },
        resize: function(width, height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.updateDimensions(width);
        },
        addCloud: function(atLeft) {
            var c = new Cloud(this.canvas, this.spritePos.CLOUD, this.dimensions.WIDTH);
            if (atLeft) {
                c.xPos = -Cloud.config.WIDTH + 1;
                this.clouds.unshift(c)
            } else {
                this.clouds.push(c)
            }
        }
    }
})();
new Runner('.interstitial-wrapper');

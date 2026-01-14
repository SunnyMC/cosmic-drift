// Cosmic Drift - Main Game Logic

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Screens
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.pauseScreen = document.getElementById('pause-screen');
        this.hud = document.getElementById('hud');

        // HUD Elements
        this.scoreEl = document.getElementById('score');
        this.levelEl = document.getElementById('level');
        this.multiplierEl = document.getElementById('multiplier');
        this.energyFill = document.getElementById('energy-fill');
        this.highScoreEl = document.getElementById('high-score');
        this.finalScoreEl = document.getElementById('final-score');
        this.finalLevelEl = document.getElementById('final-level');
        this.newRecordEl = document.getElementById('new-record');

        // Game State
        this.isRunning = false;
        this.isPaused = false;
        this.score = 0;
        this.level = 1;
        this.multiplier = 1;
        this.energy = 100;
        this.highScore = parseInt(localStorage.getItem('cosmicDriftHighScore')) || 0;

        // Input
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;

        // Entities
        this.player = null;
        this.particles = [];
        this.collectibles = [];
        this.blackHoles = [];
        this.stars = [];
        this.trailParticles = [];
        this.bullets = []; // Bullets from black holes

        // Bot mode
        this.botEnabled = false;
        this.botTarget = null;

        // Timing
        this.lastTime = 0;
        this.deltaTime = 0;
        this.spawnTimer = 0;
        this.difficultyTimer = 0;

        // Sprite disabled - using geometric ship
        this.spriteLoaded = false;

        // Ship types with different stats and prices
        this.shipTypes = {
            speeder: {
                name: 'СКОРОСТЬ',
                maxSpeed: 12,
                thrust: 1.2,
                friction: 0.85,  // Less inertia - stops faster
                maxHP: 1,
                color: '#00f5ff',
                boostColor: '#00ffff',
                price: 100
            },
            balanced: {
                name: 'БАЛАНС',
                maxSpeed: 8,
                thrust: 1.0,
                friction: 0.88,  // Less inertia
                maxHP: 2,
                color: '#8b5cf6',
                boostColor: '#a78bfa',
                price: 400
            },
            tank: {
                name: 'ТАНК',
                maxSpeed: 5,
                thrust: 1.1,
                friction: 0.90,  // Less inertia
                maxHP: 3,
                color: '#ff00ff',
                boostColor: '#f97316',
                price: 600
            }
        };

        this.selectedShip = 'speeder'; // Default to cheapest
        this.hp = 1;
        this.maxHP = 1;

        // Economy - load from localStorage
        this.coins = parseInt(localStorage.getItem('cosmicDriftCoins')) || 0;
        this.unlockedShips = JSON.parse(localStorage.getItem('cosmicDriftUnlockedShips')) || ['speeder']; // Speeder is free
        this.sessionCoins = 0; // Coins earned this game session

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Input handlers
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // Mouse handlers
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

        // Touch handlers for mobile
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Button handlers
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.startGame());
        document.getElementById('menu-btn').addEventListener('click', () => this.showMenu());
        document.getElementById('resume-btn').addEventListener('click', () => this.resumeGame());
        document.getElementById('quit-btn').addEventListener('click', () => this.showMenu());

        // Bot button handler
        const botBtn = document.getElementById('bot-btn');
        if (botBtn) {
            botBtn.addEventListener('click', () => this.toggleBot());
        }

        // Update high score display
        this.highScoreEl.textContent = this.highScore;

        // Create background stars
        this.createStars();

        // Ship selection handlers
        this.setupShipSelection();

        // Start animation loop for background
        this.animateBackground();
    }

    setupShipSelection() {
        this.updateShipCardsUI();
        this.updateCoinsDisplay();

        const shipCards = document.querySelectorAll('.ship-card');
        shipCards.forEach(card => {
            card.addEventListener('click', () => {
                const shipId = card.dataset.ship;
                const shipType = this.shipTypes[shipId];

                // Check if ship is unlocked
                if (this.unlockedShips.includes(shipId)) {
                    // Select the ship
                    shipCards.forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    this.selectedShip = shipId;
                } else {
                    // Try to buy the ship
                    if (this.coins >= shipType.price) {
                        this.coins -= shipType.price;
                        this.unlockedShips.push(shipId);
                        this.saveProgress();
                        this.updateShipCardsUI();
                        this.updateCoinsDisplay();

                        // Auto-select the bought ship
                        shipCards.forEach(c => c.classList.remove('selected'));
                        card.classList.add('selected');
                        this.selectedShip = shipId;
                    }
                }
            });
        });
    }

    updateShipCardsUI() {
        const shipCards = document.querySelectorAll('.ship-card');
        shipCards.forEach(card => {
            const shipId = card.dataset.ship;
            const shipType = this.shipTypes[shipId];
            const isUnlocked = this.unlockedShips.includes(shipId);

            // Update locked/unlocked state
            card.classList.toggle('locked', !isUnlocked);
            card.classList.toggle('unlocked', isUnlocked);

            // Update price display
            let priceEl = card.querySelector('.ship-price');
            if (!priceEl) {
                priceEl = document.createElement('div');
                priceEl.className = 'ship-price';
                card.appendChild(priceEl);
            }

            if (isUnlocked) {
                priceEl.textContent = '✓ КУПЛЕНО';
                priceEl.classList.add('owned');
            } else {
                const canAfford = this.coins >= shipType.price;
                priceEl.textContent = `🪙 ${shipType.price}`;
                priceEl.classList.remove('owned');
                priceEl.classList.toggle('affordable', canAfford);
            }
        });

        // Ensure selected ship is valid
        if (!this.unlockedShips.includes(this.selectedShip)) {
            this.selectedShip = this.unlockedShips[0] || 'speeder';
        }

        // Update selected visual
        shipCards.forEach(card => {
            card.classList.toggle('selected', card.dataset.ship === this.selectedShip);
        });
    }

    updateCoinsDisplay() {
        const coinsDisplay = document.getElementById('coins-display');
        if (coinsDisplay) {
            coinsDisplay.textContent = this.coins;
        }
    }

    saveProgress() {
        localStorage.setItem('cosmicDriftCoins', this.coins);
        localStorage.setItem('cosmicDriftUnlockedShips', JSON.stringify(this.unlockedShips));
        localStorage.setItem('cosmicDriftHighScore', this.highScore);
    }

    addCoins(amount) {
        this.coins += amount;
        this.sessionCoins += amount;
        this.saveProgress();

        // Update HUD coin display
        const coinsHud = document.getElementById('coins-hud');
        if (coinsHud) {
            coinsHud.textContent = `🪙 ${this.coins}`;
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    handleKeyDown(e) {
        this.keys[e.code] = true;

        if (e.code === 'Escape' && this.isRunning) {
            this.togglePause();
        }

        // Prevent scrolling
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
        }
    }

    handleKeyUp(e) {
        this.keys[e.code] = false;
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
    }

    handleMouseDown(e) {
        if (e.button === 0) {
            this.mouseDown = true;
        }
    }

    handleMouseUp(e) {
        this.mouseDown = false;
    }

    handleTouchMove(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        this.mouseX = touch.clientX - rect.left;
        this.mouseY = touch.clientY - rect.top;
    }

    handleTouchStart(e) {
        e.preventDefault();
        this.mouseDown = true;
        this.handleTouchMove(e);
    }

    handleTouchEnd(e) {
        this.mouseDown = false;
    }

    createStars() {
        this.stars = [];
        for (let i = 0; i < 200; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 0.5,
                brightness: Math.random(),
                twinkleSpeed: Math.random() * 0.02 + 0.01
            });
        }
    }

    createPlayer() {
        const shipType = this.shipTypes[this.selectedShip];
        this.maxHP = shipType.maxHP;
        this.hp = this.maxHP;

        this.player = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            vx: 0,
            vy: 0,
            radius: 15,
            angle: 0,
            thrust: shipType.thrust,
            maxSpeed: shipType.maxSpeed,
            friction: shipType.friction,
            boosting: false,
            invincible: false,
            invincibleTimer: 0,
            shipType: this.selectedShip,
            color: shipType.color,
            boostColor: shipType.boostColor
        };

        this.updateHPDisplay();
    }

    updateHPDisplay() {
        const heartsContainer = document.getElementById('hp-hearts');
        if (!heartsContainer) return;

        let heartsHTML = '';
        for (let i = 0; i < this.maxHP; i++) {
            if (i < this.hp) {
                heartsHTML += '<span class="heart full">❤️</span>';
            } else {
                heartsHTML += '<span class="heart empty">🖤</span>';
            }
        }
        heartsContainer.innerHTML = heartsHTML;
    }

    takeDamage() {
        if (this.player.invincible) return false;

        this.hp--;
        this.updateHPDisplay();

        // Trigger damage animation
        const hearts = document.querySelectorAll('.heart');
        if (hearts[this.hp]) {
            hearts[this.hp].classList.add('damage');
            setTimeout(() => hearts[this.hp]?.classList.remove('damage'), 500);
        }

        // Create damage effect
        this.createExplosion(this.player.x, this.player.y, 20, '#ff3366');

        if (this.hp <= 0) {
            return true; // Player is dead
        }

        // Give brief invincibility after taking damage
        this.player.invincible = true;
        this.player.invincibleTimer = 120; // 2 seconds

        return false;
    }

    spawnCollectible() {
        const edge = Math.floor(Math.random() * 4);
        let x, y;

        switch (edge) {
            case 0: x = Math.random() * this.canvas.width; y = -30; break;
            case 1: x = this.canvas.width + 30; y = Math.random() * this.canvas.height; break;
            case 2: x = Math.random() * this.canvas.width; y = this.canvas.height + 30; break;
            case 3: x = -30; y = Math.random() * this.canvas.height; break;
        }

        const types = ['energy', 'points', 'multiplier', 'shield'];
        const weights = [0.4, 0.35, 0.15, 0.1];
        let random = Math.random();
        let type = types[0];

        for (let i = 0; i < weights.length; i++) {
            if (random < weights[i]) {
                type = types[i];
                break;
            }
            random -= weights[i];
        }

        // Target position near center
        const targetX = this.canvas.width * (0.2 + Math.random() * 0.6);
        const targetY = this.canvas.height * (0.2 + Math.random() * 0.6);

        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = 1 + Math.random() * 2;

        this.collectibles.push({
            x, y,
            vx: (dx / dist) * speed,
            vy: (dy / dist) * speed,
            radius: 12,
            type,
            pulse: 0,
            lifetime: 0
        });
    }

    spawnBlackHole() {
        const margin = 100;
        let x, y;
        let attempts = 0;

        do {
            x = margin + Math.random() * (this.canvas.width - margin * 2);
            y = margin + Math.random() * (this.canvas.height - margin * 2);
            attempts++;
        } while (
            attempts < 50 &&
            this.player &&
            Math.hypot(x - this.player.x, y - this.player.y) < 200
        );

        this.blackHoles.push({
            x, y,
            radius: 30 + Math.random() * 20,
            pullRadius: 150 + Math.random() * 100,
            strength: 0.3 + (this.level * 0.05),
            rotation: 0,
            lifetime: 0,
            maxLifetime: 500 + Math.random() * 300,
            shootTimer: 0,
            shootInterval: 120 + Math.random() * 60 // Shoot every 2-3 seconds
        });
    }

    spawnBullet(hole) {
        if (!this.player) return;

        const dx = this.player.x - hole.x;
        const dy = this.player.y - hole.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const speed = 4 + this.level * 0.3;

        this.bullets.push({
            x: hole.x,
            y: hole.y,
            vx: (dx / dist) * speed,
            vy: (dy / dist) * speed,
            radius: 6,
            life: 300, // 5 seconds lifetime
            trail: []
        });
    }

    toggleBot() {
        this.botEnabled = !this.botEnabled;
        const btn = document.getElementById('bot-btn');
        if (btn) {
            btn.textContent = this.botEnabled ? '🤖 БОТ: ВКЛ' : '🤖 БОТ: ВЫКЛ';
            btn.classList.toggle('active', this.botEnabled);
        }
    }

    updateBot() {
        if (!this.botEnabled || !this.player) return;

        // Find best target (closest collectible)
        let bestCollectible = null;
        let bestScore = -Infinity;

        for (const c of this.collectibles) {
            const dx = c.x - this.player.x;
            const dy = c.y - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Check if path to collectible is safe
            let dangerScore = 0;
            for (const hole of this.blackHoles) {
                const holeDist = Math.hypot(c.x - hole.x, c.y - hole.y);
                if (holeDist < hole.pullRadius) {
                    dangerScore += (hole.pullRadius - holeDist) * 2;
                }
            }

            // Check bullets danger
            for (const bullet of this.bullets) {
                const bulletDist = Math.hypot(c.x - bullet.x, c.y - bullet.y);
                if (bulletDist < 80) {
                    dangerScore += 100;
                }
            }

            // Score based on distance, type priority, and danger
            let typeBonus = 0;
            if (c.type === 'shield') typeBonus = 200;
            else if (c.type === 'multiplier') typeBonus = 150;
            else if (c.type === 'energy' && this.energy < 50) typeBonus = 180;
            else if (c.type === 'points') typeBonus = 100;

            const score = typeBonus - dist - dangerScore;

            if (score > bestScore) {
                bestScore = score;
                bestCollectible = c;
            }
        }

        // Check for immediate danger and evade
        let evadeX = 0, evadeY = 0;
        let inDanger = false;

        // Evade black holes
        for (const hole of this.blackHoles) {
            const dx = this.player.x - hole.x;
            const dy = this.player.y - hole.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < hole.pullRadius * 0.8) {
                const urgency = 1 - (dist / (hole.pullRadius * 0.8));
                evadeX += (dx / dist) * urgency * 2;
                evadeY += (dy / dist) * urgency * 2;
                inDanger = true;
            }
        }

        // Evade bullets
        for (const bullet of this.bullets) {
            const dx = this.player.x - bullet.x;
            const dy = this.player.y - bullet.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 100) {
                const urgency = 1 - (dist / 100);
                evadeX += (dx / dist) * urgency * 3;
                evadeY += (dy / dist) * urgency * 3;
                inDanger = true;
            }
        }

        // Set bot target position
        if (inDanger) {
            // Evade danger
            const evadeDist = Math.sqrt(evadeX * evadeX + evadeY * evadeY);
            if (evadeDist > 0) {
                this.mouseX = this.player.x + (evadeX / evadeDist) * 200;
                this.mouseY = this.player.y + (evadeY / evadeDist) * 200;
            }
            // Boost when in danger
            this.mouseDown = this.energy > 20;
        } else if (bestCollectible) {
            // Move towards best collectible
            this.mouseX = bestCollectible.x;
            this.mouseY = bestCollectible.y;

            // Boost if far from target
            const distToTarget = Math.hypot(
                bestCollectible.x - this.player.x,
                bestCollectible.y - this.player.y
            );
            this.mouseDown = distToTarget > 200 && this.energy > 30;
        } else {
            // Patrol center of screen
            this.mouseX = this.canvas.width / 2 + Math.sin(Date.now() * 0.001) * 200;
            this.mouseY = this.canvas.height / 2 + Math.cos(Date.now() * 0.001) * 150;
            this.mouseDown = false;
        }

        // Keep target in bounds
        this.mouseX = Math.max(50, Math.min(this.canvas.width - 50, this.mouseX));
        this.mouseY = Math.max(50, Math.min(this.canvas.height - 50, this.mouseY));
    }

    startGame() {
        this.isRunning = true;
        this.isPaused = false;
        this.score = 0;
        this.level = 1;
        this.multiplier = 1;
        this.energy = 100;

        this.collectibles = [];
        this.blackHoles = [];
        this.trailParticles = [];
        this.particles = [];
        this.bullets = [];

        this.spawnTimer = 0;
        this.difficultyTimer = 0;
        this.sessionCoins = 0; // Reset session coins

        this.createPlayer();

        this.startScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
        this.pauseScreen.classList.add('hidden');
        this.hud.classList.remove('hidden');

        this.lastTime = performance.now();

        // Update HUD coins display
        const coinsHud = document.getElementById('coins-hud');
        if (coinsHud) {
            coinsHud.textContent = `🪙 ${this.coins}`;
        }

        this.gameLoop();
    }

    showMenu() {
        this.isRunning = false;
        this.isPaused = false;

        this.startScreen.classList.remove('hidden');
        this.gameOverScreen.classList.add('hidden');
        this.pauseScreen.classList.add('hidden');
        this.hud.classList.add('hidden');

        this.highScoreEl.textContent = this.highScore;
    }

    togglePause() {
        if (!this.isRunning) return;

        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            this.pauseScreen.classList.remove('hidden');
        } else {
            this.pauseScreen.classList.add('hidden');
            this.lastTime = performance.now();
            this.gameLoop();
        }
    }

    resumeGame() {
        this.isPaused = false;
        this.pauseScreen.classList.add('hidden');
        this.lastTime = performance.now();
        this.gameLoop();
    }

    gameOver() {
        this.isRunning = false;

        // Check high score
        let isNewRecord = false;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('cosmicDriftHighScore', this.highScore);
            isNewRecord = true;
        }

        // Update game over screen
        this.finalScoreEl.textContent = this.score;
        this.finalLevelEl.textContent = this.level;

        // Show session coins earned
        const sessionCoinsEl = document.getElementById('session-coins');
        if (sessionCoinsEl) {
            sessionCoinsEl.textContent = this.sessionCoins;
        }

        if (isNewRecord) {
            this.newRecordEl.classList.remove('hidden');
        } else {
            this.newRecordEl.classList.add('hidden');
        }

        // Create explosion effect
        this.createExplosion(this.player.x, this.player.y, 50, this.player.color || '#00f5ff');

        // Return to menu after delay
        setTimeout(() => {
            this.showMenu();
            this.updateShipCardsUI();
            this.updateCoinsDisplay();
        }, 1500);
    }

    createExplosion(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
            const speed = 3 + Math.random() * 5;

            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 4,
                color,
                life: 1,
                decay: 0.02 + Math.random() * 0.02
            });
        }
    }

    update() {
        if (!this.player) return;

        const dt = this.deltaTime / 16.67; // Normalize to 60fps

        // Mouse-following movement
        const dx = this.mouseX - this.player.x;
        const dy = this.mouseY - this.player.y;
        const distToMouse = Math.sqrt(dx * dx + dy * dy);

        // Calculate direction to mouse
        let ax = 0, ay = 0;
        if (distToMouse > 5) { // Dead zone to prevent jitter
            ax = dx / distToMouse;
            ay = dy / distToMouse;
        }

        // Boost with mouse button or space
        this.player.boosting = (this.mouseDown || this.keys['Space']) && this.energy > 0;
        const thrustMult = this.player.boosting ? 2.5 : 1;

        if (this.player.boosting) {
            this.energy = Math.max(0, this.energy - 0.5 * dt);
        } else {
            this.energy = Math.min(100, this.energy + 0.1 * dt);
        }

        // Smooth acceleration towards mouse (stronger when far, weaker when close)
        const accelFactor = Math.min(distToMouse / 100, 1) * this.player.thrust * thrustMult;
        this.player.vx += ax * accelFactor * dt;
        this.player.vy += ay * accelFactor * dt;

        // Black hole gravity
        for (const hole of this.blackHoles) {
            const dx = hole.x - this.player.x;
            const dy = hole.y - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < hole.pullRadius) {
                const force = (hole.strength * (1 - dist / hole.pullRadius)) * dt;
                this.player.vx += (dx / dist) * force;
                this.player.vy += (dy / dist) * force;
            }

            // Collision with black hole
            if (dist < hole.radius && !this.player.invincible) {
                if (this.takeDamage()) {
                    this.gameOver();
                    return;
                }
            }
        }

        // Apply friction
        this.player.vx *= this.player.friction;
        this.player.vy *= this.player.friction;

        // Clamp speed
        const speed = Math.sqrt(this.player.vx ** 2 + this.player.vy ** 2);
        const maxSpeed = this.player.boosting ? this.player.maxSpeed * 1.5 : this.player.maxSpeed;

        if (speed > maxSpeed) {
            this.player.vx = (this.player.vx / speed) * maxSpeed;
            this.player.vy = (this.player.vy / speed) * maxSpeed;
        }

        // Move player
        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;

        // Update angle
        if (speed > 0.5) {
            this.player.angle = Math.atan2(this.player.vy, this.player.vx);
        }

        // Wrap around edges
        const margin = this.player.radius;
        if (this.player.x < -margin) this.player.x = this.canvas.width + margin;
        if (this.player.x > this.canvas.width + margin) this.player.x = -margin;
        if (this.player.y < -margin) this.player.y = this.canvas.height + margin;
        if (this.player.y > this.canvas.height + margin) this.player.y = -margin;

        // Invincibility timer
        if (this.player.invincible) {
            this.player.invincibleTimer -= dt;
            if (this.player.invincibleTimer <= 0) {
                this.player.invincible = false;
            }
        }

        // Trail particles
        if (speed > 1) {
            this.trailParticles.push({
                x: this.player.x - Math.cos(this.player.angle) * this.player.radius,
                y: this.player.y - Math.sin(this.player.angle) * this.player.radius,
                radius: this.player.boosting ? 6 : 4,
                life: 1,
                color: this.player.boosting ? '#ff00ff' : '#00f5ff'
            });
        }

        // Update collectibles
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const c = this.collectibles[i];
            c.x += c.vx * dt;
            c.y += c.vy * dt;
            c.pulse += 0.1 * dt;
            c.lifetime += dt;

            // Check collection
            const dx = this.player.x - c.x;
            const dy = this.player.y - c.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.player.radius + c.radius) {
                this.collectItem(c);
                this.collectibles.splice(i, 1);
                continue;
            }

            // Remove if out of bounds
            if (c.x < -50 || c.x > this.canvas.width + 50 ||
                c.y < -50 || c.y > this.canvas.height + 50 ||
                c.lifetime > 600) {
                this.collectibles.splice(i, 1);
            }
        }

        // Update black holes
        for (let i = this.blackHoles.length - 1; i >= 0; i--) {
            const hole = this.blackHoles[i];
            hole.rotation += 0.02 * dt;
            hole.lifetime += dt;
            hole.shootTimer += dt;

            // Shoot bullets
            if (hole.shootTimer >= hole.shootInterval) {
                hole.shootTimer = 0;
                hole.shootInterval = 100 + Math.random() * 80 - (this.level * 5); // Faster at higher levels
                hole.shootInterval = Math.max(40, hole.shootInterval);
                this.spawnBullet(hole);
            }

            if (hole.lifetime > hole.maxLifetime) {
                this.blackHoles.splice(i, 1);
            }
        }

        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];

            // Store trail
            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > 10) b.trail.shift();

            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;

            // Check collision with player
            if (this.player) {
                const dx = this.player.x - b.x;
                const dy = this.player.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < this.player.radius + b.radius && !this.player.invincible) {
                    this.createExplosion(b.x, b.y, 15, '#ff3366');
                    this.bullets.splice(i, 1);
                    if (this.takeDamage()) {
                        this.gameOver();
                        return;
                    }
                    continue;
                }
            }

            // Remove if out of bounds or expired
            if (b.life <= 0 ||
                b.x < -50 || b.x > this.canvas.width + 50 ||
                b.y < -50 || b.y > this.canvas.height + 50) {
                this.bullets.splice(i, 1);
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.life -= p.decay * dt;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update trail particles
        for (let i = this.trailParticles.length - 1; i >= 0; i--) {
            const p = this.trailParticles[i];
            p.life -= 0.05 * dt;
            p.radius *= 0.95;

            if (p.life <= 0) {
                this.trailParticles.splice(i, 1);
            }
        }

        // Spawning
        this.spawnTimer += dt;
        this.difficultyTimer += dt;

        if (this.spawnTimer > 60) {
            this.spawnTimer = 0;
            this.spawnCollectible();

            if (Math.random() < 0.3 + (this.level * 0.05)) {
                this.spawnCollectible();
            }
        }

        // Spawn black holes based on level
        if (this.blackHoles.length < Math.min(3 + Math.floor(this.level / 2), 8)) {
            if (Math.random() < 0.005 * this.level) {
                this.spawnBlackHole();
            }
        }

        // Increase difficulty over time
        if (this.difficultyTimer > 1800) { // Every 30 seconds at 60fps
            this.difficultyTimer = 0;
            this.level++;
            this.multiplier = Math.min(this.multiplier + 0.5, 10);

            // Level up effect
            this.createExplosion(this.player.x, this.player.y, 20, '#8b5cf6');
        }

        // Update bot AI
        this.updateBot();

        // Update HUD
        this.updateHUD();
    }

    collectItem(item) {
        const basePoints = 100;

        switch (item.type) {
            case 'energy':
                this.energy = Math.min(100, this.energy + 30);
                this.score += Math.floor(basePoints * 0.5 * this.multiplier);
                this.createExplosion(item.x, item.y, 10, '#00ff88');
                break;

            case 'points':
                this.score += Math.floor(basePoints * this.multiplier);
                // Award 1-3 coins
                const coinsEarned = Math.floor(Math.random() * 3) + 1;
                this.addCoins(coinsEarned);
                this.createExplosion(item.x, item.y, 10, '#ffff00');
                break;

            case 'multiplier':
                this.multiplier = Math.min(this.multiplier + 0.5, 10);
                this.score += Math.floor(basePoints * 0.75 * this.multiplier);
                this.createExplosion(item.x, item.y, 15, '#ff00ff');
                break;

            case 'shield':
                this.player.invincible = true;
                this.player.invincibleTimer = 180; // 3 seconds at 60fps
                this.score += Math.floor(basePoints * 0.5 * this.multiplier);
                this.createExplosion(item.x, item.y, 20, '#00f5ff');
                break;
        }
    }

    updateHUD() {
        this.scoreEl.textContent = this.score;
        this.levelEl.textContent = this.level;
        this.multiplierEl.textContent = `x${this.multiplier.toFixed(1)}`;
        this.energyFill.style.width = `${this.energy}%`;
    }

    render() {
        const ctx = this.ctx;

        // Clear canvas
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw stars
        this.renderStars();

        if (!this.isRunning && !this.gameOverScreen.classList.contains('hidden')) {
            return; // Still render stars on game over
        }

        // Draw black holes
        for (const hole of this.blackHoles) {
            this.renderBlackHole(hole);
        }

        // Draw trail particles
        for (const p of this.trailParticles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color + Math.floor(p.life * 80).toString(16).padStart(2, '0');
            ctx.fill();
        }

        // Draw collectibles
        for (const c of this.collectibles) {
            this.renderCollectible(c);
        }

        // Draw particles
        for (const p of this.particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
            ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, '0');
            ctx.fill();
        }

        // Draw bullets
        for (const b of this.bullets) {
            this.renderBullet(b);
        }

        // Draw player
        if (this.player && this.isRunning) {
            this.renderPlayer();
        }

        // Draw bot indicator
        if (this.botEnabled && this.isRunning) {
            ctx.fillStyle = 'rgba(0, 255, 136, 0.8)';
            ctx.font = '14px Orbitron, sans-serif';
            ctx.fillText('🤖 БОТ АКТИВЕН', 20, this.canvas.height - 20);
        }
    }

    renderBullet(b) {
        const ctx = this.ctx;

        // Draw trail
        if (b.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(b.trail[0].x, b.trail[0].y);
            for (let i = 1; i < b.trail.length; i++) {
                ctx.lineTo(b.trail[i].x, b.trail[i].y);
            }
            ctx.strokeStyle = 'rgba(255, 51, 102, 0.3)';
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // Glow
        const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 3);
        gradient.addColorStop(0, 'rgba(255, 51, 102, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 51, 102, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 51, 102, 0)');

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ff3366';
        ctx.fill();

        // Inner bright core
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }

    renderStars() {
        const ctx = this.ctx;
        const time = performance.now() * 0.001;

        for (const star of this.stars) {
            const twinkle = Math.sin(time * star.twinkleSpeed * 10 + star.brightness * 100) * 0.3 + 0.7;
            const alpha = star.brightness * twinkle;

            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fill();
        }
    }

    renderBlackHole(hole) {
        const ctx = this.ctx;
        const fadeIn = Math.min(1, hole.lifetime / 60);
        const fadeOut = Math.min(1, (hole.maxLifetime - hole.lifetime) / 60);
        const alpha = fadeIn * fadeOut;

        // Gravitational distortion effect (rings)
        ctx.save();
        ctx.translate(hole.x, hole.y);
        ctx.rotate(hole.rotation);

        // Outer warning zone
        const gradient = ctx.createRadialGradient(0, 0, hole.radius, 0, 0, hole.pullRadius);
        gradient.addColorStop(0, `rgba(139, 92, 246, ${0.3 * alpha})`);
        gradient.addColorStop(0.5, `rgba(139, 92, 246, ${0.1 * alpha})`);
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

        ctx.beginPath();
        ctx.arc(0, 0, hole.pullRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Accretion disk
        for (let i = 0; i < 3; i++) {
            const ringRadius = hole.radius * (1.2 + i * 0.3);
            ctx.beginPath();
            ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 0, 255, ${(0.5 - i * 0.15) * alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Event horizon
        const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, hole.radius);
        coreGradient.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
        coreGradient.addColorStop(0.7, `rgba(20, 0, 30, ${alpha})`);
        coreGradient.addColorStop(1, `rgba(139, 92, 246, ${0.8 * alpha})`);

        ctx.beginPath();
        ctx.arc(0, 0, hole.radius, 0, Math.PI * 2);
        ctx.fillStyle = coreGradient;
        ctx.fill();

        ctx.restore();
    }

    renderCollectible(c) {
        const ctx = this.ctx;
        const pulse = Math.sin(c.pulse) * 0.2 + 1;
        const radius = c.radius * pulse;

        let color, glowColor;
        switch (c.type) {
            case 'energy':
                color = '#00ff88';
                glowColor = 'rgba(0, 255, 136, 0.5)';
                break;
            case 'points':
                color = '#ffff00';
                glowColor = 'rgba(255, 255, 0, 0.5)';
                break;
            case 'multiplier':
                color = '#ff00ff';
                glowColor = 'rgba(255, 0, 255, 0.5)';
                break;
            case 'shield':
                color = '#00f5ff';
                glowColor = 'rgba(0, 245, 255, 0.5)';
                break;
        }

        // Glow
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = glowColor;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Inner highlight
        ctx.beginPath();
        ctx.arc(c.x - radius * 0.3, c.y - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();
    }

    renderPlayer() {
        const ctx = this.ctx;
        const p = this.player;

        ctx.save();
        ctx.translate(p.x, p.y);
        // Rotate to face movement direction (ship points right by default)
        ctx.rotate(p.angle);

        // Shield effect when invincible
        if (p.invincible) {
            const shieldPulse = Math.sin(performance.now() * 0.01) * 0.2 + 0.8;
            ctx.beginPath();
            ctx.arc(0, 0, p.radius * 2.5 * shieldPulse, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 245, 255, ${shieldPulse * 0.5})`;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Shield glow
            const shieldGlow = ctx.createRadialGradient(0, 0, p.radius * 1.5, 0, 0, p.radius * 2.5);
            shieldGlow.addColorStop(0, 'rgba(0, 245, 255, 0)');
            shieldGlow.addColorStop(1, `rgba(0, 245, 255, ${shieldPulse * 0.2})`);
            ctx.fillStyle = shieldGlow;
            ctx.fill();
        }

        // Draw sprite if loaded, otherwise fallback to geometric ship
        if (this.spriteLoaded) {
            const size = p.radius * 4; // Sprite size

            // Glow effect behind sprite
            const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.6);
            const glowColor = p.boosting ? 'rgba(255, 0, 255, ' : 'rgba(0, 245, 255, ';
            glowGradient.addColorStop(0, glowColor + '0.4)');
            glowGradient.addColorStop(0.5, glowColor + '0.1)');
            glowGradient.addColorStop(1, glowColor + '0)');

            ctx.beginPath();
            ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = glowGradient;
            ctx.fill();

            // Boost effect - brighter glow
            if (p.boosting) {
                const boostGlow = ctx.createRadialGradient(0, size * 0.3, 0, 0, size * 0.3, size * 0.4);
                boostGlow.addColorStop(0, 'rgba(0, 245, 255, 0.8)');
                boostGlow.addColorStop(0.5, 'rgba(255, 0, 255, 0.4)');
                boostGlow.addColorStop(1, 'rgba(255, 0, 255, 0)');
                ctx.beginPath();
                ctx.arc(0, size * 0.3, size * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = boostGlow;
                ctx.fill();
            }

            // Draw the spaceship sprite with blend mode to hide dark background
            ctx.globalCompositeOperation = 'lighten';
            ctx.drawImage(this.spaceshipSprite, -size / 2, -size / 2, size, size);
            ctx.globalCompositeOperation = 'source-over';
        } else {
            // Fallback: geometric ship with ship-specific colors
            const shipColor = p.color || '#00f5ff';
            const boostColor = p.boostColor || '#ff00ff';

            const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.radius * 2);
            const glowColorStr = p.boosting ? boostColor : shipColor;
            glowGradient.addColorStop(0, glowColorStr + '80'); // 50% alpha
            glowGradient.addColorStop(1, glowColorStr + '00'); // 0% alpha

            ctx.beginPath();
            ctx.arc(0, 0, p.radius * 2, 0, Math.PI * 2);
            ctx.fillStyle = glowGradient;
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(p.radius * 1.5, 0);
            ctx.lineTo(-p.radius, p.radius * 0.8);
            ctx.lineTo(-p.radius * 0.5, 0);
            ctx.lineTo(-p.radius, -p.radius * 0.8);
            ctx.closePath();

            const bodyGradient = ctx.createLinearGradient(-p.radius, 0, p.radius, 0);
            bodyGradient.addColorStop(0, p.boosting ? boostColor : shipColor);
            bodyGradient.addColorStop(1, '#ffffff');

            ctx.fillStyle = bodyGradient;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(p.radius * 0.3, 0, p.radius * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }

        ctx.restore();
    }

    gameLoop() {
        if (!this.isRunning || this.isPaused) return;

        const now = performance.now();
        this.deltaTime = Math.min(now - this.lastTime, 50); // Cap delta to prevent spiral of death
        this.lastTime = now;

        this.update();
        this.render();

        requestAnimationFrame(() => this.gameLoop());
    }

    animateBackground() {
        if (!this.isRunning) {
            this.render();
        }
        requestAnimationFrame(() => this.animateBackground());
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Game();
});

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 400,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 500 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let player;
let playerContainer;
let ground;
let obstacles;
let coins;
let powerups;
let scoreText;
let coinText;
let gameOverText;
let restartText;
let activeEffectText;
let shieldVisual;

let score = 0;
let coinCount = 0;
let gameSpeed = 5;
let isGameOver = false;
let obstacleTimer;
let isJumping = false;
let isInvincible = false;
let canRestart = false;
let hasJumpedThisPress = false;

let hasShield = false;
let hasMagnet = false;
let hasDoubleScore = false;
let magnetTimer = null;
let doubleScoreTimer = null;

function preload() {
}

function create() {
    const background = this.add.rectangle(400, 200, 800, 400, 0x87CEEB);
    
    const sun = this.add.circle(700, 80, 40, 0xFFD700);
    
    for (let i = 0; i < 3; i++) {
        drawCloud(this, 150 + i * 250, 60 + i * 30);
    }
    
    ground = this.add.rectangle(400, 370, 800, 60, 0x8B4513);
    this.physics.add.existing(ground, true);
    
    const grass = this.add.rectangle(400, 345, 800, 10, 0x228B22);
    
    playerContainer = this.add.container(100, 300);
    
    player = this.add.rectangle(0, 0, 40, 50, 0xFF6347);
    const eye = this.add.circle(10, -10, 5, 0x000000);
    
    shieldVisual = this.add.ellipse(0, 0, 55, 65, 0x00BFFF, 0.4);
    shieldVisual.setVisible(false);
    
    playerContainer.add([player, eye, shieldVisual]);
    
    this.physics.add.existing(playerContainer);
    playerContainer.body.setCollideWorldBounds(true);
    playerContainer.body.setBounce(0);
    playerContainer.body.setSize(40, 50);
    
    this.physics.add.collider(playerContainer, ground, land, null, this);
    
    obstacles = this.physics.add.group();
    coins = this.physics.add.group();
    powerups = this.physics.add.group();
    
    this.physics.add.collider(playerContainer, obstacles, hitObstacle, null, this);
    this.physics.add.overlap(playerContainer, coins, collectCoin, null, this);
    this.physics.add.overlap(playerContainer, powerups, collectPowerup, null, this);
    
    scoreText = this.add.text(20, 20, '距离: 0', {
        fontSize: '20px',
        fill: '#000',
        fontWeight: 'bold'
    });
    
    coinText = this.add.text(20, 50, '💰: 0', {
        fontSize: '20px',
        fill: '#FFD700',
        fontWeight: 'bold'
    });
    
    activeEffectText = this.add.text(600, 20, '', {
        fontSize: '16px',
        fill: '#FFF',
        fontWeight: 'bold',
        backgroundColor: '#333',
        padding: { x: 10, y: 5 }
    });
    activeEffectText.setVisible(false);
    
    gameOverText = this.add.text(400, 150, '游戏结束!', {
        fontSize: '48px',
        fill: '#FF0000',
        fontWeight: 'bold'
    });
    gameOverText.setOrigin(0.5);
    gameOverText.setVisible(false);
    
    restartText = this.add.text(400, 220, '点击鼠标重新开始', {
        fontSize: '24px',
        fill: '#000',
        fontWeight: 'bold'
    });
    restartText.setOrigin(0.5);
    restartText.setVisible(false);
    
    this.input.on('pointerdown', handlePointerDown, this);
    this.input.on('pointerup', handlePointerUp, this);
    
    obstacleTimer = this.time.addEvent({
        delay: 1500,
        callback: spawnObstacle,
        callbackScope: this,
        loop: true
    });
    
    this.time.addEvent({
        delay: 800,
        callback: spawnCoin,
        callbackScope: this,
        loop: true
    });
    
    this.time.addEvent({
        delay: 5000,
        callback: spawnPowerup,
        callbackScope: this,
        loop: true
    });
}

function update() {
    if (isGameOver) return;
    
    const scoreMultiplier = hasDoubleScore ? 2 : 1;
    score += gameSpeed * 0.1 * scoreMultiplier;
    scoreText.setText('距离: ' + Math.floor(score));
    
    if (score > 0 && score % 500 < 1) {
        gameSpeed += 0.5;
        obstacleTimer.delay = Math.max(800, obstacleTimer.delay - 50);
    }
    
    Phaser.Actions.IncX(obstacles.getChildren(), -gameSpeed);
    Phaser.Actions.IncX(coins.getChildren(), -gameSpeed);
    Phaser.Actions.IncX(powerups.getChildren(), -gameSpeed);
    
    if (hasMagnet) {
        coins.getChildren().forEach(coin => {
            const distance = Phaser.Math.Distance.Between(
                playerContainer.x, playerContainer.y,
                coin.x, coin.y
            );
            if (distance < 150) {
                const angle = Phaser.Math.Angle.Between(
                    coin.x, coin.y,
                    playerContainer.x, playerContainer.y
                );
                coin.x += Math.cos(angle) * 8;
                coin.y += Math.sin(angle) * 8;
            }
        });
    }
    
    obstacles.getChildren().forEach(obstacle => {
        if (obstacle.x < -50) obstacle.destroy();
    });
    coins.getChildren().forEach(coin => {
        if (coin.x < -50) coin.destroy();
    });
    powerups.getChildren().forEach(powerup => {
        if (powerup.x < -50) powerup.destroy();
    });
    
    updateActiveEffectUI.call(this);
}

function updateActiveEffectUI() {
    const effects = [];
    if (hasShield) effects.push('🛡️ 护盾');
    if (hasMagnet) effects.push(`🧲 磁铁 ${Math.ceil(magnetTimer ? (magnetTimer.delay - magnetTimer.getElapsed()) / 1000 : 0)}s`);
    if (hasDoubleScore) effects.push(`✨ 双倍 ${Math.ceil(doubleScoreTimer ? (doubleScoreTimer.delay - doubleScoreTimer.getElapsed()) / 1000 : 0)}s`);
    
    if (effects.length > 0) {
        activeEffectText.setText(effects.join(' | '));
        activeEffectText.setVisible(true);
    } else {
        activeEffectText.setVisible(false);
    }
}

function handlePointerDown(pointer) {
    if (isGameOver) {
        if (canRestart) {
            restartGame.call(this);
        }
        return;
    }
    
    if (!isJumping && !hasJumpedThisPress) {
        playerContainer.body.setVelocityY(-350);
        isJumping = true;
        hasJumpedThisPress = true;
    }
}

function handlePointerUp(pointer) {
    hasJumpedThisPress = false;
}

function land(playerContainer, ground) {
    isJumping = false;
}

function spawnObstacle() {
    if (isGameOver) return;
    
    const obstacleHeight = Phaser.Math.Between(30, 60);
    const obstacle = this.add.rectangle(850, 370 - obstacleHeight / 2, 30, obstacleHeight, 0x2F4F4F);
    this.physics.add.existing(obstacle);
    obstacle.body.setImmovable(true);
    obstacle.body.allowGravity = false;
    obstacles.add(obstacle);
}

function spawnCoin() {
    if (isGameOver) return;
    if (Phaser.Math.Between(0, 100) > 70) return;
    
    const y = Phaser.Math.Between(150, 320);
    const coin = this.add.circle(850, y, 10, 0xFFD700);
    coin.setStrokeStyle(2, 0xFFA500);
    this.physics.add.existing(coin);
    coin.body.allowGravity = false;
    coins.add(coin);
}

function spawnPowerup() {
    if (isGameOver) return;
    if (Phaser.Math.Between(0, 100) > 40) return;
    
    const types = ['magnet', 'shield', 'double'];
    const type = types[Phaser.Math.Between(0, 2)];
    const y = Phaser.Math.Between(150, 300);
    
    let color, symbol;
    switch (type) {
        case 'magnet':
            color = 0xFF00FF;
            symbol = '🧲';
            break;
        case 'shield':
            color = 0x00BFFF;
            symbol = '🛡️';
            break;
        case 'double':
            color = 0xFFFF00;
            symbol = '✨';
            break;
    }
    
    const powerup = this.add.container(850, y);
    const bg = this.add.circle(0, 0, 18, color, 0.7);
    bg.setStrokeStyle(2, 0xFFFFFF);
    const icon = this.add.text(0, 0, symbol, { fontSize: '18px' });
    icon.setOrigin(0.5);
    powerup.add([bg, icon]);
    
    powerup.type = type;
    
    this.physics.add.existing(powerup);
    powerup.body.allowGravity = false;
    powerup.body.setSize(36, 36);
    powerups.add(powerup);
}

function collectCoin(player, coin) {
    coin.destroy();
    coinCount++;
    coinText.setText('💰: ' + coinCount);
}

function collectPowerup(player, powerup) {
    const type = powerup.type;
    powerup.destroy();
    
    switch (type) {
        case 'magnet':
            activateMagnet.call(this);
            break;
        case 'shield':
            activateShield();
            break;
        case 'double':
            activateDoubleScore.call(this);
            break;
    }
}

function activateMagnet() {
    hasMagnet = true;
    if (magnetTimer) magnetTimer.remove();
    magnetTimer = this.time.delayedCall(5000, function() {
        hasMagnet = false;
    }, [], this);
}

function activateShield() {
    hasShield = true;
    shieldVisual.setVisible(true);
}

function activateDoubleScore() {
    hasDoubleScore = true;
    if (doubleScoreTimer) doubleScoreTimer.remove();
    doubleScoreTimer = this.time.delayedCall(5000, function() {
        hasDoubleScore = false;
    }, [], this);
}

function hitObstacle(player, obstacle) {
    if (isInvincible) return;
    
    if (hasShield) {
        hasShield = false;
        shieldVisual.setVisible(false);
        
        isInvincible = true;
        this.tweens.add({
            targets: playerContainer,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 5,
            onComplete: function() {
                isInvincible = false;
                playerContainer.alpha = 1;
            }
        });
        return;
    }
    
    if (score > 100) {
        isInvincible = true;
        
        this.tweens.add({
            targets: playerContainer,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 9,
            onComplete: function() {
                isInvincible = false;
                playerContainer.alpha = 1;
            }
        });
        
        return;
    }
    
    isGameOver = true;
    this.physics.pause();
    playerContainer.alpha = 0.5;
    
    gameOverText.setVisible(true);
    
    this.time.delayedCall(500, function() {
        restartText.setVisible(true);
        canRestart = true;
    }, [], this);
    
    obstacleTimer.paused = true;
}

function restartGame() {
    isGameOver = false;
    score = 0;
    coinCount = 0;
    gameSpeed = 5;
    isJumping = false;
    isInvincible = false;
    canRestart = false;
    hasJumpedThisPress = false;
    
    hasShield = false;
    hasMagnet = false;
    hasDoubleScore = false;
    if (magnetTimer) magnetTimer.remove();
    if (doubleScoreTimer) doubleScoreTimer.remove();
    
    this.physics.resume();
    playerContainer.alpha = 1;
    shieldVisual.setVisible(false);
    
    obstacles.clear(true, true);
    coins.clear(true, true);
    powerups.clear(true, true);
    
    scoreText.setText('距离: 0');
    coinText.setText('💰: 0');
    gameOverText.setVisible(false);
    restartText.setVisible(false);
    activeEffectText.setVisible(false);
    
    obstacleTimer.paused = false;
    obstacleTimer.delay = 1500;
}

function drawCloud(scene, x, y) {
    const cloudGroup = scene.add.group();
    cloudGroup.add(scene.add.circle(x, y, 20, 0xFFFFFF));
    cloudGroup.add(scene.add.circle(x + 25, y - 10, 25, 0xFFFFFF));
    cloudGroup.add(scene.add.circle(x + 50, y, 20, 0xFFFFFF));
    cloudGroup.add(scene.add.circle(x + 25, y + 5, 18, 0xFFFFFF));
}

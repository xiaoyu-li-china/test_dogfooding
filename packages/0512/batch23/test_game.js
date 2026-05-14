const { chromium } = require('playwright');

async function testBalloonGame() {
    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log('🚀 启动打气球游戏测试...');
        
        await page.goto('http://localhost:8080');
        await page.waitForLoadState('networkidle');
        console.log('✅ 游戏页面加载完成');

        await page.waitForTimeout(1000);

        const initialScore = await page.textContent('#score');
        console.log(`🎯 初始得分: ${initialScore}`);

        const initialTime = await page.textContent('#timer');
        console.log(`⏱️ 初始时间: ${initialTime}`);

        console.log('\n🎈 开始模拟点击气球...');
        
        let clickCount = 0;
        const maxClicks = 20;
        let lastScore = parseInt(initialScore || '0');
        
        for (let i = 0; i < maxClicks; i++) {
            const canvas = await page.$('#gameCanvas');
            if (!canvas) {
                console.log('❌ 找不到 canvas 元素');
                break;
            }

            const box = await canvas.boundingBox();
            if (!box) {
                console.log('❌ 无法获取 canvas 位置');
                break;
            }

            const x = box.x + box.width * 0.2 + Math.random() * box.width * 0.6;
            const y = box.y + box.height * 0.4 + Math.random() * box.height * 0.45;

            await page.mouse.click(x, y);
            clickCount++;

            await page.waitForTimeout(200);

            const currentScore = await page.textContent('#score');
            const currentScoreNum = parseInt(currentScore || '0');
            const hit = currentScoreNum !== lastScore;
            lastScore = currentScoreNum;
            
            console.log(`  点击 ${clickCount}/${maxClicks} - 得分: ${currentScore} ${hit ? '🎯命中!' : ''}`);
        }

        const finalScore = parseInt(await page.textContent('#score') || '0');
        const initialScoreNum = parseInt(initialScore || '0');
        
        if (finalScore > initialScoreNum) {
            console.log(`✅ 分数验证通过: ${initialScoreNum} -> ${finalScore} (增加了 ${finalScore - initialScoreNum} 分)`);
        } else {
            console.log(`⚠️  分数未增加: ${initialScoreNum} -> ${finalScore}`);
        }

        console.log('\n⏱️ 等待游戏倒计时结束...');
        
        const startTime = Date.now();
        const timeout = 70000;
        
        while (Date.now() - startTime < timeout) {
            const currentTime = await page.textContent('#timer');
            const timeLeft = parseInt(currentTime || '60');
            console.log(`  剩余时间: ${timeLeft} 秒`);

            const gameOverlay = await page.$('.game-over-overlay.active');
            if (gameOverlay) {
                console.log('✅ 游戏结束界面已显示');
                break;
            }

            if (timeLeft <= 0) {
                await page.waitForTimeout(1000);
                break;
            }

            await page.waitForTimeout(3000);
        }

        const finalGameScore = await page.textContent('#finalScore');
        console.log(`\n🏆 游戏最终得分: ${finalGameScore}`);

        const gameOverVisible = await page.isVisible('.game-over-overlay.active');
        if (gameOverVisible) {
            console.log('✅ 游戏结束验证通过: 倒计时结束后游戏停止');
        } else {
            console.log('❌ 游戏结束验证失败');
        }

        console.log('\n🔄 测试"再来一局"按钮...');
        await page.click('#playAgainBtn');
        await page.waitForTimeout(500);

        const newScore = await page.textContent('#score');
        const newTime = await page.textContent('#timer');
        const newTimeNum = parseInt(newTime || '0');
        
        if (newScore === '0' && newTimeNum >= 58 && newTimeNum <= 60) {
            console.log(`✅ 再来一局验证通过: 分数重置为 0，时间重置为 ${newTime}`);
        } else {
            console.log(`⚠️  再来一局验证失败: 分数=${newScore}, 时间=${newTime}`);
        }

        console.log('\n🎉 所有测试完成!');

    } catch (error) {
        console.error('❌ 测试过程中出错:', error);
    } finally {
        await page.waitForTimeout(3000);
        await browser.close();
    }
}

testBalloonGame();

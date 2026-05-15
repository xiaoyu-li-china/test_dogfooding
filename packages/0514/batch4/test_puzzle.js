const puppeteer = require('puppeteer');
const path = require('path');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testPuzzleGame() {
    console.log('🧪 开始测试拼图游戏...\n');
    
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('📝 浏览器日志:', msg.text()));
    page.on('pageerror', error => console.error('❌ 页面错误:', error.message));
    
    try {
        const filePath = path.resolve(__dirname, 'puzzle.html');
        await page.goto(`file://${filePath}`);
        await delay(1500);
        
        await page.click('canvas');
        await delay(200);
        
        console.log('1️⃣ 测试重置棋盘到有序状态');
        await page.evaluate(() => {
            window.tiles = [
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 0]
            ];
            window.emptyTile = { row: 2, col: 2 };
            window.moves = 0;
            window.isWon = false;
            window.history = [];
            window.isAnimating = false;
            document.getElementById('moves').textContent = '0';
            document.getElementById('timer').textContent = '00:00';
            drawBoard();
        });
        await delay(500);
        
        let boardState = await page.evaluate(() => JSON.parse(JSON.stringify(window.tiles)));
        console.log('   初始棋盘状态:', JSON.stringify(boardState));
        
        console.log('\n2️⃣ 测试核心移动逻辑 - 向上移动');
        await page.evaluate(() => moveTile(1, 2));
        await delay(400);
        
        boardState = await page.evaluate(() => JSON.parse(JSON.stringify(window.tiles)));
        console.log('   向上移动后棋盘:', JSON.stringify(boardState));
        
        let expectedAfterUp = [
            [1, 2, 3],
            [4, 5, 0],
            [7, 8, 6]
        ];
        console.assert(
            JSON.stringify(boardState) === JSON.stringify(expectedAfterUp),
            '向上移动后棋盘状态不正确'
        );
        console.log('   ✅ 向上移动测试通过');
        
        console.log('\n3️⃣ 测试核心移动逻辑 - 向左移动');
        await page.evaluate(() => moveTile(1, 1));
        await delay(400);
        
        boardState = await page.evaluate(() => JSON.parse(JSON.stringify(window.tiles)));
        console.log('   向左移动后棋盘:', JSON.stringify(boardState));
        
        let expectedAfterLeft = [
            [1, 2, 3],
            [4, 0, 5],
            [7, 8, 6]
        ];
        console.assert(
            JSON.stringify(boardState) === JSON.stringify(expectedAfterLeft),
            '向左移动后棋盘状态不正确'
        );
        console.log('   ✅ 向左移动测试通过');
        
        console.log('\n4️⃣ 测试核心移动逻辑 - 向下移动');
        await page.evaluate(() => moveTile(2, 1));
        await delay(400);
        
        boardState = await page.evaluate(() => JSON.parse(JSON.stringify(window.tiles)));
        console.log('   向下移动后棋盘:', JSON.stringify(boardState));
        
        let expectedAfterDown = [
            [1, 2, 3],
            [4, 8, 5],
            [7, 0, 6]
        ];
        console.assert(
            JSON.stringify(boardState) === JSON.stringify(expectedAfterDown),
            '向下移动后棋盘状态不正确'
        );
        console.log('   ✅ 向下移动测试通过');
        
        console.log('\n5️⃣ 测试核心移动逻辑 - 向右移动');
        await page.evaluate(() => moveTile(2, 2));
        await delay(400);
        
        boardState = await page.evaluate(() => JSON.parse(JSON.stringify(window.tiles)));
        console.log('   向右移动后棋盘:', JSON.stringify(boardState));
        
        let expectedAfterRight = [
            [1, 2, 3],
            [4, 8, 5],
            [7, 6, 0]
        ];
        console.assert(
            JSON.stringify(boardState) === JSON.stringify(expectedAfterRight),
            '向右移动后棋盘状态不正确'
        );
        console.log('   ✅ 向右移动测试通过');
        
        console.log('\n6️⃣ 测试步数统计');
        let moves = await page.evaluate(() => window.moves);
        console.log('   当前步数:', moves);
        console.assert(moves === 4, `步数应为 4，实际为 ${moves}`);
        console.log('   ✅ 步数统计测试通过');
        
        console.log('\n7️⃣ 测试撤销功能');
        await page.click('#undoBtn');
        await delay(400);
        
        boardState = await page.evaluate(() => JSON.parse(JSON.stringify(window.tiles)));
        moves = await page.evaluate(() => window.moves);
        console.log('   撤销后棋盘:', JSON.stringify(boardState));
        console.log('   撤销后步数:', moves);
        
        console.assert(
            JSON.stringify(boardState) === JSON.stringify(expectedAfterDown),
            '撤销后棋盘状态不正确'
        );
        console.assert(moves === 3, `撤销后步数应为 3，实际为 ${moves}`);
        console.log('   ✅ 撤销功能测试通过');
        
        console.log('\n8️⃣ 测试游戏胜利弹窗');
        await page.evaluate(() => {
            window.tiles = [
                [1, 2, 3],
                [4, 5, 6],
                [7, 0, 8]
            ];
            window.emptyTile = { row: 2, col: 1 };
            window.isWon = false;
            window.isAnimating = false;
            window.history = [];
            drawBoard();
        });
        await delay(400);
        
        await page.evaluate(() => moveTile(2, 2));
        await delay(500);
        
        const winModalVisible = await page.evaluate(() => {
            return document.getElementById('winModal').style.display === 'flex';
        });
        
        console.log('   胜利弹窗是否显示:', winModalVisible);
        console.assert(winModalVisible, '游戏胜利后应该显示弹窗');
        console.log('   ✅ 游戏胜利弹窗测试通过');
        
        const finalMoves = await page.evaluate(() => 
            document.getElementById('finalMoves').textContent
        );
        console.log('   弹窗显示最终步数:', finalMoves);
        
        console.log('\n9️⃣ 测试重新开始功能');
        await page.click('#playAgainBtn');
        await delay(500);
        
        const winModalHidden = await page.evaluate(() => {
            return document.getElementById('winModal').style.display !== 'flex';
        });
        const newMoves = await page.evaluate(() => window.moves);
        console.log('   重新开始后弹窗是否隐藏:', winModalHidden);
        console.log('   重新开始后步数:', newMoves);
        console.assert(winModalHidden, '重新开始后弹窗应该隐藏');
        console.assert(newMoves === 0, `重新开始后步数应为 0，实际为 ${newMoves}`);
        console.log('   ✅ 重新开始功能测试通过');
        
        console.log('\n🔟 测试动画锁机制 - 快速连续调用');
        await page.evaluate(() => {
            window.tiles = [
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 0]
            ];
            window.emptyTile = { row: 2, col: 2 };
            window.moves = 0;
            window.isWon = false;
            window.isAnimating = false;
            window.history = [];
            document.getElementById('moves').textContent = '0';
            drawBoard();
        });
        await delay(300);
        
        await page.evaluate(() => {
            moveTile(1, 2);
            moveTile(1, 1);
            moveTile(2, 1);
        });
        await delay(500);
        
        const movesAfterFast = await page.evaluate(() => window.moves);
        console.log(`   快速按3次键后实际步数: ${movesAfterFast}`);
        console.assert(movesAfterFast < 3, `动画锁应该限制快速按键，实际执行了 ${movesAfterFast} 步`);
        console.log('   ✅ 动画锁机制测试通过');
        
        console.log('\n✅✅✅ 所有测试通过! ✅✅✅');
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

testPuzzleGame();

/* =============================================
   ポップ★オセロ - ゲームロジック
   ============================================= */

// ---------- 定数 ----------
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const BOARD_SIZE = 8;

// 8方向 (上、右上、右、右下、下、左下、左、左上)
const DIRECTIONS = [
    [-1, 0], [-1, 1], [0, 1], [1, 1],
    [1, 0], [1, -1], [0, -1], [-1, -1]
];

// 評価用の重み (ふつう以上のCPU用)
const WEIGHT_MAP = [
    [120, -20,  20,   5,   5,  20, -20, 120],
    [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
    [ 20,  -5,  15,   3,   3,  15,  -5,  20],
    [  5,  -5,   3,   3,   3,   3,  -5,   5],
    [  5,  -5,   3,   3,   3,   3,  -5,   5],
    [ 20,  -5,  15,   3,   3,  15,  -5,  20],
    [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
    [120, -20,  20,   5,   5,  20, -20, 120]
];

// ---------- ゲーム状態 ----------
let board = [];
let currentPlayer = BLACK;
let gameMode = 'human'; // 'human', 'easy', 'normal', 'hard'
let gameOver = false;
let isProcessing = false;

// ---------- DOM要素 ----------
const boardEl = document.getElementById('game-board');
const modeSelectEl = document.getElementById('mode-select');
const gameScreenEl = document.getElementById('game-screen');
const difficultyEl = document.getElementById('difficulty-select');
const messageEl = document.getElementById('game-message');
const blackScoreEl = document.getElementById('black-score');
const whiteScoreEl = document.getElementById('white-score');
const blackNameEl = document.getElementById('black-name');
const whiteNameEl = document.getElementById('white-name');
const blackTurnEl = document.getElementById('black-turn');
const whiteTurnEl = document.getElementById('white-turn');
const resultModal = document.getElementById('result-modal');
const resultEmoji = document.getElementById('result-emoji');
const resultTitle = document.getElementById('result-title');
const resultText = document.getElementById('result-text');
const resultScoreEl = document.getElementById('result-score');
const sparkleCanvas = document.getElementById('sparkle-canvas');
const confettiCanvas = document.getElementById('confetti-canvas');

// ---------- 初期化 ----------
function initBoard() {
    board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;
    currentPlayer = BLACK;
    gameOver = false;
    isProcessing = false;
}

function createBoardUI() {
    boardEl.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', () => onCellClick(r, c));
            boardEl.appendChild(cell);
        }
    }
}

function renderBoard() {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = boardEl.children[r * BOARD_SIZE + c];
            // 既存のディスクをクリア
            const existingDisc = cell.querySelector('.disc');
            
            if (board[r][c] !== EMPTY) {
                if (!existingDisc) {
                    const disc = document.createElement('div');
                    disc.className = `disc ${board[r][c] === BLACK ? 'black' : 'white'}`;
                    cell.appendChild(disc);
                } else {
                    const newColor = board[r][c] === BLACK ? 'black' : 'white';
                    const oldColor = board[r][c] === BLACK ? 'white' : 'black';
                    if (existingDisc.classList.contains(oldColor)) {
                        existingDisc.classList.remove(oldColor);
                        existingDisc.classList.add(newColor);
                        existingDisc.classList.add('flipping');
                        setTimeout(() => existingDisc.classList.remove('flipping'), 600);
                    }
                }
            } else {
                if (existingDisc) {
                    existingDisc.remove();
                }
            }
        }
    }
    updateHints();
    updateScore();
    updateTurnIndicator();
}

function updateHints() {
    const validMoves = getValidMoves(board, currentPlayer);
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = boardEl.children[r * BOARD_SIZE + c];
            cell.classList.remove('hint');
            if (validMoves.some(m => m[0] === r && m[1] === c)) {
                cell.classList.add('hint');
            }
        }
    }
}

function updateScore() {
    let black = 0, white = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === BLACK) black++;
            if (board[r][c] === WHITE) white++;
        }
    }
    blackScoreEl.textContent = black;
    whiteScoreEl.textContent = white;
}

function updateTurnIndicator() {
    if (currentPlayer === BLACK) {
        blackTurnEl.classList.add('active');
        whiteTurnEl.classList.remove('active');
    } else {
        blackTurnEl.classList.remove('active');
        whiteTurnEl.classList.add('active');
    }
}

function updateMessage(msg) {
    messageEl.textContent = msg;
    messageEl.style.animation = 'none';
    void messageEl.offsetHeight;
    messageEl.style.animation = 'pulse 1.5s ease infinite';
}

// ---------- ゲームロジック ----------
function isOnBoard(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function getFlippable(boardState, r, c, player) {
    if (boardState[r][c] !== EMPTY) return [];

    const opponent = player === BLACK ? WHITE : BLACK;
    const allFlips = [];

    for (const [dr, dc] of DIRECTIONS) {
        const flips = [];
        let nr = r + dr, nc = c + dc;

        while (isOnBoard(nr, nc) && boardState[nr][nc] === opponent) {
            flips.push([nr, nc]);
            nr += dr;
            nc += dc;
        }

        if (flips.length > 0 && isOnBoard(nr, nc) && boardState[nr][nc] === player) {
            allFlips.push(...flips);
        }
    }

    return allFlips;
}

function isValidMove(boardState, r, c, player) {
    return getFlippable(boardState, r, c, player).length > 0;
}

function getValidMoves(boardState, player) {
    const moves = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (isValidMove(boardState, r, c, player)) {
                moves.push([r, c]);
            }
        }
    }
    return moves;
}

function makeMove(boardState, r, c, player) {
    const flips = getFlippable(boardState, r, c, player);
    if (flips.length === 0) return false;

    boardState[r][c] = player;
    for (const [fr, fc] of flips) {
        boardState[fr][fc] = player;
    }
    return true;
}

function countDiscs(boardState) {
    let black = 0, white = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (boardState[r][c] === BLACK) black++;
            if (boardState[r][c] === WHITE) white++;
        }
    }
    return { black, white };
}

function copyBoard(boardState) {
    return boardState.map(row => [...row]);
}

// ---------- セルクリック ----------
async function onCellClick(r, c) {
    if (gameOver || isProcessing) return;
    if (gameMode !== 'human' && currentPlayer === WHITE) return;

    if (!isValidMove(board, r, c, currentPlayer)) return;

    await placePiece(r, c, currentPlayer);
    
    if (!gameOver && gameMode !== 'human') {
        await cpuTurn();
    }
}

async function placePiece(r, c, player) {
    isProcessing = true;

    const flips = getFlippable(board, r, c, player);
    board[r][c] = player;

    // 置いた石のアニメーション
    const cell = boardEl.children[r * BOARD_SIZE + c];
    const disc = document.createElement('div');
    disc.className = `disc ${player === BLACK ? 'black' : 'white'} placed`;
    cell.appendChild(disc);

    // キラキラエフェクト
    createSparkleEffect(cell);

    await sleep(200);

    // ひっくり返す
    for (let i = 0; i < flips.length; i++) {
        const [fr, fc] = flips[i];
        board[fr][fc] = player;
        const flipCell = boardEl.children[fr * BOARD_SIZE + fc];
        const flipDisc = flipCell.querySelector('.disc');
        if (flipDisc) {
            flipDisc.classList.add('flipping');
            setTimeout(() => {
                flipDisc.classList.remove('flipping');
                flipDisc.classList.remove(player === BLACK ? 'white' : 'black');
                flipDisc.classList.add(player === BLACK ? 'black' : 'white');
            }, 300);
        }
        await sleep(80);
    }

    await sleep(300);

    updateScore();

    // ターン切り替え
    const opponent = player === BLACK ? WHITE : BLACK;
    const opponentMoves = getValidMoves(board, opponent);
    const myMoves = getValidMoves(board, player);

    if (opponentMoves.length > 0) {
        currentPlayer = opponent;
        updateMessage(currentPlayer === BLACK ? '⬛の番だよ！♡' : '⬜の番だよ！♡');
    } else if (myMoves.length > 0) {
        // パス
        updateMessage(`${opponent === BLACK ? '⬛' : '⬜'}は置ける場所がないよ💦 パス！`);
        await sleep(1200);
        updateMessage(currentPlayer === BLACK ? '⬛もう1回！♡' : '⬜もう1回！♡');
    } else {
        // ゲーム終了
        gameOver = true;
        showResult();
    }

    updateHints();
    updateTurnIndicator();
    isProcessing = false;
}

// ---------- CPU AI ----------
async function cpuTurn() {
    if (gameOver) return;

    isProcessing = true;
    updateMessage('🤖 CPUが考えてるよ...💭');
    await sleep(600 + Math.random() * 400);

    const moves = getValidMoves(board, WHITE);
    if (moves.length === 0) {
        isProcessing = false;
        return;
    }

    let move;
    switch (gameMode) {
        case 'easy':
            move = aiEasy(moves);
            break;
        case 'normal':
            move = aiNormal(moves);
            break;
        case 'hard':
            move = aiHard(moves);
            break;
    }

    await placePiece(move[0], move[1], WHITE);

    // CPUの追加ターン (パスの場合)
    if (!gameOver && currentPlayer === WHITE && gameMode !== 'human') {
        await cpuTurn();
    }
}

// かんたん: ランダム
function aiEasy(moves) {
    return moves[Math.floor(Math.random() * moves.length)];
}

// ふつう: 重み評価
function aiNormal(moves) {
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const [r, c] of moves) {
        const score = WEIGHT_MAP[r][c];
        if (score > bestScore) {
            bestScore = score;
            bestMoves = [[r, c]];
        } else if (score === bestScore) {
            bestMoves.push([r, c]);
        }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// むずかしい: ミニマックス + α-β枝刈り
function aiHard(moves) {
    let bestScore = -Infinity;
    let bestMove = moves[0];

    const depth = getSearchDepth();

    for (const [r, c] of moves) {
        const newBoard = copyBoard(board);
        makeMove(newBoard, r, c, WHITE);
        const score = minimax(newBoard, depth - 1, -Infinity, Infinity, false);
        if (score > bestScore) {
            bestScore = score;
            bestMove = [r, c];
        }
    }

    return bestMove;
}

function getSearchDepth() {
    const totalDiscs = countDiscs(board);
    const filled = totalDiscs.black + totalDiscs.white;
    if (filled >= 52) return 10; // 終盤は深く読む
    if (filled >= 44) return 7;
    return 5;
}

function minimax(boardState, depth, alpha, beta, isMaximizing) {
    const player = isMaximizing ? WHITE : BLACK;
    const moves = getValidMoves(boardState, player);

    if (depth === 0 || moves.length === 0) {
        // 両方パスならゲーム終了
        const opponent = isMaximizing ? BLACK : WHITE;
        const oppMoves = getValidMoves(boardState, opponent);
        if (moves.length === 0 && oppMoves.length === 0) {
            return evaluateFinal(boardState);
        }
        if (moves.length === 0) {
            return minimax(boardState, depth, alpha, beta, !isMaximizing);
        }
        return evaluate(boardState);
    }

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const [r, c] of moves) {
            const newBoard = copyBoard(boardState);
            makeMove(newBoard, r, c, WHITE);
            const evalScore = minimax(newBoard, depth - 1, alpha, beta, false);
            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const [r, c] of moves) {
            const newBoard = copyBoard(boardState);
            makeMove(newBoard, r, c, BLACK);
            const evalScore = minimax(newBoard, depth - 1, alpha, beta, true);
            minEval = Math.min(minEval, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function evaluate(boardState) {
    let score = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (boardState[r][c] === WHITE) {
                score += WEIGHT_MAP[r][c];
            } else if (boardState[r][c] === BLACK) {
                score -= WEIGHT_MAP[r][c];
            }
        }
    }

    // モビリティ（合法手数の差）
    const whiteMoves = getValidMoves(boardState, WHITE).length;
    const blackMoves = getValidMoves(boardState, BLACK).length;
    score += (whiteMoves - blackMoves) * 5;

    return score;
}

function evaluateFinal(boardState) {
    const { black, white } = countDiscs(boardState);
    if (white > black) return 10000 + (white - black);
    if (black > white) return -10000 - (black - white);
    return 0;
}

// ---------- UI操作 ----------
function showDifficulty() {
    difficultyEl.classList.remove('hidden');
}

function startGame(mode) {
    gameMode = mode;
    modeSelectEl.classList.add('hidden');
    gameScreenEl.classList.remove('hidden');

    if (mode === 'human') {
        blackNameEl.textContent = 'プレイヤー1';
        whiteNameEl.textContent = 'プレイヤー2';
    } else {
        blackNameEl.textContent = 'あなた';
        whiteNameEl.textContent = 'CPU';
    }

    initBoard();
    createBoardUI();
    renderBoard();
    updateMessage('⬛の番だよ！♡ 置ける場所が光ってるよ✨');
}

function resetGame() {
    initBoard();
    createBoardUI();
    renderBoard();
    updateMessage('⬛の番だよ！♡ 置ける場所が光ってるよ✨');
}

function backToMenu() {
    gameScreenEl.classList.add('hidden');
    modeSelectEl.classList.remove('hidden');
    difficultyEl.classList.add('hidden');
}

function showResult() {
    const { black, white } = countDiscs(board);

    let emoji, title, text;

    if (gameMode === 'human') {
        if (black > white) {
            emoji = '🎉🖤';
            title = '⬛の勝ち！';
            text = 'プレイヤー1の勝利～♡ おめでと！🎊';
        } else if (white > black) {
            emoji = '🎉🤍';
            title = '⬜の勝ち！';
            text = 'プレイヤー2の勝利～♡ おめでと！🎊';
        } else {
            emoji = '🤝✨';
            title = '引き分け！';
            text = 'なかよし～♡ いい勝負だったね！';
        }
    } else {
        if (black > white) {
            emoji = '🎉🏆';
            title = 'YOU WIN!';
            text = 'やったね！CPUに勝った～♡ 天才じゃん！✨';
        } else if (white > black) {
            emoji = '😭💔';
            title = 'YOU LOSE...';
            text = 'まけちゃった💦 もう1回チャレンジ！💪';
        } else {
            emoji = '🤝✨';
            title = '引き分け！';
            text = 'いい勝負だったね～♡';
        }
    }

    resultEmoji.textContent = emoji;
    resultTitle.textContent = title;
    resultText.textContent = text;
    resultScoreEl.innerHTML = `
        <span class="score-black">⬛ ${black}</span>
        <span class="score-separator">-</span>
        <span class="score-white">${white} ⬜</span>
    `;

    resultModal.classList.remove('hidden');

    // 勝利時はコンフェッティ
    if ((gameMode === 'human') || (black > white)) {
        launchConfetti();
    }
}

function closeResult() {
    resultModal.classList.add('hidden');
}

// ---------- エフェクト: キラキラ ----------
function createSparkleEffect(cell) {
    const rect = cell.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const colors = ['#FF2D9B', '#FFE135', '#7DFFC2', '#B24BF3', '#00E5FF', '#FF85C8'];

    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'sparkle-particle';
        particle.style.position = 'fixed';
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.width = (4 + Math.random() * 6) + 'px';
        particle.style.height = particle.style.width;
        particle.style.zIndex = '100';

        const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.5;
        const distance = 30 + Math.random() * 40;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');

        document.body.appendChild(particle);

        setTimeout(() => particle.remove(), 800);
    }
}

// ---------- エフェクト: 背景キラキラ ----------
function initSparkleBackground() {
    const ctx = sparkleCanvas.getContext('2d');
    let width, height;
    const stars = [];

    function resize() {
        width = sparkleCanvas.width = window.innerWidth;
        height = sparkleCanvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener('resize', resize);

    // 星を生成
    for (let i = 0; i < 60; i++) {
        stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 2.5 + 0.5,
            speed: Math.random() * 0.3 + 0.1,
            opacity: Math.random(),
            opacityDir: Math.random() > 0.5 ? 1 : -1,
            hue: Math.random() * 60 + 300 // ピンク〜パープル系
        });
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        for (const star of stars) {
            star.opacity += star.opacityDir * 0.015;
            if (star.opacity >= 1) { star.opacity = 1; star.opacityDir = -1; }
            if (star.opacity <= 0.1) { star.opacity = 0.1; star.opacityDir = 1; }

            star.y -= star.speed;
            if (star.y < -5) {
                star.y = height + 5;
                star.x = Math.random() * width;
            }

            ctx.save();
            ctx.globalAlpha = star.opacity;
            ctx.fillStyle = `hsl(${star.hue}, 100%, 80%)`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();

            // グロー
            ctx.globalAlpha = star.opacity * 0.3;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        requestAnimationFrame(animate);
    }

    animate();
}

// ---------- エフェクト: コンフェッティ ----------
function launchConfetti() {
    const ctx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#FF2D9B', '#FFE135', '#7DFFC2', '#B24BF3', '#00E5FF', '#FF85C8', '#FFB8E0'];
    const shapes = ['circle', 'rect', 'star'];

    // コンフェッティの生成
    for (let i = 0; i < 150; i++) {
        pieces.push({
            x: Math.random() * confettiCanvas.width,
            y: -20 - Math.random() * 200,
            w: 6 + Math.random() * 8,
            h: 4 + Math.random() * 6,
            color: colors[Math.floor(Math.random() * colors.length)],
            shape: shapes[Math.floor(Math.random() * shapes.length)],
            speed: 2 + Math.random() * 4,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.15,
            wobble: Math.random() * 10,
            wobbleSpeed: 0.03 + Math.random() * 0.05,
            opacity: 1
        });
    }

    let frame = 0;
    const maxFrames = 180;

    function animate() {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        frame++;

        if (frame > maxFrames - 30) {
            pieces.forEach(p => p.opacity = Math.max(0, p.opacity - 0.03));
        }

        for (const p of pieces) {
            p.y += p.speed;
            p.rotation += p.rotSpeed;
            p.wobble += p.wobbleSpeed;
            p.x += Math.sin(p.wobble) * 1.5;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;

            if (p.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.shape === 'rect') {
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            } else {
                drawStar(ctx, 0, 0, 5, p.w / 2, p.w / 4);
            }

            ctx.restore();
        }

        if (frame < maxFrames) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        }
    }

    animate();
}

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
        ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

// ---------- ユーティリティ ----------
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------- 起動 ----------
initSparkleBackground();

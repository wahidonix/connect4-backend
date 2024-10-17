// server.js

const express = require('express');
const cors = require('cors');
const app = express();
const port = 5000;

// Constants
const ROWS = 6;
const COLS = 7;
const MAX_DEPTH = 6; // Adjusted for performance
const NEGASCOUT_DEPTH = 8; // Depth for Negascout

// Middleware
app.use(cors());
app.use(express.json());

// Helper functions

function getValidColumns(board) {
    const validColumns = [];
    for (let col = 0; col < COLS; col++) {
        if (!board[0][col]) {
            validColumns.push(col);
        }
    }
    return validColumns;
}

function isValidMove(board, col) {
    return !board[0][col];
}

function makeMove(board, col, color) {
    for (let row = ROWS - 1; row >= 0; row--) {
        if (!board[row][col]) {
            board[row][col] = { color };
            return true;
        }
    }
    return false;
}

function undoMove(board, col) {
    for (let row = 0; row < ROWS; row++) {
        if (board[row][col]) {
            board[row][col] = null;
            return;
        }
    }
}

function checkWinner(board, color) {
    const directions = [
        { x: 0, y: 1 },   // Vertical
        { x: 1, y: 0 },   // Horizontal
        { x: 1, y: 1 },   // Diagonal \
        { x: 1, y: -1 },  // Diagonal /
    ];

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]?.color !== color) continue;

            for (let { x: dx, y: dy } of directions) {
                let count = 1;
                let r = row + dy;
                let c = col + dx;

                while (
                    r >= 0 && r < ROWS &&
                    c >= 0 && c < COLS &&
                    board[r][c]?.color === color
                ) {
                    count++;
                    if (count === 4) return true;
                    r += dy;
                    c += dx;
                }
            }
        }
    }
    return false;
}

function isTerminalNode(board) {
    return checkWinner(board, 'red') || checkWinner(board, 'yellow') || getValidColumns(board).length === 0;
}

function evaluateBoard(board, color) {
    // Simple heuristic: prefer center, and lines of 2 or 3
    let score = 0;

    // Center column preference
    const centerCol = Math.floor(COLS / 2);
    let centerCount = 0;
    for (let row = 0; row < ROWS; row++) {
        if (board[row][centerCol]?.color === color) {
            centerCount++;
        }
    }
    score += centerCount * 3;

    // Score horizontal
    for (let row = 0; row < ROWS; row++) {
        const rowArray = [];
        for (let col = 0; col < COLS; col++) {
            rowArray.push(board[row][col]);
        }
        score += evaluateArray(rowArray, color);
    }

    // Score vertical
    for (let col = 0; col < COLS; col++) {
        const colArray = [];
        for (let row = 0; row < ROWS; row++) {
            colArray.push(board[row][col]);
        }
        score += evaluateArray(colArray, color);
    }

    // Score positive diagonal
    for (let row = 0; row < ROWS - 3; row++) {
        for (let col = 0; col < COLS - 3; col++) {
            const window = [
                board[row][col],
                board[row + 1][col + 1],
                board[row + 2][col + 2],
                board[row + 3][col + 3],
            ];
            score += evaluateWindow(window, color);
        }
    }

    // Score negative diagonal
    for (let row = 3; row < ROWS; row++) {
        for (let col = 0; col < COLS - 3; col++) {
            const window = [
                board[row][col],
                board[row - 1][col + 1],
                board[row - 2][col + 2],
                board[row - 3][col + 3],
            ];
            score += evaluateWindow(window, color);
        }
    }

    return score;
}

function evaluateArray(array, color) {
    let score = 0;
    for (let col = 0; col < array.length - 3; col++) {
        const window = array.slice(col, col + 4);
        score += evaluateWindow(window, color);
    }
    return score;
}

function evaluateWindow(window, color) {
    const opponentColor = color === 'red' ? 'yellow' : 'red';
    let score = 0;
    const count = window.filter(cell => cell?.color === color).length;
    const oppCount = window.filter(cell => cell?.color === opponentColor).length;
    const emptyCount = window.filter(cell => !cell).length;

    if (count === 4) {
        score += 100;
    } else if (count === 3 && emptyCount === 1) {
        score += 5;
    } else if (count === 2 && emptyCount === 2) {
        score += 2;
    }

    if (oppCount === 3 && emptyCount === 1) {
        score -= 4;
    }

    return score;
}

// Minimax with alpha-beta pruning

function minimax(board, depth, alpha, beta, maximizingPlayer, aiColor) {
    const opponentColor = aiColor === 'red' ? 'yellow' : 'red';
    const validLocations = getValidColumns(board);
    const isTerminal = isTerminalNode(board);

    if (depth === 0 || isTerminal) {
        if (isTerminal) {
            if (checkWinner(board, aiColor)) {
                return { column: null, score: Infinity };
            } else if (checkWinner(board, opponentColor)) {
                return { column: null, score: -Infinity };
            } else {
                // Game is over, no more valid moves
                return { column: null, score: 0 };
            }
        } else {
            // Depth is zero
            return { column: null, score: evaluateBoard(board, aiColor) };
        }
    }

    if (maximizingPlayer) {
        let value = -Infinity;
        let bestColumn = validLocations[Math.floor(Math.random() * validLocations.length)];
        for (let col of validLocations) {
            makeMove(board, col, aiColor);
            let newScore = minimax(board, depth - 1, alpha, beta, false, aiColor).score;
            undoMove(board, col);
            if (newScore > value) {
                value = newScore;
                bestColumn = col;
            }
            alpha = Math.max(alpha, value);
            if (alpha >= beta) {
                break;
            }
        }
        return { column: bestColumn, score: value };
    } else {
        let value = Infinity;
        let bestColumn = validLocations[Math.floor(Math.random() * validLocations.length)];
        for (let col of validLocations) {
            makeMove(board, col, opponentColor);
            let newScore = minimax(board, depth - 1, alpha, beta, true, aiColor).score;
            undoMove(board, col);
            if (newScore < value) {
                value = newScore;
                bestColumn = col;
            }
            beta = Math.min(beta, value);
            if (alpha >= beta) {
                break;
            }
        }
        return { column: bestColumn, score: value };
    }
}


// Negascout algorithm implementation
function negascout(board, depth, alpha, beta, color) {
    const opponentColor = color === 'red' ? 'yellow' : 'red';
    const validLocations = getValidColumns(board);
    const isTerminal = isTerminalNode(board);

    if (depth === 0 || isTerminal) {
        if (isTerminal) {
            if (checkWinner(board, color)) {
                return { column: null, score: Infinity };
            } else if (checkWinner(board, opponentColor)) {
                return { column: null, score: -Infinity };
            } else {
                return { column: null, score: 0 };
            }
        } else {
            return { column: null, score: evaluateBoard(board, color) };
        }
    }

    let bestScore = -Infinity;
    let bestColumn = validLocations[0];

    for (let i = 0; i < validLocations.length; i++) {
        const col = validLocations[i];
        makeMove(board, col, color);
        let score;

        if (i === 0) {
            // Full window search
            score = -negascout(board, depth - 1, -beta, -alpha, opponentColor).score;
        } else {
            // Null window search (zero-width window)
            score = -negascout(board, depth - 1, -alpha - 1, -alpha, opponentColor).score;

            if (alpha < score && score < beta) {
                // Re-search
                score = -negascout(board, depth - 1, -beta, -score, opponentColor).score;
            }
        }

        undoMove(board, col);

        if (score > bestScore) {
            bestScore = score;
            bestColumn = col;
        }

        alpha = Math.max(alpha, score);

        if (alpha >= beta) {
            break; // Beta cutoff
        }
    }

    return { column: bestColumn, score: bestScore };
}

// AI logic functions

function getEasyMove(board) {
    // Random move
    const validColumns = getValidColumns(board);
    return validColumns[Math.floor(Math.random() * validColumns.length)];
}

function getMediumMove(board, aiColor) {
    // Block opponent's winning move or make a random move
    const opponentColor = aiColor === 'red' ? 'yellow' : 'red';

    // Check if AI can win in the next move
    let winningMove = findWinningMove(board, aiColor);
    if (winningMove !== null) {
        return winningMove;
    }

    // Block opponent's winning move
    let blockingMove = findWinningMove(board, opponentColor);
    if (blockingMove !== null) {
        return blockingMove;
    }

    // Else, random move
    return getEasyMove(board);
}

function findWinningMove(board, color) {
    const validColumns = getValidColumns(board);
    for (let col of validColumns) {
        const tempBoard = JSON.parse(JSON.stringify(board));
        makeMove(tempBoard, col, color);
        if (checkWinner(tempBoard, color)) {
            return col;
        }
    }
    return null;
}

function getHardMove(board, aiColor) {
    const depth = MAX_DEPTH;
    const result = minimax(board, depth, -Infinity, Infinity, true, aiColor);
    return result.column;
}

function getExpertMove(board, aiColor) {
    const depth = NEGASCOUT_DEPTH;
    const result = negascout(board, depth, -Infinity, Infinity, aiColor);
    return result.column;
}

// Routes

app.post('/ai-move', (req, res) => {
    const { board, aiDifficulty, aiColor } = req.body;
    let selectedColumn;

    // Log the incoming request
    console.log('---');
    console.log(`AI Move Requested:`);
    console.log(`AI Difficulty: ${aiDifficulty}`);
    console.log(`AI Color: ${aiColor}`);
    console.log('Current Board State:');
    console.log(board.map(row => row.map(cell => (cell ? cell.color[0] : '_')).join(' ')).join('\n'));

    switch (aiDifficulty) {
        case 'easy':
            selectedColumn = getEasyMove(board);
            break;
        case 'medium':
            selectedColumn = getMediumMove(board, aiColor);
            break;
        case 'hard':
            selectedColumn = getHardMove(board, aiColor);
            break;
        case 'expert':
            selectedColumn = getExpertMove(board, aiColor);
            break;
        default:
            selectedColumn = getEasyMove(board);
    }

    // Log the selected move
    console.log(`AI selected column: ${selectedColumn}`);
    console.log('---');

    res.json({ column: selectedColumn });
});

// Start the server
app.listen(port, () => {
    console.log(`Connect4 AI server running on port ${port}`);
});
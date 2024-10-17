const express = require('express');
const cors = require('cors');
const app = express();
const port = 5000;

const ROWS = 6;
const COLS = 7;

// Define depths for each difficulty level
const EASY_DEPTH = 1;
const MEDIUM_DEPTH = 2;
const HARD_DEPTH = 5;
const EXPERT_DEPTH = 9;

app.use(cors());
app.use(express.json());

function getValidColumns(board) {
    return board[0].map((_, col) => col).filter(col => !board[0][col]);
}

function makeMove(board, col, color) {
    for (let row = ROWS - 1; row >= 0; row--) {
        if (!board[row][col]) {
            board[row][col] = { color };
            return row;
        }
    }
    return -1;
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
        { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: -1 }
    ];

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]?.color !== color) continue;

            for (let { x: dx, y: dy } of directions) {
                let count = 1;
                let r = row + dy;
                let c = col + dx;

                while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c]?.color === color) {
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

function evaluateThreats(board, color) {
    let threats = 0;
    const opponentColor = color === 'red' ? 'yellow' : 'red';
    const directions = [
        { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }
    ];

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            for (let { x: dx, y: dy } of directions) {
                let count = 0;
                let empty = 0;
                let emptyPos = -1;

                for (let i = 0; i < 4; i++) {
                    const r = row + i * dy;
                    const c = col + i * dx;
                    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;

                    if (board[r][c]?.color === color) {
                        count++;
                    } else if (!board[r][c]) {
                        empty++;
                        emptyPos = c;
                    } else {
                        break;
                    }
                }

                if (count === 3 && empty === 1) {
                    threats += 1000; // Greatly increase the threat score
                    // Check if the empty position is playable
                    if (emptyPos !== -1 && (row === ROWS - 1 || board[row + 1][emptyPos])) {
                        threats += 10000;  // Immediate winning threat
                    }
                }
                // Check for opponent's threats as well
                else if (count === 0 && empty === 1) {
                    let oppCount = 3 - empty;
                    if (oppCount === 3) {
                        threats -= 10000; // Opponent's immediate winning threat
                    }
                }
            }
        }
    }

    return threats;
}

function evaluateBoard(board, color) {
    const opponentColor = color === 'red' ? 'yellow' : 'red';
    let score = 0;

    // Evaluate center control
    const centerCol = Math.floor(COLS / 2);
    score += board.filter(row => row[centerCol]?.color === color).length * 3;
    score -= board.filter(row => row[centerCol]?.color === opponentColor).length * 3;

    // Evaluate threats and potential wins
    score += evaluateThreats(board, color);
    score -= evaluateThreats(board, opponentColor);

    // Evaluate position
    score += evaluatePosition(board, color);
    score -= evaluatePosition(board, opponentColor);

    return score;
}

function evaluatePosition(board, color) {
    let score = 0;
    const directions = [
        { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }
    ];

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]?.color !== color) continue;

            for (let { x: dx, y: dy } of directions) {
                let count = 1;
                let r = row + dy;
                let c = col + dx;

                while (r >= 0 && r < ROWS && c >= 0 && c < COLS && count < 4) {
                    if (board[r][c]?.color === color) {
                        count++;
                    } else if (!board[r][c]) {
                        score += count;
                        break;
                    } else {
                        break;
                    }
                    r += dy;
                    c += dx;
                }
            }
        }
    }

    return score;
}

function negamax(board, depth, alpha, beta, color) {
    const opponentColor = color === 'red' ? 'yellow' : 'red';
    const validLocations = getValidColumns(board);

    if (depth === 0 || validLocations.length === 0) {
        return { column: null, score: evaluateBoard(board, color) };
    }

    if (checkWinner(board, color)) return { column: null, score: 100000 * depth };
    if (checkWinner(board, opponentColor)) return { column: null, score: -100000 * depth };

    let maxScore = -Infinity;
    let bestColumn = validLocations[0];

    for (let col of validLocations) {
        const row = makeMove(board, col, color);
        const score = -negamax(board, depth - 1, -beta, -alpha, opponentColor).score;
        undoMove(board, col);

        if (score > maxScore) {
            maxScore = score;
            bestColumn = col;
        }

        alpha = Math.max(alpha, score);
        if (alpha >= beta) break;
    }

    return { column: bestColumn, score: maxScore };
}

function negascout(board, depth, alpha, beta, color, maximizingPlayer) {
    const opponentColor = color === 'red' ? 'yellow' : 'red';
    const validLocations = getValidColumns(board);

    if (depth === 0 || validLocations.length === 0) {
        return { column: null, score: evaluateBoard(board, color) };
    }

    if (checkWinner(board, color)) return { column: null, score: 100000 * (depth + 1) };
    if (checkWinner(board, opponentColor)) return { column: null, score: -100000 * (depth + 1) };

    let maxScore = -Infinity;
    let bestColumn = validLocations[0];

    for (let i = 0; i < validLocations.length; i++) {
        const col = validLocations[i];
        makeMove(board, col, color);
        let score;

        if (i === 0) {
            score = -negascout(board, depth - 1, -beta, -alpha, opponentColor, !maximizingPlayer).score;
        } else {
            score = -negascout(board, depth - 1, -alpha - 1, -alpha, opponentColor, !maximizingPlayer).score;
            if (alpha < score && score < beta) {
                score = -negascout(board, depth - 1, -beta, -score, opponentColor, !maximizingPlayer).score;
            }
        }

        undoMove(board, col);

        if (score > maxScore) {
            maxScore = score;
            bestColumn = col;
        }

        alpha = Math.max(alpha, score);
        if (alpha >= beta) break;
    }

    return { column: bestColumn, score: maxScore };
}

function getBestMove(board, color, difficulty) {
    let depth;
    let algorithm;

    switch (difficulty) {
        case 'easy':
            depth = EASY_DEPTH;
            algorithm = negamax;
            break;
        case 'medium':
            depth = MEDIUM_DEPTH;
            algorithm = negamax;
            break;
        case 'hard':
            depth = HARD_DEPTH;
            algorithm = negascout;
            break;
        case 'expert':
            depth = EXPERT_DEPTH;
            algorithm = negascout;
            break;
        default:
            depth = MEDIUM_DEPTH;
            algorithm = negamax;
    }

    return algorithm(board, depth, -Infinity, Infinity, color).column;
}

app.post('/ai-move', (req, res) => {
    const { board, aiDifficulty, aiColor } = req.body;
    const selectedColumn = getBestMove(board, aiColor, aiDifficulty);
    res.json({ column: selectedColumn });
});

app.listen(port, () => {
    console.log(`Connect4 AI server running on port ${port}`);
});
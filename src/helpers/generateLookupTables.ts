import { Bool, Field } from "o1js";

const emptyBoard = [0, 0, 0, 0, 0, 0, 0, 0, 0];
const N = emptyBoard.length;  // Number of squares of the board

function isWinningState(board: number[], isPlayerA: boolean) {
    const winningCombinations = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6] 
    ];

    const player = isPlayerA ? 1 : 2;

    for (var winningCombination of winningCombinations) {
        var count = 0;

        for (var index of winningCombination) {
            if (board[index] !== player) break; // don't bother looking further.
            count++;
        }

        if (count === 3) return true;
    };

    return false;
};

function isDrawState(board: number[]) {
    if (isWinningState(board, true) || isWinningState(board, false)) return false;

    for (var square of board) {
        if (square === 0) return false;
    };

    return true;
};

function boardTransition(board: number[], isTurnA: boolean, index: number) {
    if (board[index] !== 0) return null;

    const newBoard = [...board]
    newBoard[index] = isTurnA ? 1 : 2;

    return newBoard;
};

function serializeBoard(board: number[]) {
    let isPlayed = [];
    let player = [];

    for (let i = 0; i < N; i++) {
        const isEmpty = board[i] === 0;

        if (isEmpty) {
            isPlayed.push(Bool(false));
            player.push(Bool(false));
        } else {
            isPlayed.push(Bool(true));
            player.push(board[i] === 1 ? Bool(true) : Bool(false));
        };
    };

    return Field.fromBits(isPlayed.concat(player));
};

export function generateTables() {
    var winningBoards: Field[] = [];
    var stringifiedWinningBoards: string[] = [];

    var drawBoards: Field[] = [];
    var stringifiedDrawBoards: string[] = [];

    var startingBoards = [[...emptyBoard]]

    for (var turn = 0; turn < 9; turn++) {
        let endingBoards: number[][] = [];
        let isTurnA = turn % 2 === 0;

        for (var board of startingBoards) {
            for (var i = 0; i < N; i++) {
                var startBoard = [...board];

                // If the start board is a winning board, no new move is possible
                if (isWinningState(startBoard, !isTurnA)) continue

                // Add new board to list for next iteration
                const endingBoard = boardTransition(startBoard, isTurnA, i);
                if (!endingBoard) continue;
                endingBoards.push(endingBoard);

                // Add to winning states if it is a winning board
                if (isWinningState(endingBoard, isTurnA)) {
                    const serializedBoard = serializeBoard(endingBoard);
                    
                    if(!stringifiedWinningBoards.includes(serializedBoard.toString())) {
                        winningBoards.push(serializedBoard);
                        stringifiedWinningBoards.push(serializedBoard.toString());
                    };
                };

                // Add to draw states if it is a draw board
                if (isDrawState(endingBoard)) {
                    const serializedBoard = serializeBoard(endingBoard);
                    
                    if(!stringifiedDrawBoards.includes(serializedBoard.toString())) {
                        drawBoards.push(serializedBoard);
                        stringifiedDrawBoards.push(serializedBoard.toString());
                    };
                };
            };
        };

        startingBoards = JSON.parse(JSON.stringify(endingBoards));
    };

    return { 
        winningBoards,
        drawBoards,
    };
};

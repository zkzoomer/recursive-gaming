import { Field } from "o1js";

const emptyBoard = [9, 9, 9, 9, 9, 9, 9, 9, 9];
const N = emptyBoard.length;  // Number of squares of the board

function boardToString(board: number[]) {
    let encodedBoard = 0;

    for (let i = 0; i < N; i++) {
        encodedBoard += board[N - i - 1] * 10 ** i;
    };

    return encodedBoard.toString();
};

function boardToField(board: number[]) {
    return Field(boardToString(board));
}

function boardTransitionToField(startBoard: number[], endBoard: number[]) {
    return Field(boardToString(startBoard) + boardToString(endBoard));
};

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
        if (square === 9) return false;
    };

    return true;
};

function boardTransition(board: number[], isTurnA: boolean, index: number) {
    if (board[index] !== 9) return null;

    const newBoard = [...board]
    newBoard[index] = isTurnA ? 1 : 2;

    return newBoard;
};

export { emptyBoard, N, boardToString, boardToField, boardTransitionToField, isWinningState, isDrawState, boardTransition }

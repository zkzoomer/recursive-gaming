import { Bool, Field, Poseidon, Provable, SelfProof, Struct, ZkProgram } from 'o1js';

function Optional<T>(type: Provable<T>) {
    return class Optional_ extends Struct({ isSome: Bool, value: type }) {
        constructor(isSome: boolean | Bool, value: T) {
            super({ isSome: Bool(isSome), value });
        }
    
        toFields() {
            return Optional_.toFields(this);
        }
    };
};
  
class OptionalBool extends Optional(Bool) {}

export class Board {
    board: OptionalBool[][];
  
    constructor(serializedBoard: Field) {
        const bits = serializedBoard.toBits(18);
        let board = [];

        for (let i = 0; i < 3; i++) {
            let row = [];

            for (let j = 0; j < 3; j++) {
                const isPlayed = bits[i * 3 + j];
                const player = bits[i * 3 + j + 9];
                row.push(new OptionalBool(isPlayed, player));
            };

            board.push(row);
        };

        this.board = board;
    }
  
    serialize(): Field {
        let isPlayed = [];
        let player = [];

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                isPlayed.push(this.board[i][j].isSome);
                player.push(this.board[i][j].value);
            };
        };

        return Field.fromBits(isPlayed.concat(player));
    };
  
    update(x: Field, y: Field, playerToken: Bool) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                // is this the cell the player wants to play?
                const toUpdate = x.equals(new Field(i)).and(y.equals(new Field(j)));
        
                // make sure we can play there
                toUpdate.and(this.board[i][j].isSome).assertEquals(false);
        
                // copy the board (or update if this is the cell the player wants to play)
                this.board[i][j] = Provable.if(
                    toUpdate,
                    new OptionalBool(true, playerToken),
                    this.board[i][j]
                );
            };
        };
    };
};

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

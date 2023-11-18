import { Bool, Field } from "o1js";
import { Board } from "./utils";

const N = 9;

export function generateTables() {
    var winningBoards: Field[] = [];
    var drawBoards: Field[] = [];

    // We start iterating on an empty board
    var startingBoards = [(new Board(Field(0))).serialize()];

    for (var turn = 0; turn < 9; turn++) {
        let endingBoards: Field[] = [];
        let isTurnA = turn % 2 === 0;

        for (var _board of startingBoards) {
            for (var i = 0; i < N; i++) {
                const board = new Board(_board);

                if (board.checkWin()) continue;

                try {
                    board.update(Field(i % 3), Field(Math.floor(i/3)), Bool(isTurnA));
                } catch (err) {
                    continue;
                };

                // Add new board to list for next iteration
                endingBoards.push(board.serialize());

                // Add to winning states if it is a winning board
                if (board.checkWin() && !winningBoards.includes(board.serialize())) {
                    winningBoards.push(board.serialize());
                };

                // Add to draw states if it is a draw board
                if (board.checkDraw() && !drawBoards.includes(board.serialize())) {
                    drawBoards.push(board.serialize());
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

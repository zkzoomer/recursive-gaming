import { Field } from "o1js";
import { N, boardToField, boardTransition, boardTransitionToField, emptyBoard, isDrawState, isWinningState } from "./utils";

export function generateTables() {
    var stateTransitions: Field[] = [];

    var winningStates: Field[] = [];

    var drawStates: Field[] = [];

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

                // Add the validated state transition
                stateTransitions.push(boardTransitionToField(startBoard, endingBoard));

                // Add to winning states if it is a winning board
                if (isWinningState(endingBoard, isTurnA) && !winningStates.includes(boardToField(endingBoard))) {
                    winningStates.push(boardToField(endingBoard));
                };

                // Add to draw states if it is a draw board
                if (isDrawState(endingBoard) && !drawStates.includes(boardToField(endingBoard))) {
                    drawStates.push(boardToField(endingBoard));
                };
            };
        };

        startingBoards = JSON.parse(JSON.stringify(endingBoards));
    };  

    return { 
        stateTransitions,
        winningStates,
        drawStates,
    };
};

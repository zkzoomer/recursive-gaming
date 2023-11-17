import { Bool, Field, Poseidon, SelfProof, Struct, ZkProgram } from 'o1js';

class TicTacToePublicOutput extends Struct({
    alicePlayerId: Field,
    bobPlayerId: Field,
    gameId: Field,        
    isTurnA: Bool,              // Whether it is A's next turn (true) or B's next turn (false) to play
    boardState: Field,          // Current state of the board encoded as a field element
}) {};
  
export const TicTacToeMove = ZkProgram({
    name: "tic-tac-toe-move",
    publicOutput: TicTacToePublicOutput,

    methods: {
        startGame: {
            privateInputs: [Field, Field, Field],

            method: (
                aliceGamerId: Field,
                bobGamerId: Field,
                gameId: Field
            ): TicTacToePublicOutput => {
                let isTurnA = Bool(true);           // Player A will start
                let boardState = Field(0);          // Intiial board state: empty

                let alicePlayerId = Poseidon.hash([aliceGamerId, gameId]);
                let bobPlayerId = Poseidon.hash([bobGamerId, gameId]);

                return { alicePlayerId, bobPlayerId, gameId, isTurnA, boardState };
            },
        },

        move: {
            privateInputs: [Field, Field, SelfProof],

            method: (
                secret: Field,
                newBoardState: Field,
                previousProof: SelfProof<void, TicTacToePublicOutput>
            ): TicTacToePublicOutput => {
                // Previous move proof is valid
                previousProof.verify();

                let alicePlayerId = previousProof.publicOutput.alicePlayerId;
                let bobPlayerId = previousProof.publicOutput.bobPlayerId;
                let gameId = previousProof.publicOutput.gameId;

                // Verifies that the move was made by the player whose turn it is
                let fideId = Poseidon.hash([secret])
                let playerId = Poseidon.hash([fideId, gameId]);
                // playerId === bobPlayerId + isTurnA * (alicePlayerId - bobPlayerId)
                playerId.assertEquals(
                    bobPlayerId.add(previousProof.publicOutput.isTurnA.toField().mul(alicePlayerId.sub(bobPlayerId)))
                );

                // It will be the next player's turn to move
                let isTurnA = previousProof.publicOutput.isTurnA.not();

                // Board state update -- TODO
                newBoardState.assertEquals(previousProof.publicOutput.boardState);

                return { alicePlayerId, bobPlayerId, gameId, isTurnA, boardState: newBoardState };
            },
        },
    },
});

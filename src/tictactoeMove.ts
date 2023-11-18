import { Bool, Field, Poseidon, Provable, SelfProof, Struct, ZkProgram } from 'o1js';
import { Board } from './helpers';

export class TicTacToePublicOutput extends Struct({
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
            privateInputs: [Field, Field, Field, SelfProof],

            method: (
                secret: Field,
                x: Field,
                y: Field,
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

                // Square to fill must be valid
                x.equals(Field(0))
                    .or(x.equals(Field(1)))
                    .or(x.equals(Field(2)))
                    .assertTrue();
                y.equals(Field(0))
                    .or(y.equals(Field(1)))
                    .or(y.equals(Field(2)))
                    .assertTrue();
                
                // Define new board state
                let board = new Board(previousProof.publicOutput.boardState);
                board.update(x, y, previousProof.publicOutput.isTurnA);
                let newBoardState = board.serialize();

                return { alicePlayerId, bobPlayerId, gameId, isTurnA, boardState: newBoardState };
            },
        },
    },
});

export class TicTacToeMoveProof extends ZkProgram.Proof(TicTacToeMove) { };

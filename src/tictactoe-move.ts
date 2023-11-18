import { Bool, Field, Gates, Poseidon, Provable, SelfProof, Struct, ZkProgram } from 'o1js';
import { boardToField, emptyBoard, generateTables } from './helpers';

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
            }
            board.push(row);
        }
        this.board = board;
    }
  
    serialize(): Field {
        let isPlayed = [];
        let player = [];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
            isPlayed.push(this.board[i][j].isSome);
            player.push(this.board[i][j].value);
            }
        }
        return Field.fromBits(isPlayed.concat(player));
    }
  
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
            }
        }
    }
  
    printState() {
        for (let i = 0; i < 3; i++) {
            let row = '| ';
            for (let j = 0; j < 3; j++) {
            let token = '_';
            if (this.board[i][j].isSome.toBoolean()) {
                token = this.board[i][j].value.toBoolean() ? 'X' : 'O';
            }
    
            row += token + ' | ';
            }
            console.log(row);
        }
        console.log('---\n');
    }
  
    checkWinner(): Bool {
        let won = new Bool(false);
    
        // check rows
        for (let i = 0; i < 3; i++) {
            let row = this.board[i][0].isSome;
            row = row.and(this.board[i][1].isSome);
            row = row.and(this.board[i][2].isSome);
            row = row.and(this.board[i][0].value.equals(this.board[i][1].value));
            row = row.and(this.board[i][1].value.equals(this.board[i][2].value));
            won = won.or(row);
        }
    
        // check cols
        for (let i = 0; i < 3; i++) {
            let col = this.board[0][i].isSome;
            col = col.and(this.board[1][i].isSome);
            col = col.and(this.board[2][i].isSome);
            col = col.and(this.board[0][i].value.equals(this.board[1][i].value));
            col = col.and(this.board[1][i].value.equals(this.board[2][i].value));
            won = won.or(col);
        }
    
        // check diagonals
        let diag1 = this.board[0][0].isSome;
        diag1 = diag1.and(this.board[1][1].isSome);
        diag1 = diag1.and(this.board[2][2].isSome);
        diag1 = diag1.and(this.board[0][0].value.equals(this.board[1][1].value));
        diag1 = diag1.and(this.board[1][1].value.equals(this.board[2][2].value));
        won = won.or(diag1);
    
        let diag2 = this.board[0][2].isSome;
        diag2 = diag2.and(this.board[1][1].isSome);
        diag2 = diag2.and(this.board[0][2].isSome);
        diag2 = diag2.and(this.board[0][2].value.equals(this.board[1][1].value));
        diag2 = diag2.and(this.board[1][1].value.equals(this.board[2][0].value));
        won = won.or(diag2);
    
        //
        return won;
    }
}

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
                let isTurnA = Bool(true);                       // Player A will start
                let boardState = boardToField(emptyBoard);      // Intiial board state: empty

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

                // Get all possible board state transitions
                let { stateTransitions } = generateTables();
		        let stateTransitionsIndices = Array.from({length: stateTransitions.length}, (_, i) => Field(i));
                
                // Generate the lookup table with all possible state transitions
                Gates.addFixedLookupTable(1, stateTransitionsIndices, stateTransitions);
                
                // Compute the state transition
                let stateTransition = (previousProof.publicOutput.boardState.mul(Field(10 ** 9))).add(newBoardState);

                // Verify that the new state is result of a valid state transition
		        let index = stateTransitions.indexOf(previousProof.publicOutput.boardState, 0);
                Gates.lookup(Field(1), Field(index), stateTransition);

                return { alicePlayerId, bobPlayerId, gameId, isTurnA, boardState: newBoardState };
            },
        },
    },
});

export class TicTacToeMoveProof extends ZkProgram.Proof(TicTacToeMove) { }

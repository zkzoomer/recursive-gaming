import { Cache, Field, Poseidon } from 'o1js';
import { TicTacToeMove } from "./tictactoeMove";

describe('tictactoe-move', () => {
    let gameId: Field,
        aliceSecret: Field,
        aliceGamerId: Field,
        alicePlayerId: Field,
        bobSecret: Field,
        bobGamerId: Field,
        bobPlayerId: Field;

    beforeAll(async () => {
        const cache: Cache = Cache.FileSystem('./cache')
        await TicTacToeMove.compile({ cache });

        // The `gameId` nullifier prevents replay attacks from happening
        gameId = Field(1);

        // The secret acts like a password--its used to generate their gamer ID
        aliceSecret = Field(69);
        bobSecret = Field(420);

        aliceGamerId = Poseidon.hash([aliceSecret]);
        bobGamerId = Poseidon.hash([bobSecret]);

        // The player ID is specific to every game
        alicePlayerId = Poseidon.hash([aliceGamerId, gameId]);
        bobPlayerId = Poseidon.hash([bobGamerId, gameId]);
    });

    // Only valid turns are allowed: A -> B -> A -> B
    describe('Turns', () => {
        let baseProof: any;
    
        it('Generates the starting proof which creates a new game', async () => {
            baseProof = await TicTacToeMove.startGame(aliceGamerId, bobGamerId, gameId);
        });

        describe('First move proofs', () => {
            let move1Proof: any;

            beforeAll(async () => {
                baseProof = await TicTacToeMove.startGame(aliceGamerId, bobGamerId, gameId);
            });

            it('Generates a first move proof for Alice', async () => {
                move1Proof = await TicTacToeMove.move(aliceSecret, Field(1), Field(1), baseProof);
            });

            it('Does not generate a first move proof for Bob', async () => {
                await expect(async () => {
                    await TicTacToeMove.move(bobSecret,  Field(1), Field(1), baseProof);
                }).rejects.toThrow();
            });
        });

        describe('Second move proofs', () => {
            let move1Proof: any,
                move2Proof: any;
            
            beforeAll(async () => {
                baseProof = await TicTacToeMove.startGame(aliceGamerId, bobGamerId, gameId);
                move1Proof = await TicTacToeMove.move(aliceSecret,  Field(1), Field(1), baseProof);
            });

            it('Generates a second move proof for Bob', async () => {
                move2Proof = await TicTacToeMove.move(bobSecret, Field(0), Field(1), move1Proof);
            });

            it('Does not generate a first move proof for Alice', async () => {
                await expect(async () => {
                    await TicTacToeMove.move(aliceSecret, Field(0), Field(1), move1Proof);
                }).rejects.toThrow();
            });
        });


        // After which the scheme repeats itself
        describe('Second move proofs', () => {
            let move1Proof: any,
                move2Proof: any,
                move3Proof: any;
            
            beforeAll(async () => {
                baseProof = await TicTacToeMove.startGame(aliceGamerId, bobGamerId, gameId);
                move1Proof = await TicTacToeMove.move(aliceSecret, Field(1), Field(1), baseProof);
                move2Proof = await TicTacToeMove.move(bobSecret, Field(0), Field(1), move1Proof);
            });

            it('Generates a third move proof for Alice', async () => {
                move3Proof = await TicTacToeMove.move(aliceSecret, Field(2), Field(2), move2Proof);
            });

            it('Does not generate a third move proof for Bob', async () => {
                await expect(async () => {
                    await TicTacToeMove.move(bobSecret, Field(2), Field(2), move2Proof);
                }).rejects.toThrow();
            });
        });
    });

    // Only valid board state transitions are allowed, part of a precommitted and public table
    describe('Moves', () => {
        let baseProof: any,
            move1Proof: any,
            move2Proof: any;

        beforeEach(async () => {
            baseProof = await TicTacToeMove.startGame(aliceGamerId, bobGamerId, gameId);
        });

        it('Reverts when given a non-valid move', async () => {
            await expect(async () => {
                await TicTacToeMove.move(aliceSecret, Field(3), Field(3), baseProof);
            }).rejects.toThrow();
        });

        it('Reverts when overwriting a move', async () => {
            move1Proof = await TicTacToeMove.move(aliceSecret, Field(1), Field(1), baseProof);

            await expect(async () => {
                await TicTacToeMove.move(bobSecret, Field(1), Field(1), move1Proof);
            }).rejects.toThrow();
        });
    });
});

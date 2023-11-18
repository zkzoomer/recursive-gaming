import { TicTacToe } from './tictactoe';
import {
    Field,
    Bool,
    PrivateKey,
    PublicKey,
    Mina,
    AccountUpdate,
    Poseidon,
} from 'o1js';
import { TicTacToeMove, TicTacToeMoveProof, TicTacToePublicOutput } from './tictactoeMove';
import { dummyBase64Proof } from 'o1js/dist/node/lib/proof_system';
import { Pickles } from 'o1js/dist/node/snarky';
import { Board, generateTables } from './helpers';

async function mockProof(
    publicOutput: TicTacToePublicOutput
  ): Promise<TicTacToeMoveProof> {
    const [, proof] = Pickles.proofOfBase64(await dummyBase64Proof(), 2);

    return new TicTacToeMoveProof({
        proof: proof,
        maxProofsVerified: 2,
        publicInput: undefined,
        publicOutput,
    });
}

describe('tictactoe', () => {
    let gameId: Field,
        alice: PublicKey,
        aliceKey: PrivateKey,
        aliceSecret: Field,
        aliceGamerId: Field,
        alicePlayerId: Field,
        bob: PublicKey,
        bobKey: PrivateKey,
        bobSecret: Field,
        bobGamerId: Field,
        bobPlayerId: Field,
        zkApp: TicTacToe,
        zkAppAddress: PublicKey,
        zkAppPrivateKey: PrivateKey,
        stringifiedWinningBoards: string[],
        stringifiedDrawBoards: string[];

    async function startGame() {
        const txn = await Mina.transaction(alice, () => {
            alice;
            zkApp.startGame(aliceGamerId, bobGamerId);
        });

        await txn.prove();
        await txn.sign([aliceKey]).send();
    }

    beforeAll(() => {
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

        ({ stringifiedWinningBoards, stringifiedDrawBoards } = generateTables());
    });

    beforeEach(async () => {
        let Local = Mina.LocalBlockchain({ proofsEnabled: false });
        Mina.setActiveInstance(Local);

        [
            { publicKey: alice, privateKey: aliceKey },
            { publicKey: bob, privateKey: bobKey }
        ] = Local.testAccounts;

        zkAppPrivateKey = PrivateKey.random();
        zkAppAddress = zkAppPrivateKey.toPublicKey();

        zkApp = new TicTacToe(zkAppAddress);

        const txn = await Mina.transaction(alice, () => {
            AccountUpdate.fundNewAccount(alice);
            zkApp.deploy();
        });

        await txn.prove();
        await txn.sign([zkAppPrivateKey, aliceKey]).send();
    });

    it('Generates and deploys the TicTacToe smart contract', async () => {
        const board = zkApp.winnerGamerId.get();
        expect(board).toEqual(Field(0));
    });

    describe('startGame', () => {
        it('starts a new game of tic-tac-toe', async () => {
            await startGame();

            const _gameId = zkApp.gameId.get();
            expect(_gameId).toEqual(gameId);

            const _alicePlayerId = zkApp.alicePlayerId.get();
            expect(_alicePlayerId).toEqual(alicePlayerId);
            const _bobPlayerId = zkApp.bobPlayerId.get();
            expect(_bobPlayerId).toEqual(bobPlayerId);

            const _gameOngoing = zkApp.gameOngoing.get();
            expect(_gameOngoing).toEqual(Bool(true));
        });
    });

    describe('winFinish', () => {
        beforeEach(async () => {
            await startGame();
        });

        it('Reverts when the `newBoardState` is not in the list of winning positions', async () => {
            const boardState = (new Board(Field(0))).serialize();

            const publicOutput = new TicTacToePublicOutput(
                {alicePlayerId, bobPlayerId, gameId, isTurnA: Bool(false), boardState}
            );
            const proof = await mockProof(publicOutput);

            await expect(async () => {
                zkApp.winFinish(proof, Field(0), aliceGamerId);
            }).rejects.toThrow();
        });

        it('Sets the `winnerGamerId` to be that of the winner of the game', async () => {
            const boardState = (new Board(Field(37455))).serialize();
            const lookupIndex = Field(stringifiedWinningBoards.indexOf(boardState.toString()));

            const publicOutput = new TicTacToePublicOutput(
                {alicePlayerId, bobPlayerId, gameId, isTurnA: Bool(false), boardState}
            );
            const proof = await mockProof(publicOutput);

            const txn = await Mina.transaction(alice, () => {
                alice;
                zkApp.drawFinish(proof, lookupIndex);
            });

            await txn.prove();
            await txn.sign([aliceKey]).send();

            const winnerGamerId = zkApp.winnerGamerId.get();
            expect(winnerGamerId).toEqual(aliceGamerId);

            const gameOngoing = zkApp.gameOngoing.get();
            expect(gameOngoing).toEqual(Bool(false));
        });
    });

    describe('drawFinish', () => {
        beforeEach(async () => {
            await startGame();
        });

        it('Reverts when the `newBoardState` is not in the list of winning positions', async () => {
            const boardState = (new Board(Field(93183))).serialize();

            const publicOutput = new TicTacToePublicOutput(
                {alicePlayerId, bobPlayerId, gameId, isTurnA: Bool(false), boardState}
            );
            const proof = await mockProof(publicOutput);

            await expect(async () => {
                zkApp.drawFinish(proof, Field(0));
            }).rejects.toThrow();
        });

        it('Draws the game', async () => {
            const boardState = (new Board(Field(93183))).serialize();
            const lookupIndex = Field(stringifiedDrawBoards.indexOf(boardState.toString()));

            const publicOutput = new TicTacToePublicOutput(
                {alicePlayerId, bobPlayerId, gameId, isTurnA: Bool(false), boardState}
            );
            const proof = await mockProof(publicOutput);

            const txn = await Mina.transaction(alice, () => {
                alice;
                zkApp.drawFinish(proof, lookupIndex);
            });

            await txn.prove();
            await txn.sign([aliceKey]).send();

            const winnerGamerId = zkApp.winnerGamerId.get();
            expect(winnerGamerId).toEqual(Field(0));

            const gameOngoing = zkApp.gameOngoing.get();
            expect(gameOngoing).toEqual(Bool(false));
        });
    });

    describe('proposeDraw', () => {
        beforeEach(async () => {
            await startGame();
        });

        it('Reverts when given an invalid player secret', async () => {
            const forgedSecret = Field('42');

            await expect(async () => {
                zkApp.proposeDraw(forgedSecret);
            }).rejects.toThrow();
        });

        it('Sets `aliceDrawProposal` to true after Alice calls the function', async () => {
            const txn = await Mina.transaction(alice, () => {
                alice;
                zkApp.proposeDraw(aliceSecret);
            });

            await txn.prove();
            await txn.sign([aliceKey]).send();

            const aliceDrawProposal = zkApp.aliceDrawProposal.get();
            expect(aliceDrawProposal).toEqual(Bool(true));
        });

        it('Sets `boDrawProposal` to true after Bob calls the function', async () => {
            const txn = await Mina.transaction(bob, () => {
                bob;
                zkApp.proposeDraw(bobSecret);
            });

            await txn.prove();
            await txn.sign([bobKey]).send();

            const bobDrawProposal = zkApp.bobDrawProposal.get();
            expect(bobDrawProposal).toEqual(Bool(true));
        });
    });

    describe('draw', () => {
        async function proposeDraw (secret: Field) {
            const txn = await Mina.transaction(alice, () => {
                alice;
                zkApp.proposeDraw(secret);
            });

            await txn.prove();
            await txn.sign([aliceKey]).send();
        };

        beforeEach(async () => {
            await startGame();
        });

        it('Reverts when neither party has agreed to a draw', async () => {
            await expect(async () => {
                zkApp.draw();
            }).rejects.toThrow();
        });

        it('Reverts when only Alice has agreed to a draw', async () => {
            await proposeDraw(aliceSecret);

            await expect(async () => {
                zkApp.draw();
            }).rejects.toThrow();
        });

        it('Reverts when only Bob has agreed to a draw', async () => {
            await proposeDraw(bobSecret);

            const bobDrawProposal = zkApp.bobDrawProposal.get();
            expect(bobDrawProposal).toEqual(Bool(true));

            await expect(async () => {
                zkApp.draw();
            }).rejects.toThrow();
        });

        it('Finishes the game setting a draw result--no game ID for the winner is specified', async () => {
            await proposeDraw(aliceSecret);
            await proposeDraw(bobSecret);

            const txn = await Mina.transaction(alice, () => {
                alice;
                zkApp.draw();
            });

            await txn.prove();
            await txn.sign([aliceKey]).send();

            const gameOngoing = zkApp.gameOngoing.get();
            expect(gameOngoing).toEqual(Bool(false));
        });
    });

    async function resign(secret: Field, winnerGamerId: Field) {
        const txn = await Mina.transaction(alice, () => {
            alice;
            zkApp.resign(secret, winnerGamerId);
        });

        await txn.prove();
        await txn.sign([aliceKey]).send();
    };

    describe('resign', () => {
        beforeEach(async () => {
            await startGame();
        });

        it('Reverts when given an invalid player secret', async () => {
            const forgedSecret = Field('42');

            await expect(async () => {
                zkApp.resign(forgedSecret, aliceGamerId);
            }).rejects.toThrow();
        });

        it('Reverts when given the wrong winner gamer ID', async () => {
            await expect(async () => {
                zkApp.resign(aliceSecret, aliceGamerId);
            }).rejects.toThrow();

            await expect(async () => {
                zkApp.resign(bobSecret, bobGamerId);
            }).rejects.toThrow();
        });

        it('Sets the winner to the validated winner gamer ID', async () => {
            await resign(bobSecret, aliceGamerId);

            const winnerGamerId = zkApp.winnerGamerId.get();
            expect(winnerGamerId).toEqual(aliceGamerId);

            const gameOngoing = zkApp.gameOngoing.get();
            expect(gameOngoing).toEqual(Bool(false));
        }); 
    });

    describe('endGame', () => {
        beforeEach(async () => {
            await startGame();
        });

        async function endGame() {
            const txn = await Mina.transaction(alice, () => {
                alice;
                zkApp.endGame();
            });
    
            await txn.prove();
            await txn.sign([aliceKey]).send();
        };

        it('Reverts when there is an ongoing game', async () => {
            await expect(async () => {
                const txn = await Mina.transaction(alice, () => {
                    alice;
                    zkApp.endGame();
                });
    
                await txn.prove();
                await txn.sign([aliceKey]).send();
            }).rejects.toThrow();
        });

        it('Sets the winner back to the default value', async () => {
            await resign(aliceSecret, bobGamerId);

            await endGame();

            const winnerGamerId = zkApp.winnerGamerId.get();
            expect(winnerGamerId).toEqual(Field(0));
        });

        it('Sets draw proposals back to false', async () => {
            await resign(aliceSecret, bobGamerId);

            await endGame();

            const aliceDrawProposal = zkApp.aliceDrawProposal.get();
            expect(aliceDrawProposal).toEqual(Bool(false));
            const bobDrawProposal = zkApp.bobDrawProposal.get();
            expect(bobDrawProposal).toEqual(Bool(false));
        });

        it('Allows a new game to be started after calling', async () => {
            await resign(aliceSecret, bobGamerId);

            await endGame();

            await startGame();
        });
    });
});

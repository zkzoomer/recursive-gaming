import { method, state, Bool, Field, Gates, Poseidon, Provable, SmartContract, State } from 'o1js';
import { TicTacToeMoveProof } from './tictactoeMove';
import { generateTables } from './helpers';

export class TicTacToe extends SmartContract {
    // Starts as false, set to true when there is a game ongoing
    @state(Bool) gameOngoing = State<Bool>();

    // The two players and their corresponding player IDs
    @state(Field) alicePlayerId = State<Field>(); 
    @state(Field) bobPlayerId = State<Field>();
    // The ID for the current game
    @state(Field) gameId = State<Field>();

    // Draw agreement status for both players
    @state(Bool) aliceDrawProposal = State<Bool>();
    @state(Bool) bobDrawProposal = State<Bool>();

    // The gamer ID for the winning player
    @state(Field) winnerGamerId = State<Field>();

	winningBoards: Field[];
	drawBoards: Field[];

    init() {
		super.init();
		// Set the game to be playeable
		this.gameOngoing.set(Bool(false));
		// Start the game ID count
		this.gameId.set(Field(0));
		// Set no winner for the game--makes the game playeable from the start
		this.winnerGamerId.set(Field(0));

		// Define lookup tables for win and draw states
		({ winningBoards: this.winningBoards, drawBoards: this.drawBoards } = generateTables());

		let winningBoardsIndices = Array.from({length: this.winningBoards.length}, (_, i) => Field(i));
		let drawBoardsIndices = Array.from({length: this.drawBoards.length}, (_, i) => Field(i));

		if(Provable.inProver()) {
			// Lookup table containing all possible win states
			Gates.addFixedLookupTable(1, winningBoardsIndices, this.winningBoards);
			// Lookup table containing all possible draw states
			Gates.addFixedLookupTable(1, drawBoardsIndices, this.drawBoards);
		};
    };
  
    @method startGame(
		aliceGamerId: Field, 
		bobGamerId: Field
    ) {
		// Requires a game to be ended already
		this.gameOngoing.assertEquals(Bool(false));
		this.winnerGamerId.assertEquals(Field(0));

		// Set the game ID
		let newGameId = this.gameId.getAndAssertEquals().add(1);
		this.gameId.set(newGameId);

		// Generate a player ID for both players
		this.alicePlayerId.set(Poseidon.hash([aliceGamerId, newGameId]));
		this.bobPlayerId.set(Poseidon.hash([bobGamerId, newGameId]));

		// Start the game
		this.gameOngoing.set(Bool(true));
    };

    @method winFinish(gameProof: TicTacToeMoveProof, winnerGamerId: Field) {
		// Verify the game proof corresponds to the defined onchain game
		let { alicePlayerId, bobPlayerId, gameId } = this._verifyGameProof(gameProof);

		// New board state is in the list of winning positions
		let index = this.winningBoards.findIndex(gameProof.publicOutput.boardState as any);
		Gates.lookup(Field(1), Field(index), gameProof.publicOutput.boardState);
		
		// Getting the winner player ID from the verified last move proof
		// proofWinnerPlayerId === bobPlayerId + proofWinner * (alicePlayerId - bobPlayerId)
		let proofWinner = gameProof.publicOutput.isTurnA.not();  // The winner made the last move
		let proofWinnerPlayerId = bobPlayerId.add(proofWinner.toField().mul(alicePlayerId.sub(bobPlayerId)));

		// The given gamer ID for the winner must match the one corresponding to the last move proof
		proofWinnerPlayerId.assertEquals(Poseidon.hash([winnerGamerId, gameId]))

		// Sets the winner to the validated gamer ID
		this.winnerGamerId.set(winnerGamerId);

		// Ends the game
		this.gameOngoing.set(Bool(false));
    };

	@method drawFinish(gameProof: TicTacToeMoveProof) {
		// Verify the game proof corresponds to the defined onchain game
		this._verifyGameProof(gameProof);

		// New board state is in the list of draw positions
		let index = this.drawBoards.findIndex(gameProof.publicOutput.boardState as any);
		Gates.lookup(Field(1), Field(index), gameProof.publicOutput.boardState);

		// Ends the game--can immediately be restarted
		this.gameOngoing.set(Bool(false));
	};

    @method proposeDraw(secret: Field) {
		// Gets the Player ID for the given `secret` and the current `gameId`
		let playerId = this._getPlayerId(secret);

		// Returns 1 if Alice is proposing a draw, 0 if Bob is proposing a draw
		let isAliceProposal = this._checkValidPlayerId(playerId);

		// Sets whose player draw proposal it is
		let currentAliceDrawProposal = this.aliceDrawProposal.getAndAssertEquals();
		let currentBobDrawProposal = this.bobDrawProposal.getAndAssertEquals();
		this.aliceDrawProposal.set(currentAliceDrawProposal.or(isAliceProposal));
		this.bobDrawProposal.set(currentBobDrawProposal.or(isAliceProposal.not()));
    };

    @method draw() {
		// Requires both parties to have preagreed to a draw
		this.aliceDrawProposal.getAndAssertEquals().assertTrue();
		this.bobDrawProposal.getAndAssertEquals().assertTrue();

		// Effectively restarts the game again
		this.gameOngoing.set(Bool(false));
    };

    @method resign(
		secret: Field,
		winnerGamerId: Field
	) {
		// Gets the Player ID for the given `secret` and the current `gameId`
		let playerId = this._getPlayerId(secret);

		// Returns 1 if Alice is resigning, 0 if Bob is resigning
		let isAliceResigning = this._checkValidPlayerId(playerId);

		// The given gamer ID for the winner must match the one from the other player
		// winnerPlayerId === alicePlayerId + isAliceResigning * (bobPlayerId - alicePlayerId)
		let alicePlayerId = this.alicePlayerId.getAndAssertEquals();
		let bobPlayerId = this.bobPlayerId.getAndAssertEquals();
		let winnerPlayerId = Poseidon.hash([winnerGamerId, this.gameId.getAndAssertEquals()]);
		winnerPlayerId.assertEquals(
			alicePlayerId.add(isAliceResigning.toField().mul(bobPlayerId.sub(alicePlayerId)))
		);
		
		// Sets the winner to the validated gamer ID
		this.winnerGamerId.set(winnerGamerId);

		// Ends the game
		this.gameOngoing.set(Bool(false));
    };

    @method endGame() {
		// Game must have already ended
		this.gameOngoing.assertEquals(Bool(false));

		// Sets draw proposals back to false
		this.aliceDrawProposal.set(Bool(false));
		this.bobDrawProposal.set(Bool(false));

		// Sets the winner back to the default value
		this.winnerGamerId.set(Field(0));
    };

    // Computes the Player ID for a given secret and the current gameId
    _getPlayerId(
		secret: Field
	) {
		let gamerId = Poseidon.hash([secret]);

		return Poseidon.hash([gamerId, this.gameId.getAndAssertEquals()]);
    };

    //  Verifies that the given `playerId` belongs to either Alice or Bob
    _checkValidPlayerId(
		playerId: Field
	) {
		// If it is Alice resigning, sets the winner to be Bob
		let isAlicePlayerId = playerId.equals(this.alicePlayerId.getAndAssertEquals());
		let isBobPlayerId = playerId.equals(this.bobPlayerId.getAndAssertEquals());

		// It must be either Alice or Bob that are resigning
		isAlicePlayerId.or(isBobPlayerId).assertTrue();

		// Returns the player who called the function: 1 if it was Alice, 0 if it was Bob
		return isAlicePlayerId;
    };

	// Verifies that the game proof corresponds to the defined onchain game
	_verifyGameProof(
		gameProof: TicTacToeMoveProof
	) {

		// Proof enconding the whole game was carried out correctly
		gameProof.verify();

		// Public outputs for the proof match with the onchain game
		let alicePlayerId = this.alicePlayerId.getAndAssertEquals();
		alicePlayerId.assertEquals(gameProof.publicOutput.alicePlayerId);
		let bobPlayerId = this.bobPlayerId.getAndAssertEquals();
		bobPlayerId.assertEquals(gameProof.publicOutput.bobPlayerId);
		let gameId = this.gameId.getAndAssertEquals();
		gameId.assertEquals(gameProof.publicOutput.gameId);

		return { alicePlayerId, bobPlayerId, gameId };
	};
};

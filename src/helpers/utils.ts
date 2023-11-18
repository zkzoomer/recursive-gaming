import { Bool, Field, Provable, Struct } from 'o1js';

function Optional<T>(type: Provable<T>) {
    return class Optional_ extends Struct({ isSome: Bool, value: type }) {
        constructor(isSome: boolean | Bool, value: T) {
            super({ isSome: Bool(isSome), value });
        };
    
        toFields() {
            return Optional_.toFields(this);
        };
    };
};
  
class OptionalBool extends Optional(Bool) {};

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
    };
  
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
  
    update(x: Field, y: Field, isTurnA: Bool) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                // is this the cell the player wants to play?
                const toUpdate = x.equals(new Field(i)).and(y.equals(new Field(j)));
        
                // make sure we can play there
                toUpdate.and(this.board[i][j].isSome).assertEquals(false);
        
                // copy the board (or update if this is the cell the player wants to play)
                this.board[i][j] = Provable.if(
                    toUpdate,
                    new OptionalBool(true, isTurnA),
                    this.board[i][j]
                );
            };
        };
    };

    printState() {
        for (let i = 0; i < 3; i++) {
            let row = '| ';
            for (let j = 0; j < 3; j++) {
                let token = '_';

                if (this.board[i][j].isSome.toBoolean()) {
                    token = this.board[i][j].value.toBoolean() ? 'O' : 'X';
                };
        
                row += token + ' | ';
            };
            console.log(row);
        };
        console.log('---\n');
    };

    checkWin(): Bool {
        let won = new Bool(false);
    
        // check rows
        for (let i = 0; i < 3; i++) {
            let row = this.board[i][0].isSome;
            row = row.and(this.board[i][1].isSome);
            row = row.and(this.board[i][2].isSome);
            row = row.and(this.board[i][0].value.equals(this.board[i][1].value));
            row = row.and(this.board[i][1].value.equals(this.board[i][2].value));
            won = won.or(row);
        };
    
        // check cols
        for (let i = 0; i < 3; i++) {
            let col = this.board[0][i].isSome;
            col = col.and(this.board[1][i].isSome);
            col = col.and(this.board[2][i].isSome);
            col = col.and(this.board[0][i].value.equals(this.board[1][i].value));
            col = col.and(this.board[1][i].value.equals(this.board[2][i].value));
            won = won.or(col);
        };
    
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
    
        return won;
    };

    checkDraw(): Bool {
        if (this.checkWin()) return Bool(false); 

        let draw =      this.board[0][0].isSome;
        draw = draw.and(this.board[0][1].isSome);
        draw = draw.and(this.board[0][2].isSome);
        draw = draw.and(this.board[1][0].isSome);
        draw = draw.and(this.board[1][2].isSome);
        draw = draw.and(this.board[1][2].isSome);
        draw = draw.and(this.board[2][0].isSome);
        draw = draw.and(this.board[2][1].isSome);
        draw = draw.and(this.board[2][2].isSome);

        return draw;
    };
};

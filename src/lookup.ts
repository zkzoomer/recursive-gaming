import { Field, Gates, Struct, ZkProgram } from 'o1js';

class LookupPublicInput extends Struct({
    index: Field,
    value: Field
}) {}

// Tests take as a reference: https://github.com/o1-labs/o1js/pull/1253
export const LookupTest = ZkProgram({
    name: "lookup-test",
    publicInput: LookupPublicInput,

    methods: {
        static: {
            privateInputs: [],

            method: (
                { index, value }: LookupPublicInput
            ) => {
                let indices = [Field(0), Field(1), Field(2), Field(3), Field(4), Field(5)];
                let data = [Field(2), Field(3), Field(5), Field(7), Field(11), Field(13)];

                Gates.addFixedLookupTable(1, indices, data);
                
                Gates.lookup(Field(1), index, value);
            },
        },
    },
});

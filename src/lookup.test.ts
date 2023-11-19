import { Cache, Field, Poseidon } from 'o1js';
import { LookupTest } from './lookup';

describe('lookup-test', () => {
    let gameId: Field,
        aliceSecret: Field,
        aliceGamerId: Field,
        alicePlayerId: Field,
        bobSecret: Field,
        bobGamerId: Field,
        bobPlayerId: Field;

    beforeAll(async () => {
        const cache: Cache = Cache.FileSystem('./cache')
        await LookupTest.compile({ cache });
    });

    it('Compiles the circuit', async () => {
        LookupTest.digest();
    });

    describe('Static lookups', () => {
        it('Generates a proof for a valid lookup', async () => {
            const validProof = await LookupTest.static({ index: Field(2), value: Field(5) });

            const proofIsValid = await LookupTest.verify(validProof);

            expect(proofIsValid).toEqual(true);
        });

        it('Does not generate a proof for an invalid lookup', async () => {
            await expect(async () => {
                await LookupTest.static({ index: Field(2), value: Field(42) });
            }).rejects.toThrow();
        });
    });
});

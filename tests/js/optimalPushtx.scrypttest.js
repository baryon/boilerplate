const path = require('path');
const { expect } = require('chai');
const { bsv, buildContractClass, getPreimage, toHex, SigHashPreimage } = require('scryptlib');

const {
    inputIndex,
    inputSatoshis,
    tx,
    compileContract,
} = require("../../helper");

const Hash = bsv.crypto.Hash
const tx_ = bsv.Transaction.shallowCopy(tx)

// MSB of the sighash  due to lower S policy
const MSB_THRESHOLD = 0x7E

describe('Test sCrypt contract OptimalPushTx In Javascript', () => {
    let test, preimage, result

    before(() => {
        const Test = buildContractClass(compileContract('optimalPushtx.scrypt'))
        test = new Test();
        
        // // use this if sigHashType needs to be customized, using Tx.checkPreimageOpt_(txPreimage)
        // const asmVars = {'Tx.checkPreimageOpt_.sigHashType': '41'} // FORKID | ALL
        // test.replaceAsmVars(asmVars)

        console.log(`locking script length: ${test.lockingScript.toHex().length / 2}`)
        
        // set txContext for verification
        test.txContext = {
            tx: tx_,
            inputIndex,
            inputSatoshis
        }
    });

    it('should return true', () => {
        for (i = 0; ; i++) {
            // malleate tx and thus sighash to satisfy constraint
            tx_.nLockTime = i
            const preimage_ = getPreimage(tx_, test.lockingScript.toASM(), inputSatoshis)
            preimage = toHex(preimage_)
            const h = Hash.sha256sha256(Buffer.from(preimage, 'hex'))
            const msb = h.readUInt8()
            if (msb < MSB_THRESHOLD) {
                // the resulting MSB of sighash must be less than the threshold
                break
            }
        }
        result = test.validate(new SigHashPreimage(preimage)).verify()
        expect(result.success, result.error).to.be.true
    });
});
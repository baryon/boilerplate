const { expect } = require('chai');
const { bsv, buildContractClass, Ripemd160, toHex, Bytes, getPreimage, SigHashPreimage, num2bin } = require('scryptlib');

/**
 * an example test for contract containing signature verification
 */
const { compileContract, inputIndex, inputSatoshis, dummyTxId, tx, DataLen } = require('../../helper');

// make a copy since it will be mutated
const tx_ = bsv.Transaction.shallowCopy(tx)
const outputAmount = 222222

describe('Test sCrypt contract Clone In Javascript', () => {
  let clone, preimage, context

  before(() => {

  });

  it('clone should succeed', () => {
    const Clone = buildContractClass(compileContract('clone.scrypt'))

    clone = new Clone()

    clone.setDataPart(num2bin(0, DataLen))

    const newLockingScript = [clone.codePart.toASM(), num2bin(0, DataLen)].join(' ')

    tx_.addOutput(new bsv.Transaction.Output({
      script: bsv.Script.fromASM(newLockingScript),
      satoshis: inputSatoshis
    }))

    preimage = getPreimage(tx_, clone.lockingScript.toASM(), inputSatoshis)

    context = { tx_, inputSatoshis, inputIndex }

    console.log( tx_.toString('hex') )

    // expect(toHex( bsv.Script.fromASM(clone.lockingScript.toASM()).toBuffer())).is.eql(preimage.scriptCode)
    // console.log(preimage.toJSON())

    const unlockFn = clone.unlock(new SigHashPreimage(toHex(preimage)))
    console.log(unlockFn)
    result = unlockFn.verify(context)
    expect(result.success, result.error).to.be.true
  });
});

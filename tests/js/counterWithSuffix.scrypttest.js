const { expect } = require('chai');
const { bsv, buildContractClass, getPreimage, toHex, num2bin, SigHashPreimage, Bytes } = require('scryptlib');

const {
  inputIndex,
  inputSatoshis,
  newTx,
  DataLen,
  compileContract
} = require('../../helper');

const tx = newTx();
const outputAmount = 222222

describe('Test sCrypt contract Counter In Javascript', () => {
  let counter, preimage, result

  before(() => {
    const Counter = buildContractClass(compileContract('counterWithSuffix.scrypt'))
    counter = new Counter()

    // set initial counter value
    counter.setDataPart([num2bin(0, DataLen), 'fff1ff3a8767'].join(' '))

    console.log(counter.lockingScript.toASM())
    console.log(counter.lockingScript.toHex())

    const newLockingScript = [counter.codePart.toASM(), num2bin(1, DataLen), 'fff1ff3a8767'].join(' ')
    console.log(bsv.Script.fromASM(newLockingScript).toHex())

    tx.addOutput(new bsv.Transaction.Output({
      script: bsv.Script.fromASM(newLockingScript),
      satoshis: outputAmount
    }))

    preimage = getPreimage(tx, counter.lockingScript.toASM(), inputSatoshis)

    // set txContext for verification
    counter.txContext = {
      tx: tx,
      inputIndex,
      inputSatoshis
    }
  });

  it('should succeed when pushing right preimage & amount', () => {
    result = counter.increment(new SigHashPreimage(toHex(preimage)), outputAmount).verify()
    expect(result.success, result.error).to.be.true
  });

  it('should fail when pushing wrong preimage', () => {
    result = counter.increment(new SigHashPreimage(toHex(preimage) + '01'), outputAmount).verify()
    expect(result.success, result.error).to.be.false
  });

  it('should fail when pushing wrong amount', () => {
    result = counter.increment(new SigHashPreimage(toHex(preimage)), outputAmount - 1).verify()
    expect(result.success, result.error).to.be.false
  });
});
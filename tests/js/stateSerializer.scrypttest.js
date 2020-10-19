const { expect } = require('chai');
const { bsv, buildContractClass, getPreimage, toHex, serializeState, SigHashPreimage } = require('scryptlib');

const {
  inputIndex,
  inputSatoshis,
  tx,
  compileContract
} = require('../../helper');

// make a copy since it will be mutated
const tx_ = bsv.Transaction.shallowCopy(tx)
const outputAmount = 222222

describe('Test sCrypt contract StateSerializer In Javascript', () => {
  let counter, preimage, result

  before(() => {
    const Counter = buildContractClass(compileContract('stateSerializer.scrypt'))
    counter = new Counter()

    // set initial state
    let state = {'counter': 11, 'bytes': '1234', 'flag': true}
    counter.setDataPart(state)

    console.log(counter.lockingScript.toASM())
    console.log(counter.lockingScript.toHex())
    
    // mutate state
    state.counter++
    state.bytes += 'ff'
    state.flag = !state.flag
    state.ext = '0102030405060708090001020304050607080900010203040506070809000102030405060708090001020304050607080900010203040506070809000102030405060708090001020304050607080900'

    const newLockingScript = [counter.codePart.toASM(), serializeState(state)].join(' ')

    console.log(newLockingScript)
    console.log(bsv.Script.fromASM(newLockingScript).toHex())

    tx_.addOutput(new bsv.Transaction.Output({
      script: bsv.Script.fromASM(newLockingScript),
      satoshis: outputAmount
    }))

    preimage = getPreimage(tx_, counter.lockingScript.toASM(), inputSatoshis)

    // set txContext for verification
    counter.txContext = {
      tx: tx_,
      inputIndex,
      inputSatoshis
    }
  });

  it('should succeed when pushing right preimage & amount', () => {
    result = counter.mutate(new SigHashPreimage(toHex(preimage)), outputAmount).verify()
    expect(result.success, result.error).to.be.true
  });
});
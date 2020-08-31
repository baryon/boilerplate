const { expect } = require('chai');
const { bsv, buildContractClass, toHex, getPreimage, num2bin, signTx, PubKey, Bytes, Sig } = require('scryptlib');
const { inputIndex, inputSatoshis, tx, compileContract, DataLen, dummyTxId, reversedDummyTxId } = require('../../helper');

// make a copy since it will be mutated
var tx_ = bsv.Transaction.shallowCopy(tx)
const outputAmount = 22222
    
describe('Test sCrypt contract UTXO Token In Javascript', () => {
  let token, lockingScriptCodePart, result

  const privateKey1 = new bsv.PrivateKey.fromRandom('testnet')
  const publicKey1 = bsv.PublicKey.fromPrivateKey(privateKey1)
  const privateKey2 = new bsv.PrivateKey.fromRandom('testnet')
  const publicKey2 = bsv.PublicKey.fromPrivateKey(privateKey2)
  const privateKey3 = new bsv.PrivateKey.fromRandom('testnet')
  const publicKey3 = bsv.PublicKey.fromPrivateKey(privateKey3)
    
  before(() => {
    const Token = buildContractClass(compileContract('tokenUtxo.scrypt'))
    token = new Token()

    // code part
    lockingScriptCodePart = token.codePart.toASM()
  });

  it('should succeed when one token is split into two', () => {
    // split 100 tokens
    token.dataLoad = toHex(publicKey1) + num2bin(10, DataLen) + num2bin(90, DataLen)
    
    const testSplit = (privKey, balance0, balance1, balanceInput0 = balance0, balanceInput1 = balance1) => {
      tx_ = new bsv.Transaction()

      tx_.addInput(new bsv.Transaction.Input({
        prevTxId: dummyTxId,
        outputIndex: 0,
        script: ''
      }), bsv.Script.fromASM(token.lockingScript.toASM()), inputSatoshis)

      const newLockingScript0 = lockingScriptCodePart + ' OP_RETURN ' + toHex(publicKey2) + num2bin(0, DataLen) + num2bin(balance0, DataLen)
      tx_.addOutput(new bsv.Transaction.Output({
        script: bsv.Script.fromASM(newLockingScript0),
        satoshis: outputAmount
      }))

      if (balance1 > 0) {
        const newLockingScript1 = lockingScriptCodePart + ' OP_RETURN ' + toHex(publicKey3) + num2bin(0, DataLen) + num2bin(balance1, DataLen)
        tx_.addOutput(new bsv.Transaction.Output({
          script: bsv.Script.fromASM(newLockingScript1),
          satoshis: outputAmount
        }))
      }
      
      const preimage = getPreimage(tx_, token.lockingScript.toASM(), inputSatoshis, inputIndex)
      const sig = signTx(tx_, privKey, token.lockingScript.toASM(), inputSatoshis)
      return token.split(
        new Sig(toHex(sig)),
        new PubKey(toHex(publicKey2)),
        balanceInput0,
        outputAmount,
        new PubKey(toHex(publicKey3)),
        balanceInput1,
        outputAmount,
        new Bytes(toHex(preimage))
      )
    }

    result = testSplit(privateKey1, 60, 40).verify({ tx: tx_, inputIndex, inputSatoshis })
    expect(result.success, result.error).to.be.true

    // 1 to 1 transfer
    result = testSplit(privateKey1, 100, 0).verify({ tx: tx_, inputIndex, inputSatoshis })
    expect(result.success, result.error).to.be.true

    // balance0 cannot be 0
    result = testSplit(privateKey1, 0, 100).verify({ tx: tx_, inputIndex, inputSatoshis })
    expect(result.success, result.error).to.be.false
    
    // unauthorized key
    result = testSplit(privateKey2, 60, 40).verify({ tx: tx_, inputIndex, inputSatoshis })
    expect(result.success, result.error).to.be.false
    
    // mismatch with preimage
    result = testSplit(privateKey1, 60, 40, 60 - 1, 40).verify({ tx: tx_, inputIndex, inputSatoshis })
    expect(result.success, result.error).to.be.false
    result = testSplit(privateKey1, 60, 40, 60, 40 + 1).verify({ tx: tx_, inputIndex, inputSatoshis })
    expect(result.success, result.error).to.be.false
    
    // token imbalance after splitting
    result = testSplit(privateKey1, 60 + 1, 40).verify({ tx: tx_, inputIndex, inputSatoshis })
    expect(result.success, result.error).to.be.false
    result = testSplit(privateKey1, 60, 40 - 1).verify({ tx: tx_, inputIndex, inputSatoshis })
    expect(result.success, result.error).to.be.false
  });

  it('should succeed when two tokens are merged', () => {
    const x0 = 10
    const x1 = 50
    const expectedBalance0 = x0 + x1
    const dataPart0 = toHex(publicKey1) + num2bin(x0, DataLen) + num2bin(x1, DataLen)
    const lockingScript0 = lockingScriptCodePart + ' OP_RETURN ' + dataPart0
    
    const y0 = 13
    const y1 = 27
    const expectedBalance1 = y0 + y1
    const dataPart1 = toHex(publicKey2) + num2bin(y0, DataLen) + num2bin(y1, DataLen)
    const lockingScript1 = lockingScriptCodePart + ' OP_RETURN ' + dataPart1
    
    const testMerge = (inputIndex, balance0, balance1) => {
      tx_ = new bsv.Transaction()

      tx_.addInput(new bsv.Transaction.Input({
        prevTxId: dummyTxId,
        outputIndex: 0,
        script: ''
      }), bsv.Script.fromASM(lockingScript0), inputSatoshis)
      
      tx_.addInput(new bsv.Transaction.Input({
        prevTxId: dummyTxId,
        outputIndex: 1,
        script: ''
      }), bsv.Script.fromASM(lockingScript1), inputSatoshis)

      // use reversed txid in outpoint
      const prevouts = reversedDummyTxId + num2bin(0, 4) + reversedDummyTxId + num2bin(1, 4)

      const newLockingScript0 = lockingScriptCodePart + ' OP_RETURN ' + toHex(publicKey3) + num2bin(balance0, DataLen) + num2bin(balance1, DataLen)
      tx_.addOutput(new bsv.Transaction.Output({
        script: bsv.Script.fromASM(newLockingScript0),
        satoshis: outputAmount
      }))

      token.dataLoad = inputIndex == 0 ? dataPart0 : dataPart1
      
      const preimage = getPreimage(tx_, inputIndex == 0 ? lockingScript0 : lockingScript1, inputSatoshis, inputIndex)
      const sig = signTx(tx_, inputIndex == 0 ? privateKey1 : privateKey2, inputIndex == 0 ? lockingScript0 : lockingScript1, inputSatoshis, inputIndex)
      return token.merge(
        new Sig(toHex(sig)),
        new PubKey(toHex(publicKey3)),
        new Bytes(prevouts),
        inputIndex == 0 ? balance1 : balance0,
        outputAmount,
        new Bytes(toHex(preimage))
      )
    }

    // input0 only checks balance0
    result = testMerge(0, expectedBalance0, expectedBalance1 + 1).verify({ tx: tx_, inputIndex: 0, inputSatoshis })
    expect(result.success, result.error).to.be.true
    result = testMerge(0, expectedBalance0 - 1, expectedBalance1).verify({ tx: tx_, inputIndex: 0, inputSatoshis })
    expect(result.success, result.error).to.be.false
    
    // input1 only checks balance1
    result = testMerge(1, expectedBalance0 - 1, expectedBalance1).verify({ tx: tx_, inputIndex: 1, inputSatoshis })
    expect(result.success, result.error).to.be.true
    result = testMerge(1, expectedBalance0, expectedBalance1 + 1).verify({ tx: tx_, inputIndex: 1, inputSatoshis })
    expect(result.success, result.error).to.be.false
    
    // both balance0 and balance1 have to be right to pass both checks of input0 and input1
    result = testMerge(0, expectedBalance0, expectedBalance1).verify({ tx: tx_, inputIndex, inputSatoshis })
    expect(result.success, result.error).to.be.true
    result = testMerge(1, expectedBalance0, expectedBalance1).verify({ tx: tx_, inputIndex: 1, inputSatoshis })
    expect(result.success, result.error).to.be.true
  });
});

const { expect } = require('chai');
const { bsv, buildContractClass, getPreimage, toHex, num2bin, Bytes, Ripemd160 } = require('scryptlib');
const {
  inputIndex,
  inputSatoshis,
  tx,
  DataLen,
  compileContract
} = require('../../helper');

// make a copy since it will be mutated
const tx_ = bsv.Transaction.shallowCopy(tx)

// Test keys
const privateKey = new bsv.PrivateKey.fromRandom('testnet')
const publicKey = privateKey.publicKey
const pkh = bsv.crypto.Hash.sha256ripemd160(publicKey.toBuffer())

const Signature = bsv.crypto.Signature
// Note: ANYONECANPAY
const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID
const outputAmount = 222222
const changeAmount = 111111

describe('Test sCrypt contract Counter In Javascript', () => {
  let counter, preimage, result

  before(() => {
    //advancedCounter
    //每次花费，会在锁定脚本后面填上购买者的公钥pk和购买的数量，并且要求添加数量乘以价格的Satoshi
    //所有的Satoshi被绑在合约中只能增加无法花费
    //输入允许增加其他的p2pkh输入，而输出要求两个，一个是添加了新购买者的合约，一个是找零用的p2pkh输出
    const Counter = buildContractClass(compileContract('advancedCounter.scrypt'))
    console.log(Counter)

    counter = new Counter()
    console.log(counter)

    // append state as passive data
    counter.dataLoad = num2bin(0, DataLen)

    const newLockingScript = counter.codePart.toASM() + ' OP_RETURN ' + num2bin(1, DataLen)
    console.log(newLockingScript)
    // counter output
    tx_.addOutput(new bsv.Transaction.Output({
      script: bsv.Script.fromASM(newLockingScript),
      satoshis: outputAmount
    }))

    // change output
    tx_.addOutput(new bsv.Transaction.Output({
      script: bsv.Script.buildPublicKeyHashOut(privateKey.toAddress()),
      satoshis: changeAmount
    }))

    preimage = getPreimage(tx_, counter.lockingScript.toASM(), inputSatoshis, 0, sighashType)
  });

  it('should succeed when pushing right preimage & amount', () => {

    incrementFn = counter.increment(new Bytes(toHex(preimage)), outputAmount, new Ripemd160(toHex(pkh)), changeAmount)
    console.log(incrementFn)
    result = incrementFn.verify( { tx: tx_, inputIndex, inputSatoshis } )
    console.log(result)
    expect(result.success, result.error).to.be.true;
  });
});
